#!/usr/bin/env python

"""Routes for the Lead Outcomes module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import get_service_locator
from app.core.rbac import Modules
from app.service_locator import AppServiceLocator
from app.utils.contexts import UserContext

router = APIRouter()

permissions = Permissions(Modules.LEAD_OUTCOME.value)


@router.post(
    "/{lead_id}/outcomes",
    summary="Record Lead Outcome",
    response_description="Lead outcome recorded",
    response_model=schemas.LeadOutcomeSchema,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def record_lead_outcome(
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    outcome_in: schemas.LeadOutcomeCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
) -> Any:
    """Record a new outcome for a lead."""

    UserContext.set(current_user.id)

    lead_outcome_service = service_locator.get_lead_outcome_service()
    outcome = lead_outcome_service.record_outcome(
        lead_id=lead_id,
        outcome_in=outcome_in,
        current_user=current_user,
    )

    return outcome


@router.get(
    "/{lead_id}/outcomes",
    summary="Read Lead Outcomes",
    response_description="A list of lead outcomes",
    response_model=list[schemas.LeadOutcomeSchema],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_lead_outcomes(
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all outcomes for a lead."""

    outcomes = crud.lead_outcome.get_outcomes_for_lead(db_session, lead_id=lead_id)

    return outcomes
