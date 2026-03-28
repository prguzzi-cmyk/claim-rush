#!/usr/bin/env python

"""Routes for the Fire Agencies module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.pulsepoint import fetch_pulsepoint_incidents

router = APIRouter()

permissions = Permissions(Modules.FIRE_AGENCY.value)
crud_util = CrudUtil(crud.fire_agency)


@router.get(
    "",
    summary="List Fire Agencies",
    response_description="A list of tracked PulsePoint agencies",
    response_model=CustomPage[schemas.FireAgency],
    dependencies=[Depends(permissions.read())],
)
def read_fire_agencies(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all registered PulsePoint agencies."""
    return crud.fire_agency.get_multi(db_session)


@router.get(
    "/{agency_uuid}",
    summary="Get Fire Agency",
    response_description="Fire agency data",
    response_model=schemas.FireAgency,
    dependencies=[Depends(permissions.read())],
)
def read_fire_agency(
    agency_uuid: Annotated[UUID, Path(description="The agency UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single fire agency by its UUID."""
    return crud_util.get_object_or_raise_exception(db_session, object_id=agency_uuid)


@router.post(
    "",
    summary="Create Fire Agency",
    response_description="Newly created fire agency",
    response_model=schemas.FireAgency,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_fire_agency(
    agency_in: schemas.FireAgencyCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Register a new PulsePoint agency for tracking."""
    existing = crud.fire_agency.get_by_agency_id(
        db_session, agency_id=agency_in.agency_id
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agency with ID '{agency_in.agency_id}' is already registered.",
        )
    return crud.fire_agency.create(db_session, obj_in=agency_in)


@router.put(
    "/{agency_uuid}",
    summary="Update Fire Agency",
    response_description="Updated fire agency data",
    response_model=schemas.FireAgency,
    dependencies=[Depends(permissions.update())],
)
def update_fire_agency(
    agency_uuid: Annotated[UUID, Path(description="The agency UUID.")],
    agency_in: schemas.FireAgencyUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update an existing fire agency's details."""
    db_obj = crud_util.get_object_or_raise_exception(db_session, object_id=agency_uuid)
    return crud.fire_agency.update(db_session, db_obj=db_obj, obj_in=agency_in)


@router.delete(
    "/{agency_uuid}",
    summary="Delete Fire Agency",
    response_description="Deletion confirmation",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def delete_fire_agency(
    agency_uuid: Annotated[UUID, Path(description="The agency UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Permanently remove a fire agency and all its associated incidents."""
    crud_util.get_object_or_raise_exception(db_session, object_id=agency_uuid)
    crud.fire_agency.hard_remove(db_session, obj_id=agency_uuid)
    return {"msg": "Fire agency deleted successfully."}


@router.post(
    "/{agency_uuid}/poll",
    summary="Manually Poll Agency",
    response_description="Poll result summary",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.update())],
)
def poll_fire_agency(
    agency_uuid: Annotated[UUID, Path(description="The agency UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Immediately fetch live incidents from PulsePoint for a single agency."""
    agency = crud_util.get_object_or_raise_exception(db_session, object_id=agency_uuid)

    raw = fetch_pulsepoint_incidents(agency.agency_id)
    if raw is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch data from PulsePoint. The service may be temporarily unavailable.",
        )

    active_incidents = raw.get("incidents", {}).get("active", [])
    count = crud.fire_incident.upsert_from_pulsepoint(
        db_session, agency_uuid=agency_uuid, incidents_list=active_incidents
    )
    crud.fire_agency.update_last_polled(db_session, agency_uuid=agency_uuid)

    return {"msg": f"Poll successful. {count} incident(s) processed."}
