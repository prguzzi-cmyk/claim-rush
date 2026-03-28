#!/usr/bin/env python

"""API endpoints for the Lead Rotation Engine."""

import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.services.rotation_lead_service import RotationLeadService

logger = logging.getLogger(__name__)

router = APIRouter()
permissions = Permissions(Modules.ROTATION_LEAD.value)


@router.post(
    "",
    summary="Create Rotation Lead",
    response_description="Newly created rotation lead (auto-assigned if possible)",
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_rotation_lead(
    lead_in: schemas.RotationLeadCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a rotation lead and trigger auto-assignment.

    Returns the lead with assigned_agent_id and assigned_agent_name.
    Assignment always succeeds via fallback cascade.
    """
    try:
        service = RotationLeadService(db_session)
        lead = service.create_lead_with_auto_assign(
            lead_data=lead_in,
            created_by_id=current_user.id,
        )
    except Exception as exc:
        logger.error(
            "[RotationLead] Creation failed: state=%s zip=%s error=%s",
            lead_in.property_state, lead_in.property_zip, exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create rotation lead: {exc}",
        )

    # Build response with agent name for the frontend
    agent_name = None
    if lead.assigned_agent_id:
        agent = db_session.get(models.User, lead.assigned_agent_id)
        if agent:
            agent_name = f"{agent.first_name} {agent.last_name}".strip()

    # Serialize via schema then add agent info
    from app.schemas.rotation_lead import RotationLead as RotationLeadOut
    result = RotationLeadOut.from_orm(lead).dict()
    result["assigned_agent"] = {
        "id": str(lead.assigned_agent_id) if lead.assigned_agent_id else None,
        "full_name": agent_name,
    }
    result["distributed"] = lead.assigned_agent_id is not None

    logger.info(
        "[RotationLead] Response: lead=%s agent=%s distributed=%s",
        lead.id, agent_name or "none", result["distributed"],
    )

    return result


@router.get(
    "",
    summary="List Rotation Leads",
    response_description="Paginated list of rotation leads",
    response_model=list[schemas.RotationLeadSchema],
    dependencies=[Depends(permissions.read())],
)
def list_rotation_leads(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    lead_status: Annotated[str | None, Query(description="Filter by status")] = None,
    agent_id: Annotated[str | None, Query(description="Filter by assigned agent")] = None,
    incident_type: Annotated[str | None, Query(description="Filter by incident type")] = None,
) -> Any:
    """Retrieve rotation leads with optional filters."""
    if lead_status:
        return crud.rotation_lead.get_by_status(db_session, status=lead_status)

    filters = []
    from app.models.rotation_lead import RotationLead as RL

    if agent_id:
        filters.append(RL.assigned_agent_id == UUID(agent_id))
    if incident_type:
        filters.append(RL.incident_type == incident_type)

    return crud.rotation_lead.get_multi(
        db_session,
        filters=filters if filters else None,
        order_by=[RL.created_at.desc()],
        paginated=False,
    )


@router.get(
    "/metrics",
    summary="Rotation Lead Metrics",
    response_description="Aggregated performance metrics",
    response_model=schemas.RotationLeadMetrics,
    dependencies=[Depends(permissions.read())],
)
def get_rotation_lead_metrics(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return aggregated rotation lead metrics."""
    service = RotationLeadService(db_session)
    return service.get_metrics()


@router.get(
    "/{lead_id}",
    summary="Get Rotation Lead Detail",
    response_description="Lead detail with activity timeline",
    response_model=schemas.RotationLeadDetail,
    dependencies=[Depends(permissions.read())],
)
def get_rotation_lead(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single rotation lead with its activity timeline."""
    lead = crud.rotation_lead.get_with_activities(db_session, obj_id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rotation lead not found.",
        )
    return lead


@router.patch(
    "/{lead_id}",
    summary="Update Rotation Lead",
    response_description="Updated rotation lead",
    response_model=schemas.RotationLeadSchema,
    dependencies=[Depends(permissions.update())],
)
def update_rotation_lead(
    lead_id: UUID,
    lead_in: schemas.RotationLeadUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update status, outcome, or notes on a rotation lead."""
    lead = crud.rotation_lead.get(db_session, obj_id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rotation lead not found.",
        )

    # If status is changing, log activity
    update_data = lead_in.dict(exclude_unset=True)
    if "lead_status" in update_data and update_data["lead_status"] != lead.lead_status:
        service = RotationLeadService(db_session)
        return service.update_lead_status(
            lead_id=lead_id,
            new_status=update_data["lead_status"],
            user_id=current_user.id,
        )

    return crud.rotation_lead.update(db_session, db_obj=lead, obj_in=lead_in)


@router.post(
    "/{lead_id}/contact",
    summary="Record Contact Attempt",
    response_description="Updated lead after contact attempt",
    response_model=schemas.RotationLeadSchema,
    dependencies=[Depends(permissions.update())],
)
def record_contact_attempt(
    lead_id: UUID,
    body: schemas.ContactAttemptRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Record a contact attempt on a rotation lead."""
    service = RotationLeadService(db_session)
    try:
        return service.record_contact_attempt(
            lead_id=lead_id,
            outcome=body.outcome,
            notes=body.notes,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post(
    "/{lead_id}/reassign",
    summary="Reassign Rotation Lead",
    response_description="Reassigned rotation lead",
    response_model=schemas.RotationLeadSchema,
    dependencies=[Depends(permissions.update())],
)
def reassign_rotation_lead(
    lead_id: UUID,
    body: schemas.ReassignRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Manually reassign a rotation lead to a different agent."""
    service = RotationLeadService(db_session)
    try:
        return service.reassign_lead(
            lead_id=lead_id,
            new_agent_id=body.new_agent_id,
            reason=body.reason,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
