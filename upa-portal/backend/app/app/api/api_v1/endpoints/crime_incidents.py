#!/usr/bin/env python

"""Routes for the Crime Incidents module"""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.schemas.crime_incident import CrimeIncident, CrimeIncidentListResponse

router = APIRouter()

permissions = Permissions(Modules.CRIME_INCIDENT.value)


@router.get(
    "",
    summary="List Crime Incidents",
    response_description="Paginated list of crime incidents",
    response_model=CrimeIncidentListResponse,
    dependencies=[Depends(permissions.read())],
)
def read_crime_incidents(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    incident_type: str | None = Query(None, description="Filter by incident type"),
    severity: str | None = Query(None, description="Filter by severity"),
    city: str | None = Query(None, description="Filter by city"),
    state: str | None = Query(None, description="Filter by state code"),
    date_from: datetime | None = Query(None, description="Filter from date"),
    date_to: datetime | None = Query(None, description="Filter to date"),
    is_mock: bool | None = Query(None, description="Filter by mock status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=500, description="Max records to return"),
) -> Any:
    """Retrieve crime incidents with optional filters."""
    items, total = crud.crime_incident.get_filtered(
        db_session,
        skip=skip,
        limit=limit,
        incident_type=incident_type,
        severity=severity,
        city=city,
        state=state,
        date_from=date_from,
        date_to=date_to,
        is_mock=is_mock,
    )
    return {"items": items, "total": total}


@router.get(
    "/stats",
    summary="Crime Incident Stats",
    response_description="Aggregate crime incident statistics",
    dependencies=[Depends(permissions.read())],
)
def read_crime_incident_stats(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get aggregate crime incident counts: total, by_type, by_severity, by_source."""
    return crud.crime_incident.get_stats(db_session)


@router.get(
    "/{incident_id}",
    summary="Get Crime Incident",
    response_description="Crime incident detail",
    response_model=CrimeIncident,
    dependencies=[Depends(permissions.read())],
)
def read_crime_incident(
    incident_id: Annotated[UUID, Path(description="The crime incident UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single crime incident by UUID."""
    from app.utils.exceptions import CrudUtil
    crud_util = CrudUtil(crud.crime_incident)
    return crud_util.get_object_or_raise_exception(db_session, object_id=incident_id)
