#!/usr/bin/env python

"""API endpoints for the intelligent lead rescue system"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.services.rescue_service import RescueService

router = APIRouter()

permissions_lead = Permissions(Modules.LEAD.value)


@router.post(
    "/trigger",
    summary="Trigger Lead Rescue",
    response_description="Rescue log if rescue was executed",
    response_model=schemas.LeadRescueLogDetail | None,
    dependencies=[Depends(permissions_lead.update())],
)
def trigger_rescue(
    body: schemas.RescueLeadRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Manually trigger a rescue evaluation for a specific lead.

    If score_tier is provided, it overrides the lead's current tier for
    this rescue only.
    """
    if not crud.user.has_admin_privileges(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    # Optionally override score_tier
    if body.score_tier:
        with db_session as session:
            lead = session.get(models.Lead, body.lead_id)
            if lead:
                lead.score_tier = body.score_tier
                session.commit()

    svc = RescueService(db_session)
    log = svc.check_and_rescue_lead(body.lead_id)

    if not log:
        raise HTTPException(
            status_code=404,
            detail="Lead does not qualify for rescue or no agents available",
        )

    return _enrich_log(db_session, log)


@router.post(
    "/scan-inactive",
    summary="Scan and Rescue Inactive Leads",
    response_description="Summary of rescue scan results",
    response_model=schemas.RescueScanResponse,
    dependencies=[Depends(permissions_lead.update())],
)
def scan_inactive_leads(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Bulk scan for leads with 60+ minutes of inactivity and rescue them."""
    if not crud.user.has_admin_privileges(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    svc = RescueService(db_session)
    logs = svc.scan_inactive_leads()

    return schemas.RescueScanResponse(
        scanned=0,  # The service doesn't track scanned count separately
        rescued=len(logs),
        rescue_ids=[log.id for log in logs],
    )


@router.post(
    "/mark-converted",
    summary="Mark Rescued Lead as Converted",
    response_description="Updated rescue log with conversion flags",
    response_model=schemas.LeadRescueLogDetail,
    dependencies=[Depends(permissions_lead.update())],
)
def mark_converted(
    body: schemas.MarkRescueConvertedRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Mark a rescued lead as successfully converted.

    Sets rvp_rescue or cp_rescue bonus flags based on rescue_level.
    """
    svc = RescueService(db_session)
    log = svc.mark_rescue_converted(body.lead_id)

    if not log:
        raise HTTPException(
            status_code=404,
            detail="No rescue log found for this lead",
        )

    return _enrich_log(db_session, log)


@router.get(
    "/{lead_id}/status",
    summary="Get Lead Rescue Status",
    response_description="Rescue status for a specific lead",
    response_model=schemas.RescueStatusResponse,
    dependencies=[Depends(permissions_lead.read())],
)
def get_rescue_status(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get the rescue status for a lead, including latest rescue details."""
    with db_session as session:
        lead = session.get(models.Lead, lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

    rescue_count = crud.lead_rescue_log.count_by_lead(db_session, lead_id=lead_id)
    latest = crud.lead_rescue_log.get_latest_by_lead(db_session, lead_id=lead_id)

    latest_detail = None
    if latest:
        latest_detail = _enrich_log(db_session, latest)

    return schemas.RescueStatusResponse(
        lead_id=lead_id,
        is_rescued=bool(lead.is_rescued),
        score_tier=lead.score_tier,
        rescue_count=rescue_count,
        latest_rescue=latest_detail,
    )


@router.get(
    "/logs",
    summary="List Rescue Logs",
    response_description="Paginated rescue log history",
    response_model=list[schemas.LeadRescueLogDetail],
    dependencies=[Depends(permissions_lead.read())],
)
def list_rescue_logs(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    lead_id: Annotated[UUID | None, Query(description="Filter by lead")] = None,
    limit: int = 50,
    offset: int = 0,
) -> Any:
    """List rescue logs with optional lead_id filter."""
    if not crud.user.has_admin_privileges(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    svc = RescueService(db_session)
    logs = svc.get_rescue_logs(db_session, lead_id=lead_id, limit=limit, offset=offset)

    return [_enrich_log(db_session, log) for log in logs]


@router.get(
    "/{lead_id}/history",
    summary="Get Lead Rescue History",
    response_description="All rescue events for a lead",
    response_model=list[schemas.LeadRescueLogDetail],
    dependencies=[Depends(permissions_lead.read())],
)
def get_rescue_history(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get the full rescue history for a specific lead."""
    logs = crud.lead_rescue_log.get_by_lead(db_session, lead_id=lead_id)
    return [_enrich_log(db_session, log) for log in logs]


# ── Helpers ───────────────────────────────────────────────────────────────


def _enrich_log(
    db_session: Session,
    log: models.LeadRescueLog,
) -> schemas.LeadRescueLogDetail:
    """Add agent names to a rescue log for the response."""
    original_name = None
    new_name = None

    if log.original_agent:
        original_name = f"{log.original_agent.first_name} {log.original_agent.last_name}"
    elif log.original_agent_id:
        with db_session as session:
            agent = session.get(models.User, log.original_agent_id)
            if agent:
                original_name = f"{agent.first_name} {agent.last_name}"

    if log.new_agent:
        new_name = f"{log.new_agent.first_name} {log.new_agent.last_name}"
    elif log.new_assigned_agent_id:
        with db_session as session:
            agent = session.get(models.User, log.new_assigned_agent_id)
            if agent:
                new_name = f"{agent.first_name} {agent.last_name}"

    return schemas.LeadRescueLogDetail(
        id=log.id,
        lead_id=log.lead_id,
        tracker_id=log.tracker_id,
        original_agent_id=log.original_agent_id,
        new_assigned_agent_id=log.new_assigned_agent_id,
        rescue_reason=log.rescue_reason,
        score_tier=log.score_tier,
        rescue_level=log.rescue_level,
        escalation_level_at_rescue=log.escalation_level_at_rescue,
        notes=log.notes,
        is_converted=log.is_converted,
        rvp_rescue=log.rvp_rescue,
        cp_rescue=log.cp_rescue,
        created_at=log.created_at,
        updated_at=log.updated_at,
        original_agent_name=original_name,
        new_agent_name=new_name,
    )
