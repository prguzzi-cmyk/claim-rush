#!/usr/bin/env python

"""Admin endpoints for lead contact escalation management"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.services.escalation_service import EscalationService

router = APIRouter()

permissions_lead = Permissions(Modules.LEAD.value)


@router.get(
    "/{lead_id}/status",
    summary="Get Escalation Status",
    response_description="Current escalation state + full attempt history",
    response_model=schemas.EscalationStatusResponse,
    dependencies=[Depends(permissions_lead.read())],
)
def get_escalation_status(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get the current escalation status for a lead, including all attempts."""
    if not crud.user.has_admin_privileges(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    tracker = crud.lead_contact_tracker.get_by_lead(db_session, lead_id=lead_id)
    if not tracker:
        raise HTTPException(status_code=404, detail="No escalation tracker found for this lead")

    attempts = crud.escalation_attempt.get_by_tracker(
        db_session, tracker_id=tracker.id,
    )

    agent_name = None
    if tracker.current_agent:
        agent_name = f"{tracker.current_agent.first_name} {tracker.current_agent.last_name}"

    return schemas.EscalationStatusResponse(
        tracker=tracker,
        attempts=attempts,
        current_agent_name=agent_name,
    )


@router.get(
    "/active",
    summary="List Active Escalations",
    response_description="All unresolved escalation trackers",
    response_model=list[schemas.ActiveEscalationSummary],
    dependencies=[Depends(permissions_lead.read())],
)
def list_active_escalations(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    limit: int = 50,
    offset: int = 0,
) -> Any:
    """List all currently active (unresolved) escalation trackers."""
    if not crud.user.has_admin_privileges(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    trackers = crud.lead_contact_tracker.get_active(
        db_session, limit=limit, offset=offset,
    )

    results = []
    for t in trackers:
        agent_name = None
        if t.current_agent:
            agent_name = f"{t.current_agent.first_name} {t.current_agent.last_name}"
        results.append(
            schemas.ActiveEscalationSummary(
                id=t.id,
                lead_id=t.lead_id,
                lead_type=t.lead_type,
                contact_status=t.contact_status,
                current_escalation_level=t.current_escalation_level,
                current_agent_name=agent_name,
                escalation_started_at=t.escalation_started_at,
                created_at=t.created_at,
            )
        )
    return results


@router.post(
    "/{tracker_id}/resolve",
    summary="Manually Resolve Escalation",
    response_description="Resolved tracker",
    response_model=schemas.LeadContactTrackerSchema,
    dependencies=[Depends(permissions_lead.update())],
)
def manually_resolve(
    tracker_id: UUID,
    resolution_type: str = "manual_close",
    db_session: Annotated[Session, Depends(get_db_session)] = None,
    current_user: Annotated[models.User, Depends(get_current_active_user)] = None,
) -> Any:
    """Manually resolve an active escalation."""
    if not crud.user.has_admin_privileges(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    svc = EscalationService(db_session)
    svc.mark_resolved(tracker_id, resolution_type)

    tracker = crud.lead_contact_tracker.get(db_session, id=tracker_id)
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracker not found")

    return tracker
