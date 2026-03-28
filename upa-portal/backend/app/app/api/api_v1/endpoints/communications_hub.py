#!/usr/bin/env python

"""Communications Hub — unified dashboard, send actions, templates, and voice scripts."""

from datetime import date, datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.models.communication_log import CommunicationLog

router = APIRouter()

permissions_comm = Permissions(Modules.COMMUNICATION_LOG.value)


# ---------------------------------------------------------------------------
# Request / Response schemas local to this router
# ---------------------------------------------------------------------------

class DashboardMetrics(BaseModel):
    messages_sent_today: int = 0
    calls_placed_today: int = 0
    response_rate: float = 0.0
    appointments_created: int = 0


class SendSmsRequest(BaseModel):
    lead_ids: list[UUID] = Field(description="List of lead IDs to send SMS to")
    template_id: UUID | None = Field(default=None, description="Optional template ID")
    message: str | None = Field(default=None, description="SMS message body")


class SendEmailRequest(BaseModel):
    lead_ids: list[UUID] = Field(description="List of lead IDs to send email to")
    template_id: UUID | None = Field(default=None, description="Optional template ID")
    subject: str | None = Field(default=None, description="Email subject")
    message: str | None = Field(default=None, description="Email body")


class SendVoiceRequest(BaseModel):
    lead_ids: list[UUID] = Field(description="List of lead IDs to call")
    script_id: UUID | None = Field(default=None, description="Voice script ID to use")
    notes: str | None = Field(default=None, description="Additional notes for the call")


class SkipTraceRequest(BaseModel):
    lead_ids: list[UUID] = Field(description="List of lead IDs to skip trace")


class SendResponse(BaseModel):
    created_count: int
    communication_log_ids: list[UUID]


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get(
    "/dashboard",
    summary="Communications Hub dashboard metrics",
    response_model=DashboardMetrics,
    dependencies=[Depends(permissions_comm.read())],
)
def get_dashboard(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Return aggregate metrics for today's communications."""
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)

    with db_session as session:
        # Messages sent today (email + sms)
        messages_sent = session.scalar(
            select(func.count())
            .select_from(CommunicationLog)
            .where(
                CommunicationLog.created_at >= today_start,
                CommunicationLog.channel.in_(["email", "sms"]),
                CommunicationLog.send_status.in_(["sent", "delivered"]),
            )
        ) or 0

        # Calls today
        calls_today = session.scalar(
            select(func.count())
            .select_from(CommunicationLog)
            .where(
                CommunicationLog.created_at >= today_start,
                CommunicationLog.channel == "voice",
            )
        ) or 0

        # Response rate: delivered messages that were opened / total delivered today
        total_delivered = session.scalar(
            select(func.count())
            .select_from(CommunicationLog)
            .where(
                CommunicationLog.created_at >= today_start,
                CommunicationLog.send_status == "delivered",
            )
        ) or 0

        total_opened = session.scalar(
            select(func.count())
            .select_from(CommunicationLog)
            .where(
                CommunicationLog.created_at >= today_start,
                CommunicationLog.opened_at.isnot(None),
            )
        ) or 0

        response_rate = round((total_opened / total_delivered * 100), 1) if total_delivered > 0 else 0.0

        # Appointments created today (purpose = appointment_confirmation)
        appointments = session.scalar(
            select(func.count())
            .select_from(CommunicationLog)
            .where(
                CommunicationLog.created_at >= today_start,
                CommunicationLog.purpose == "appointment_confirmation",
            )
        ) or 0

    return DashboardMetrics(
        messages_sent_today=messages_sent,
        calls_placed_today=calls_today,
        response_rate=response_rate,
        appointments_created=appointments,
    )


# ---------------------------------------------------------------------------
# Communication Logs
# ---------------------------------------------------------------------------

@router.get(
    "/communications",
    summary="List all communication logs with filters",
    response_model=list[schemas.CommunicationLogSchema],
    dependencies=[Depends(permissions_comm.read())],
)
def list_communications(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
    channel: str | None = Query(default=None, description="Filter by channel: email, sms, voice"),
    send_status: str | None = Query(default=None, alias="status", description="Filter by send status"),
    lead_id: UUID | None = Query(default=None, description="Filter by lead ID"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> Any:
    """List communication logs with optional filters and pagination."""
    with db_session as session:
        stmt = (
            select(CommunicationLog)
            .where(CommunicationLog.send_status != "__deleted__")
            .order_by(CommunicationLog.created_at.desc())
        )

        if channel:
            stmt = stmt.where(CommunicationLog.channel == channel)
        if send_status:
            stmt = stmt.where(CommunicationLog.send_status == send_status)
        if lead_id:
            stmt = stmt.where(CommunicationLog.lead_id == lead_id)

        stmt = stmt.offset(skip).limit(limit)
        return list(session.scalars(stmt).all())


@router.get(
    "/communications/{lead_id}/thread",
    summary="Get conversation thread for a lead",
    response_model=list[schemas.CommunicationLogSchema],
    dependencies=[Depends(permissions_comm.read())],
)
def get_lead_thread(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Get all communications for a lead sorted chronologically."""
    with db_session as session:
        stmt = (
            select(CommunicationLog)
            .where(CommunicationLog.lead_id == lead_id)
            .order_by(CommunicationLog.created_at.asc())
        )
        return list(session.scalars(stmt).all())


# ---------------------------------------------------------------------------
# Send Actions
# ---------------------------------------------------------------------------

@router.post(
    "/send/sms",
    summary="Send SMS to leads",
    response_model=SendResponse,
    dependencies=[Depends(permissions_comm.create())],
)
def send_sms(
    payload: SendSmsRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Create pending SMS communication log entries for each lead. Celery handles actual delivery."""
    from app.services.upa_outreach_service import is_contact_suppressed, is_outreach_paused

    if is_outreach_paused(db_session):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Outreach is currently paused by admin.")

    created_ids: list[UUID] = []
    for lead_id in payload.lead_ids:
        lead = db_session.get(crud.lead.model, lead_id)
        if lead and hasattr(lead, "contact") and is_contact_suppressed(lead.contact, "sms"):
            continue  # Skip opted-out contacts

        log_in = schemas.CommunicationLogCreate(
            lead_id=lead_id,
            agent_id=current_user.id,
            channel="sms",
            purpose="communications_hub",
            direction="outbound",
            template_type=str(payload.template_id) if payload.template_id else None,
            body_preview=payload.message[:500] if payload.message else None,
            send_status="pending",
        )
        log = crud.communication_log.create(db_session, obj_in=log_in)
        created_ids.append(log.id)

    return SendResponse(created_count=len(created_ids), communication_log_ids=created_ids)


@router.post(
    "/send/email",
    summary="Send email to leads",
    response_model=SendResponse,
    dependencies=[Depends(permissions_comm.create())],
)
def send_email(
    payload: SendEmailRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Create pending email communication log entries for each lead. Celery handles actual delivery."""
    from app.services.upa_outreach_service import is_contact_suppressed, is_outreach_paused

    if is_outreach_paused(db_session):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Outreach is currently paused by admin.")

    created_ids: list[UUID] = []
    for lead_id in payload.lead_ids:
        lead = db_session.get(crud.lead.model, lead_id)
        if lead and hasattr(lead, "contact") and is_contact_suppressed(lead.contact, "email"):
            continue  # Skip opted-out contacts

        log_in = schemas.CommunicationLogCreate(
            lead_id=lead_id,
            agent_id=current_user.id,
            channel="email",
            purpose="communications_hub",
            direction="outbound",
            template_type=str(payload.template_id) if payload.template_id else None,
            subject=payload.subject,
            body_preview=payload.message[:500] if payload.message else None,
            send_status="pending",
        )
        log = crud.communication_log.create(db_session, obj_in=log_in)
        created_ids.append(log.id)

    return SendResponse(created_count=len(created_ids), communication_log_ids=created_ids)


@router.post(
    "/send/voice",
    summary="Initiate AI voice calls to leads",
    response_model=SendResponse,
    dependencies=[Depends(permissions_comm.create())],
)
def send_voice(
    payload: SendVoiceRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Create pending voice communication log entries for each lead. Celery handles actual delivery."""
    # Validate that the voice script exists if provided
    if payload.script_id:
        script = crud.voice_script.get(db_session, obj_id=payload.script_id)
        if not script:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Voice script not found.",
            )

    created_ids: list[UUID] = []
    for lead_id in payload.lead_ids:
        log_in = schemas.CommunicationLogCreate(
            lead_id=lead_id,
            agent_id=current_user.id,
            channel="voice",
            purpose="communications_hub",
            direction="outbound",
            template_type=str(payload.script_id),
            body_preview=payload.notes[:500] if payload.notes else None,
            send_status="pending",
        )
        log = crud.communication_log.create(db_session, obj_in=log_in)
        created_ids.append(log.id)

    return SendResponse(created_count=len(created_ids), communication_log_ids=created_ids)


@router.post(
    "/skip-trace",
    summary="Trigger skip trace for leads",
    response_model=SendResponse,
    dependencies=[Depends(permissions_comm.create())],
)
def trigger_skip_trace(
    payload: SkipTraceRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Create pending skip-trace communication log entries for each lead. Celery handles actual processing."""
    created_ids: list[UUID] = []
    for lead_id in payload.lead_ids:
        log_in = schemas.CommunicationLogCreate(
            lead_id=lead_id,
            agent_id=current_user.id,
            channel="sms",
            purpose="skip_trace",
            direction="outbound",
            send_status="pending",
        )
        log = crud.communication_log.create(db_session, obj_in=log_in)
        created_ids.append(log.id)

    return SendResponse(created_count=len(created_ids), communication_log_ids=created_ids)


# ---------------------------------------------------------------------------
# Message Templates CRUD
# ---------------------------------------------------------------------------

@router.get(
    "/templates",
    summary="List message templates",
    response_model=list[schemas.MessageTemplate],
    dependencies=[Depends(permissions_comm.read())],
)
def list_templates(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
    category: str | None = Query(default=None, description="Filter by category"),
) -> Any:
    """List all message templates, optionally filtered by category."""
    if category:
        return crud.message_template.get_by_category(db_session, category=category)
    return crud.message_template.get_active_templates(db_session)


@router.post(
    "/templates",
    summary="Create message template",
    response_model=schemas.MessageTemplate,
    dependencies=[Depends(permissions_comm.create())],
)
def create_template(
    payload: schemas.MessageTemplateCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Create a new message template."""
    payload.created_by_id = current_user.id
    return crud.message_template.create(db_session, obj_in=payload)


@router.put(
    "/templates/{template_id}",
    summary="Update message template",
    response_model=schemas.MessageTemplate,
    dependencies=[Depends(permissions_comm.update())],
)
def update_template(
    template_id: UUID,
    payload: schemas.MessageTemplateUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Update an existing message template."""
    db_obj = crud.message_template.get(db_session, obj_id=template_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found.",
        )
    return crud.message_template.update(db_session, db_obj=db_obj, obj_in=payload)


@router.delete(
    "/templates/{template_id}",
    summary="Soft delete message template",
    response_model=schemas.MessageTemplate,
    dependencies=[Depends(permissions_comm.remove())],
)
def delete_template(
    template_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Soft delete a message template."""
    db_obj = crud.message_template.remove(db_session, obj_id=template_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found.",
        )
    return db_obj


# ---------------------------------------------------------------------------
# Voice Scripts CRUD
# ---------------------------------------------------------------------------

@router.get(
    "/voice-scripts",
    summary="List voice scripts",
    response_model=list[schemas.VoiceScript],
    dependencies=[Depends(permissions_comm.read())],
)
def list_voice_scripts(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
    category: str | None = Query(default=None, description="Filter by category"),
) -> Any:
    """List all voice scripts, optionally filtered by category."""
    if category:
        return crud.voice_script.get_by_category(db_session, category=category)
    return crud.voice_script.get_active_scripts(db_session)


@router.post(
    "/voice-scripts",
    summary="Create voice script",
    response_model=schemas.VoiceScript,
    dependencies=[Depends(permissions_comm.create())],
)
def create_voice_script(
    payload: schemas.VoiceScriptCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Create a new voice script."""
    payload.created_by_id = current_user.id
    return crud.voice_script.create(db_session, obj_in=payload)


@router.put(
    "/voice-scripts/{script_id}",
    summary="Update voice script",
    response_model=schemas.VoiceScript,
    dependencies=[Depends(permissions_comm.update())],
)
def update_voice_script(
    script_id: UUID,
    payload: schemas.VoiceScriptUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Update an existing voice script."""
    db_obj = crud.voice_script.get(db_session, obj_id=script_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Voice script not found.",
        )
    return crud.voice_script.update(db_session, db_obj=db_obj, obj_in=payload)


@router.delete(
    "/voice-scripts/{script_id}",
    summary="Soft delete voice script",
    response_model=schemas.VoiceScript,
    dependencies=[Depends(permissions_comm.remove())],
)
def delete_voice_script(
    script_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Soft delete a voice script."""
    db_obj = crud.voice_script.remove(db_session, obj_id=script_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Voice script not found.",
        )
    return db_obj
