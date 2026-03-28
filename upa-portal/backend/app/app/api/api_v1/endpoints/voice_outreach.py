#!/usr/bin/env python

"""
REST API for AI Voice Outreach.

Wraps the existing voice provider (VAPI), LeadContactTracker,
and escalation infrastructure into frontend-consumable endpoints.

Does NOT duplicate:
- Voice provider logic (delegates to utils/voice/)
- Escalation state machine (delegates to EscalationService)
- Lead contact tracking (delegates to crud.lead_contact_tracker)
- Call initiation task (delegates to Celery task)
"""

import json
import logging
from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.rbac import Modules
from app.utils.contexts import UserContext

logger = logging.getLogger(__name__)

router = APIRouter()

permissions = Permissions(Modules.LEAD.value)


# ── Request / Response schemas ────────────────────────────────

class InitiateCallRequest(BaseModel):
    lead_id: UUID = Field(description="Lead UUID to call")
    phone_number: str = Field(description="Phone number to dial")
    lead_context: dict = Field(default_factory=dict, description="Context vars for AI assistant")


class InitiateCallResponse(BaseModel):
    success: bool
    call_id: str | None = None
    error: str | None = None


class RecordOutcomeRequest(BaseModel):
    outcome: str = Field(description="Call outcome (qualified_lead, no_answer, etc.)")
    qualification_data: dict | None = Field(default=None, description="Structured qualification data")
    transcript_summary: str | None = Field(default=None, description="Call transcript summary")


class CallStatusResponse(BaseModel):
    call_id: str
    ai_call_status: str
    ai_call_result: str | None = None
    contact_status: str
    transcript_url: str | None = None
    qualification_data: dict | None = None
    started_at: str | None = None
    ended_at: str | None = None


class SessionResponse(BaseModel):
    lead_id: UUID
    contact_status: str
    ai_call_status: str
    ai_call_result: str | None = None
    ai_call_sid: str | None = None
    transcript_url: str | None = None
    qualification_data: dict | None = None
    escalation_level: int
    is_resolved: bool
    resolution_type: str | None = None
    created_at: str | None = None

    class Config:
        orm_mode = True


class ProviderCapabilities(BaseModel):
    supports_outbound_calls: bool
    supports_transfer: bool
    supports_recording: bool
    supports_transcription: bool
    supports_real_time_analysis: bool
    provider_name: str


# ── Endpoints ─────────────────────────────────────────────────


@router.post(
    "/initiate",
    summary="Initiate an AI voice outreach call",
    response_model=InitiateCallResponse,
    dependencies=[Depends(permissions.create())],
)
def initiate_voice_call(
    body: InitiateCallRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """
    Initiate an outbound AI voice call for a lead.

    Delegates to the configured voice provider (VAPI) via the existing
    Celery task pipeline. Creates a LeadContactTracker if one does not
    already exist.
    """
    UserContext.set(current_user.id)

    # Verify lead exists
    lead = crud.lead.get(db_session=db_session, obj_id=body.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Check if voice provider is configured
    from app.utils.voice import get_voice_provider
    voice = get_voice_provider()
    if not voice:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice provider is not configured or enabled.",
        )

    # Check for existing active tracker
    existing = crud.lead_contact_tracker.get_by_lead(
        db_session, lead_id=body.lead_id
    )
    if existing and not existing.is_resolved:
        # Return existing call info instead of re-initiating
        return InitiateCallResponse(
            success=True,
            call_id=existing.ai_call_sid,
            error=None,
        )

    # Initiate call via voice provider
    result = voice.initiate_outbound_call(
        to_phone=body.phone_number,
        lead_context=body.lead_context,
    )

    if not result.success:
        return InitiateCallResponse(
            success=False,
            call_id=None,
            error=result.error,
        )

    # Create or update tracker
    if existing:
        existing.ai_call_status = "initiated"
        existing.ai_call_sid = result.call_id
        existing.ai_call_started_at = datetime.now(timezone.utc)
        existing.contact_status = "ai_call_initiated"
        existing.is_resolved = False
        existing.resolved_at = None
        existing.resolution_type = None
    else:
        from app.schemas.lead_contact_tracker import LeadContactTrackerCreate
        tracker_in = LeadContactTrackerCreate(
            lead_id=body.lead_id,
            territory_id=lead.territory_id if hasattr(lead, 'territory_id') and lead.territory_id else UUID(int=0),
            lead_type=body.lead_context.get("incident_type", "unknown"),
            current_agent_id=current_user.id,
            contact_status="ai_call_initiated",
            ai_call_status="initiated",
        )
        existing = crud.lead_contact_tracker.create(
            db_session=db_session, obj_in=tracker_in
        )
        # Update with call SID
        existing.ai_call_sid = result.call_id
        existing.ai_call_started_at = datetime.now(timezone.utc)

    db_session.commit()

    # Schedule escalation timeout
    try:
        from app.core.celery_app import celery_app
        from app.tasks.ai_contact import check_escalation_timeout
        check_escalation_timeout.apply_async(
            args=[str(existing.id)],
            countdown=settings.ESCALATION_TIMEOUT_SECONDS,
        )
    except Exception as e:
        logger.warning("Could not schedule escalation timeout: %s", e)

    return InitiateCallResponse(
        success=True,
        call_id=result.call_id,
    )


@router.get(
    "/calls/{call_id}/status",
    summary="Get call status",
    response_model=CallStatusResponse,
    dependencies=[Depends(permissions.read())],
)
def get_call_status(
    call_id: Annotated[str, Path(description="VAPI call ID")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get the current status of a voice call by its provider call ID."""
    tracker = crud.lead_contact_tracker.get_by_call_sid(
        db_session, call_sid=call_id
    )
    if not tracker:
        raise HTTPException(status_code=404, detail="Call not found")

    # Parse qualification data from notes if stored
    qual_data = None
    if hasattr(tracker, 'qualification_data_json') and tracker.qualification_data_json:
        try:
            qual_data = json.loads(tracker.qualification_data_json)
        except (json.JSONDecodeError, Exception):
            pass

    return CallStatusResponse(
        call_id=call_id,
        ai_call_status=tracker.ai_call_status,
        ai_call_result=tracker.ai_call_result,
        contact_status=tracker.contact_status,
        transcript_url=tracker.ai_call_transcript_url,
        qualification_data=qual_data,
        started_at=tracker.ai_call_started_at.isoformat() if tracker.ai_call_started_at else None,
        ended_at=tracker.ai_call_ended_at.isoformat() if tracker.ai_call_ended_at else None,
    )


@router.post(
    "/calls/{call_id}/outcome",
    summary="Record call outcome",
    dependencies=[Depends(permissions.update())],
)
def record_call_outcome(
    call_id: Annotated[str, Path(description="VAPI call ID")],
    body: RecordOutcomeRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """
    Manually record or override the outcome of a voice call.

    Maps voice outcomes to LeadContactTracker fields:
    - qualified_lead / urgent_followup / possible_claim → interested
    - not_interested / not_qualified / wrong_number → not_interested
    - no_answer → no_answer
    - left_voicemail → voicemail_left
    """
    UserContext.set(current_user.id)

    tracker = crud.lead_contact_tracker.get_by_call_sid(
        db_session, call_sid=call_id
    )
    if not tracker:
        raise HTTPException(status_code=404, detail="Call not found")

    now = datetime.now(timezone.utc)

    # Map frontend outcome to backend ai_call_result
    outcome_map = {
        'qualified_lead': 'interested',
        'urgent_followup': 'interested',
        'possible_claim': 'interested',
        'not_interested': 'not_interested',
        'not_qualified': 'not_interested',
        'wrong_number': 'not_interested',
        'no_answer': 'no_answer',
        'left_voicemail': 'voicemail_left',
        'call_back_later': 'no_answer',
        'existing_client': 'interested',
    }
    mapped_result = outcome_map.get(body.outcome, body.outcome)
    tracker.ai_call_result = mapped_result

    # Map to contact_status
    status_map = {
        'interested': 'connected_live',
        'not_interested': 'closed_not_interested',
        'no_answer': 'no_answer',
        'voicemail_left': 'voicemail_left',
    }
    tracker.contact_status = status_map.get(mapped_result, tracker.contact_status)

    # Store qualification data
    if body.qualification_data:
        if hasattr(tracker, 'qualification_data_json'):
            tracker.qualification_data_json = json.dumps(body.qualification_data)

    # Store transcript summary in transcript URL field as fallback
    if body.transcript_summary and not tracker.ai_call_transcript_url:
        tracker.ai_call_transcript_url = f"summary:{body.transcript_summary[:500]}"

    # Auto-resolve terminal outcomes
    if mapped_result in ('not_interested',):
        tracker.is_resolved = True
        tracker.resolved_at = now
        tracker.resolution_type = body.outcome

    db_session.commit()

    return {"status": "ok", "outcome": body.outcome, "mapped_result": mapped_result}


@router.get(
    "/sessions/{lead_id}",
    summary="Get voice outreach session for a lead",
    response_model=SessionResponse | None,
    dependencies=[Depends(permissions.read())],
)
def get_voice_session(
    lead_id: Annotated[UUID, Path(description="Lead UUID")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get the voice outreach session (tracker) for a lead."""
    tracker = crud.lead_contact_tracker.get_by_lead(
        db_session, lead_id=lead_id
    )
    if not tracker:
        return None

    qual_data = None
    if hasattr(tracker, 'qualification_data_json') and tracker.qualification_data_json:
        try:
            qual_data = json.loads(tracker.qualification_data_json)
        except (json.JSONDecodeError, Exception):
            pass

    return SessionResponse(
        lead_id=tracker.lead_id,
        contact_status=tracker.contact_status,
        ai_call_status=tracker.ai_call_status,
        ai_call_result=tracker.ai_call_result,
        ai_call_sid=tracker.ai_call_sid,
        transcript_url=tracker.ai_call_transcript_url,
        qualification_data=qual_data,
        escalation_level=tracker.current_escalation_level,
        is_resolved=tracker.is_resolved,
        resolution_type=tracker.resolution_type,
        created_at=tracker.created_at.isoformat() if tracker.created_at else None,
    )


@router.get(
    "/provider/capabilities",
    summary="Get voice provider capabilities",
    response_model=ProviderCapabilities,
)
def get_provider_capabilities() -> Any:
    """Get the capabilities of the currently configured voice provider."""
    from app.utils.voice import get_voice_provider
    voice = get_voice_provider()

    if not voice:
        return ProviderCapabilities(
            supports_outbound_calls=False,
            supports_transfer=False,
            supports_recording=False,
            supports_transcription=False,
            supports_real_time_analysis=False,
            provider_name="none",
        )

    # VAPI capabilities
    return ProviderCapabilities(
        supports_outbound_calls=True,
        supports_transfer=True,
        supports_recording=True,
        supports_transcription=True,
        supports_real_time_analysis=True,
        provider_name="vapi",
    )
