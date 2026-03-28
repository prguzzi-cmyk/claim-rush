#!/usr/bin/env python

"""Routes for the Lead Skip Trace module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import get_current_active_user, get_db_session

router = APIRouter()


@router.post(
    "/{lead_id}/skip-trace",
    summary="Run Skip Trace",
    response_description="Skip trace task queued",
    status_code=status.HTTP_202_ACCEPTED,
)
def run_skip_trace(
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Manually trigger a skip trace lookup for a lead."""
    from app.tasks.skip_trace import run_skiptrace_for_lead

    # Verify lead exists
    lead = crud.lead.get(db_session, obj_id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead {lead_id} not found.",
        )

    run_skiptrace_for_lead.delay(str(lead_id), force=True)

    return {"status": "queued", "message": "Skip trace initiated"}


@router.get(
    "/{lead_id}/skip-trace",
    summary="Get Skip Trace Results",
    response_description="Skip trace data for a lead",
    response_model=schemas.LeadSkipTraceSchema,
)
def get_skip_trace(
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve skip trace results for a lead."""
    result = crud.lead_skip_trace.get_by_lead_id(db_session, lead_id=lead_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No skip trace data for lead {lead_id}.",
        )

    return result
