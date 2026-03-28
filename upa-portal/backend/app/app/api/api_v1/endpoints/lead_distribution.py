#!/usr/bin/env python

"""Lead Distribution Engine API endpoints"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db_session
from app.schemas.lead_distribution import (
    DistributeLeadRequest,
    DistributionResult,
    LeadDistributionHistory as LeadDistributionHistorySchema,
    TerritoryRotationState as TerritoryRotationStateSchema,
    VALID_LEAD_TYPES,
)
from app.crud.crud_lead_distribution import (
    lead_distribution_history as history_crud,
    territory_rotation_state as rotation_crud,
)
from app.services.lead_distribution_service import distribute_lead
from app import models

router = APIRouter()


@router.post("/distribute", response_model=DistributionResult)
def distribute(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    body: DistributeLeadRequest,
) -> Any:
    """
    Distribute a lead to agents in a territory.

    - **fire** leads: exactly ONE agent (round-robin rotation)
    - **other** leads: ALL eligible agents in the territory
    """
    if body.lead_type not in VALID_LEAD_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid lead_type '{body.lead_type}'. Must be one of: {', '.join(sorted(VALID_LEAD_TYPES))}",
        )

    try:
        result = distribute_lead(
            db_session,
            lead_id=body.lead_id,
            territory_id=body.territory_id,
            lead_type=body.lead_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Fire notification delivery for each assigned agent
    from app.core.celery_app import celery_app

    for agent_info in result["assigned_agents"]:
        celery_app.send_task(
            "app.tasks.lead_delivery.deliver_lead_assignment",
            args=[str(body.lead_id), agent_info["agent_id"], str(body.territory_id), body.lead_type],
        )

    return DistributionResult(
        lead_id=body.lead_id,
        lead_type=body.lead_type,
        territory_id=str(body.territory_id),
        assigned_agents=result["assigned_agents"],
        is_exclusive=result["is_exclusive"],
        history_ids=result["history_ids"],
        assignment_reason=result.get("assignment_reason"),
    )


@router.get("/history/lead/{lead_id}", response_model=list[LeadDistributionHistorySchema])
def get_history_by_lead(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    lead_id: UUID,
) -> Any:
    """Get distribution history for a specific lead."""
    return history_crud.get_by_lead(db_session, lead_id=lead_id)


@router.get("/history/territory/{territory_id}", response_model=list[LeadDistributionHistorySchema])
def get_history_by_territory(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    territory_id: UUID,
    lead_type: str | None = Query(default=None, description="Filter by lead type"),
) -> Any:
    """Get distribution history for a territory, optionally filtered by lead type."""
    return history_crud.get_by_territory(
        db_session, territory_id=territory_id, lead_type=lead_type,
    )


@router.get("/rotation/{territory_id}", response_model=TerritoryRotationStateSchema)
def get_rotation_state(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    territory_id: UUID,
) -> Any:
    """Get current fire lead rotation state for a territory."""
    return rotation_crud.get_or_create(db_session, territory_id=territory_id)
