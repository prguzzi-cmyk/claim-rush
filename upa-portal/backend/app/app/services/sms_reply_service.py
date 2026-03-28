#!/usr/bin/env python

"""Service for processing inbound SMS replies and updating lead status."""

import logging
import re
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.communication_log import CommunicationLog
from app.models.lead import Lead
from app.utils.notifications import create_notification

logger = logging.getLogger(__name__)

# Patterns that indicate a positive reply
POSITIVE_PATTERNS = re.compile(
    r"^(yes|y|yeah|yep|sure|ok|okay|interested|call me|please|definitely|absolutely)\b",
    re.IGNORECASE,
)


def normalize_phone(phone: str) -> str:
    """Normalize a phone number to E.164 format (+1XXXXXXXXXX)."""
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        digits = "1" + digits
    return f"+{digits}"


def handle_inbound_sms(
    db: Session,
    from_phone: str,
    body: str,
    message_sid: str | None = None,
) -> dict:
    """Process an inbound SMS reply.

    1. Normalize the phone to E.164.
    2. Find the most recent outbound CommunicationLog matching recipient_phone.
    3. Create an inbound CommunicationLog record.
    4. If positive reply, update lead status and create notification.

    Returns a dict with processing result.
    """
    normalized = normalize_phone(from_phone)

    # Find the most recent outbound log to this phone
    outbound_log = db.execute(
        select(CommunicationLog)
        .where(
            CommunicationLog.recipient_phone == normalized,
            CommunicationLog.direction == "outbound",
            CommunicationLog.channel == "sms",
        )
        .order_by(desc(CommunicationLog.created_at))
    ).scalar_one_or_none()

    lead_id = outbound_log.lead_id if outbound_log else None
    fire_incident_id = outbound_log.fire_incident_id if outbound_log else None

    # Create inbound log
    inbound_log = CommunicationLog(
        lead_id=lead_id,
        channel="sms",
        purpose="fire_outreach_reply",
        direction="inbound",
        fire_incident_id=fire_incident_id,
        recipient_phone=normalized,
        body_preview=body[:500] if body else None,
        provider_message_id=message_sid,
        send_status="received",
    )
    db.add(inbound_log)

    is_positive = bool(POSITIVE_PATTERNS.search(body.strip())) if body else False

    # ── UPA → ACI funnel reply classification ──
    upa_result = "neutral"
    if lead_id:
        from app.services.upa_outreach_service import classify_inbound_reply
        upa_result = classify_inbound_reply(db, lead_id, body or "")

    if upa_result == "stop":
        # Already handled by upa_outreach_service (opt-out + confirmation)
        db.commit()
        return {
            "status": "processed",
            "matched_lead_id": str(lead_id) if lead_id else None,
            "is_positive": False,
            "upa_classification": "stop",
        }

    if is_positive and lead_id:
        lead = db.get(Lead, lead_id)
        if lead:
            lead.status = "responded-yes"

            # Notify the assigned agent
            if lead.assigned_to:
                create_notification(
                    db,
                    user_id=lead.assigned_to,
                    title="Homeowner Responded YES",
                    message=f"A homeowner replied positively to your fire outreach SMS. Reply: \"{body[:100]}\"",
                    notification_type="fire_lead",
                    link="/app/response-desk",
                    lead_id=lead_id,
                )

            logger.info(
                "Positive reply from %s for lead %s — status updated to responded-yes",
                normalized, lead_id,
            )

    db.commit()

    return {
        "status": "processed",
        "matched_lead_id": str(lead_id) if lead_id else None,
        "is_positive": is_positive,
        "upa_classification": upa_result,
    }
