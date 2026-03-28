#!/usr/bin/env python

"""Webhook endpoints for external service callbacks (Vapi, Twilio, etc.)"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.core.config import settings
from app.models.escalation_attempt import EscalationAttempt
from app.models.lead_contact_tracker import LeadContactTracker
from app.services.sms_reply_service import handle_inbound_sms

logger = logging.getLogger(__name__)

router = APIRouter()


def _verify_vapi_signature(body: bytes, signature: str | None) -> bool:
    """Verify Vapi webhook HMAC signature."""
    secret = settings.VAPI_WEBHOOK_SECRET
    if not secret:
        return True  # No secret configured — skip verification
    if not signature:
        return False
    expected = hmac.new(
        secret.encode(), body, hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/vapi", status_code=200)
async def vapi_webhook(
    request: Request,
    db_session: Session = Depends(get_db_session),
):
    """
    Receive Vapi.ai webhook callbacks for call events.

    Events handled:
    - status-update (call status changes: ringing, in-progress, ended)
    - end-of-call-report (final call summary)
    - transfer-destination-request (transfer initiated)
    """
    body = await request.body()
    signature = request.headers.get("x-vapi-signature")

    if not _verify_vapi_signature(body, signature):
        logger.warning("Vapi webhook signature verification failed")
        return {"status": "error", "reason": "invalid_signature"}

    payload = await request.json()

    # Vapi sends different payload structures depending on the event
    message = payload.get("message", {})
    event_type = message.get("type", payload.get("type", ""))
    call_data = message.get("call", payload.get("call", {}))
    call_id = call_data.get("id", "")

    if not call_id:
        return {"status": "ignored", "reason": "no_call_id"}

    with db_session as session:
        tracker = session.execute(
            select(LeadContactTracker).where(
                LeadContactTracker.ai_call_sid == call_id,
            )
        ).scalar_one_or_none()

        if not tracker:
            logger.debug("Vapi webhook: unknown call_id %s", call_id)
            return {"status": "ignored", "reason": "unknown_call_id"}

        now = datetime.now(timezone.utc)

        if event_type == "status-update":
            status = message.get("status", "")
            _handle_status_update(session, tracker, status, now, message)

        elif event_type == "end-of-call-report":
            _handle_end_of_call(session, tracker, now, message)

        elif event_type == "transfer-destination-request":
            # Vapi is asking where to transfer — we don't need to act here
            # as the transfer destination is set when we initiate the transfer
            pass

        session.commit()

    return {"status": "ok"}


def _handle_status_update(
    session: Session,
    tracker: LeadContactTracker,
    status: str,
    now: datetime,
    message: dict,
) -> None:
    """Handle call status update events."""
    if status == "ringing":
        tracker.ai_call_status = "ringing"

    elif status == "in-progress":
        tracker.ai_call_status = "connected"
        tracker.contact_status = "connected_live"

    elif status == "ended":
        tracker.ai_call_status = "completed"
        tracker.ai_call_ended_at = now

        ended_reason = message.get("endedReason", "")
        # Extract analysis from the call if available
        analysis = message.get("analysis", {})
        call_result = analysis.get("structuredData", {}).get("result", "")

        if call_result == "interested":
            tracker.ai_call_result = "interested"
            # Transfer will be handled by the escalation timeout
        elif call_result == "not_interested":
            tracker.ai_call_result = "not_interested"
            tracker.contact_status = "closed_not_interested"
            tracker.is_resolved = True
            tracker.resolved_at = now
            tracker.resolution_type = "not_interested"
        elif ended_reason in ("voicemail", "machine-detected"):
            tracker.ai_call_result = "voicemail_left"
            tracker.contact_status = "voicemail_left"
        elif ended_reason in ("no-answer", "customer-busy"):
            tracker.ai_call_result = "no_answer"
            tracker.contact_status = "no_answer"
        else:
            tracker.ai_call_result = "failed"

        # Check if transcript URL is available
        transcript_url = message.get("artifact", {}).get("recordingUrl")
        if transcript_url:
            tracker.ai_call_transcript_url = transcript_url


def _handle_end_of_call(
    session: Session,
    tracker: LeadContactTracker,
    now: datetime,
    message: dict,
) -> None:
    """Handle end-of-call report with summary and transcript."""
    tracker.ai_call_ended_at = now

    # Extract transcript URL
    recording_url = message.get("recordingUrl") or message.get("artifact", {}).get("recordingUrl")
    if recording_url:
        tracker.ai_call_transcript_url = recording_url

    # Extract structured analysis
    analysis = message.get("analysis", {})
    summary = analysis.get("summary", "")
    structured = analysis.get("structuredData", {})

    result = structured.get("result", "")
    if result and not tracker.ai_call_result:
        tracker.ai_call_result = result

    # Update transfer status on the latest escalation attempt if transfer was answered
    if structured.get("transfer_answered"):
        latest = (
            session.query(EscalationAttempt)
            .filter(EscalationAttempt.tracker_id == tracker.id)
            .order_by(EscalationAttempt.escalation_level.desc())
            .first()
        )
        if latest:
            latest.transfer_status = "answered"
            latest.transfer_answered_at = now

        tracker.contact_status = "transferred"
        tracker.is_resolved = True
        tracker.resolved_at = now
        tracker.resolution_type = "transferred"

    # Extract qualification data from structured analysis
    qual_fields = {}
    for key in (
        "damage_type", "event_type", "loss_date", "property_address",
        "has_insurance_claim", "wants_inspection", "callback_number",
        "best_time_to_call", "additional_notes",
    ):
        val = structured.get(key)
        if val is not None:
            qual_fields[key] = val

    if qual_fields:
        tracker.qualification_data_json = json.dumps(qual_fields)

    logger.info(
        "Vapi end-of-call for tracker %s: result=%s, summary=%s, qual_fields=%d",
        tracker.id, result, summary[:100] if summary else "", len(qual_fields),
    )


@router.post("/twilio/inbound-sms", status_code=200)
async def twilio_inbound_sms(
    request: Request,
    db_session: Session = Depends(get_db_session),
):
    """
    Receive inbound SMS from Twilio.

    Twilio sends application/x-www-form-urlencoded with fields:
    From, To, Body, MessageSid, etc.

    Processes the reply and returns empty TwiML so Twilio does not auto-reply.
    """
    form = await request.form()
    from_phone = form.get("From", "")
    body = form.get("Body", "")
    message_sid = form.get("MessageSid", "")

    if not from_phone:
        return Response(
            content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            media_type="application/xml",
        )

    logger.info("Twilio inbound SMS from %s: %s", from_phone, body[:100] if body else "")

    handle_inbound_sms(
        db=db_session,
        from_phone=from_phone,
        body=body,
        message_sid=message_sid,
    )

    # Twilio expects a TwiML response
    return Response(
        content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        media_type="application/xml",
    )
