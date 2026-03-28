#!/usr/bin/env python

"""Routes for the Leads module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_db_session
from app.core.rbac import Modules

router = APIRouter()

permissions = Permissions(Modules.LEAD.value)


@router.get(
    "",
    summary="Read Leads",
    response_description="A list of leads",
    response_model=list[schemas.Lead],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_leads(
    *,
    skip: Annotated[int, Query(description="Number of records to skip")] = 0,
    limit: Annotated[int, Query(description="Number of records to fetch")] = 100,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all leads"""
    leads_list = crud.lead.get_multi(db_session, skip=skip, limit=limit)

    return leads_list


@router.get(
    "/{lead_id}",
    summary="Read Lead By Id",
    response_description="Lead data",
    response_model=schemas.Lead,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_lead_by_id(
    lead_id: Annotated[UUID, Path(description="The lead id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a lead by an id"""
    lead = crud.lead.get(db_session, obj_id=lead_id)

    # If there is no lead
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found"
        )

    return lead


@router.post(
    "",
    summary="Create Lead",
    response_description="Lead created",
    response_model=schemas.Lead,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_lead(
    lead_in: schemas.LeadCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Create a new lead"""
    lead = crud.lead.create(db_session, obj_in=lead_in)

    return lead


@router.put(
    "/{lead_id}",
    summary="Update Lead",
    response_description="Updated lead data",
    response_model=schemas.Lead,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_lead(
    lead_id: Annotated[UUID, Path(description="The lead id")],
    lead_in: schemas.LeadUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Update a lead via an ID"""
    lead = crud.lead.get(db_session, obj_id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The lead with this id does not exist in the system",
        )

    lead = crud.lead.update(db_session, db_obj=lead, obj_in=lead_in)

    return lead


@router.post(
    "/{lead_id}/follow-up",
    summary="Create Follow-up",
    response_description="Follow-up created",
    response_model=schemas.FollowUp,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_lead_follow_up(
    lead_id: Annotated[UUID, Path(description="The lead id")],
    follow_up_in: schemas.FollowUpCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Create a new follow-up"""
    follow_up = crud.follow_up.create(db_session, lead_id=lead_id, obj_in=follow_up_in)

    return follow_up


@router.put(
    "/{lead_id}/follow-up/{follow_up_id}",
    summary="Update Follow-up",
    response_description="Updated follow-up data",
    response_model=schemas.FollowUp,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_follow_up(
    lead_id: Annotated[UUID, Path(description="The lead id")],
    follow_up_id: Annotated[UUID, Path(description="The follow-up id")],
    follow_up_in: schemas.FollowUpUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Update a follow-up via an ID"""
    lead = crud.lead.get(db_session, obj_id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The lead with this id does not exist in the system",
        )

    follow_up = crud.follow_up.get(db_session, obj_id=follow_up_id)
    if not follow_up:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Follow-up with this id does not exist in the system",
        )

    follow_up = crud.follow_up.update(db_session, db_obj=follow_up, obj_in=follow_up_in)

    return follow_up


@router.delete(
    "/{lead_id}",
    summary="Remove Lead",
    response_description="Lead removed",
    response_model=schemas.Lead,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_lead(
    lead_id: Annotated[UUID, Path(description="The lead id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a lead by providing an ID"""
    lead = crud.lead.get(db_session, obj_id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The lead with this id does not exist in the system",
        )

    lead = crud.lead.remove(db_session, obj_id=lead_id)

    return lead


@router.delete(
    "/{lead_id}/follow-up/{follow_up_id}",
    summary="Remove Follow-up",
    response_description="Follow-up removed",
    response_model=schemas.FollowUp,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_follow_up(
    lead_id: Annotated[UUID, Path(description="The lead id")],
    follow_up_id: Annotated[UUID, Path(description="The follow-up id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a follow-up by providing an ID"""
    lead = crud.lead.get(db_session, obj_id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The lead with this id does not exist in the system",
        )

    follow_up = crud.follow_up.get(db_session, obj_id=follow_up_id)
    if not follow_up:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Follow-up with this id does not exist in the system",
        )

    follow_up = crud.follow_up.remove(db_session, obj_id=follow_up_id)

    return follow_up
