#!/usr/bin/env python

"""Endpoints for viewing and resending communications for a lead."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules

router = APIRouter()

permissions_comm = Permissions(Modules.COMMUNICATION_LOG.value)


@router.get(
    "/{lead_id}/communications",
    summary="Get communications for a lead",
    response_model=list[schemas.CommunicationLogSchema],
    dependencies=[Depends(permissions_comm.read())],
)
def get_lead_communications(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
    channel: str | None = Query(default=None, description="Filter by channel: email or sms"),
) -> Any:
    """Retrieve all communication logs for a specific lead."""
    return crud.communication_log.get_by_lead(
        db_session, lead_id=lead_id, channel=channel,
    )


@router.post(
    "/{lead_id}/communications/resend",
    summary="Resend a communication",
    response_model=schemas.CommunicationLogSchema,
    dependencies=[Depends(permissions_comm.create())],
)
def resend_communication(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """Resend communications for a lead with manual_override=True."""
    from app.services.communication_service import CommunicationService

    service = CommunicationService(db_session)

    # Get the most recent delivered email for this lead
    logs = crud.communication_log.get_by_lead(db_session, lead_id=lead_id, channel="email")
    if not logs:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No previous communication found for this lead.",
        )

    original = logs[0]

    log = service.send_tracked_email(
        lead_id=str(lead_id),
        agent_id=str(original.agent_id) if original.agent_id else None,
        recipient_email=original.recipient_email,
        subject=original.subject or "Resend",
        body_html=f"<p>This is a resend of a previous communication.</p>",
        body_plain="This is a resend of a previous communication.",
        purpose=original.purpose,
        template_type=original.template_type,
        manual_override=True,
    )

    return log
