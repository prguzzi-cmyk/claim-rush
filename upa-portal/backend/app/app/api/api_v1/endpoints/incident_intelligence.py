#!/usr/bin/env python

"""Routes for the Incident Intelligence Data Engine"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.schemas.incident_intelligence import (
    Incident,
    IncidentConvertToLeadRequest,
    IncidentConvertToLeadResponse,
    IncidentDashboardMetrics,
    IncidentIngestRequest,
    IncidentIngestResponse,
    IncidentMapPoint,
)
from app.services.incident_intelligence_service import IncidentIntelligenceService
from app.utils.pagination import CustomPage

router = APIRouter()

permissions = Permissions(Modules.INCIDENT_INTELLIGENCE.value)


@router.get(
    "",
    summary="List Incidents",
    response_description="Paginated list of unified incidents",
    response_model=CustomPage[Incident],
    dependencies=[Depends(permissions.read())],
)
def list_incidents(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    incident_type: Annotated[str | None, Query(description="Filter: fire, storm, crime, weather")] = None,
    state: Annotated[str | None, Query(description="Two-letter state code")] = None,
    severity: Annotated[str | None, Query(description="low, moderate, high, severe, extreme")] = None,
    is_active: Annotated[bool | None, Query(description="Active status filter")] = None,
    lead_converted: Annotated[bool | None, Query(description="Filter by conversion status")] = None,
) -> Any:
    """Retrieve all incidents with optional filtering."""
    from app.models.incident import Incident as IncidentModel

    filters = []
    if incident_type:
        if "," in incident_type:
            types = [t.strip() for t in incident_type.split(",") if t.strip()]
            filters.append(IncidentModel.incident_type.in_(types))
        else:
            filters.append(IncidentModel.incident_type == incident_type)
    if state:
        filters.append(IncidentModel.state == state.upper())
    if severity:
        filters.append(IncidentModel.severity == severity)
    if is_active is not None:
        filters.append(IncidentModel.is_active.is_(is_active))
    if lead_converted is not None:
        filters.append(IncidentModel.lead_converted.is_(lead_converted))

    return crud.incident.get_multi(
        db_session,
        filters=filters if filters else None,
        order_by=[IncidentModel.priority_score.desc()],
    )


@router.get(
    "/dashboard",
    summary="Incident Intelligence Dashboard Metrics",
    response_description="Aggregate metrics for the intelligence dashboard",
    response_model=IncidentDashboardMetrics,
    dependencies=[Depends(permissions.read())],
)
def get_dashboard_metrics(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return dashboard metrics: incidents today, leads generated, conversion rate, top priority."""
    return crud.incident.get_dashboard_counts(db_session)


@router.get(
    "/map",
    summary="Incident Map Points",
    response_description="Incidents with coordinates for map rendering",
    response_model=list[IncidentMapPoint],
    dependencies=[Depends(permissions.read())],
)
def get_map_points(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    incident_type: Annotated[str | None, Query(description="Filter by incident type")] = None,
    hours: Annotated[int, Query(description="Lookback window in hours", ge=1, le=720)] = 168,
) -> Any:
    """Return incidents with lat/lng for Command Center map overlay."""
    return crud.incident.get_map_points(
        db_session,
        incident_type=incident_type,
        hours=hours,
    )


@router.get(
    "/{incident_id}",
    summary="Get Incident Detail",
    response_description="Single incident record",
    response_model=Incident,
    dependencies=[Depends(permissions.read())],
)
def get_incident(
    incident_id: Annotated[UUID, Path(description="Incident UUID")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single incident by UUID."""
    result = crud.incident.get(db_session, obj_id=incident_id)
    if not result:
        raise HTTPException(status_code=404, detail="Incident not found")
    return result


@router.post(
    "/ingest",
    summary="Batch Ingest Incidents",
    response_description="Ingestion results summary",
    response_model=IncidentIngestResponse,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def ingest_incidents(
    body: IncidentIngestRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """
    Batch ingest incidents from external sources.

    Automatically detects duplicates and assigns priority scores.
    """
    service = IncidentIntelligenceService(db_session)
    return service.ingest_batch(body.incidents)


@router.post(
    "/{incident_id}/convert-to-lead",
    summary="Convert Incident to Lead",
    response_description="Conversion result with lead ID",
    response_model=IncidentConvertToLeadResponse,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def convert_to_lead(
    incident_id: Annotated[UUID, Path(description="Incident UUID to convert")],
    body: IncidentConvertToLeadRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Manually convert an incident to a lead with contact info."""
    service = IncidentIntelligenceService(db_session)
    try:
        return service.convert_single_incident(
            incident_id=incident_id,
            full_name=body.full_name,
            phone_number=body.phone_number,
            email=body.email,
            assigned_to=body.assigned_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post(
    "/sync",
    summary="Sync All Sources",
    response_description="Sync results by source type",
    dependencies=[Depends(permissions.create())],
)
def sync_all_sources(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """
    Pull fire incidents, crime incidents, and storm events into the unified
    incident table. Runs duplicate detection and priority scoring.
    """
    service = IncidentIntelligenceService(db_session)
    return service.sync_all_sources()


@router.post(
    "/auto-convert",
    summary="Auto-Convert Qualifying Incidents",
    response_description="Number of leads created",
    dependencies=[Depends(permissions.create())],
)
def auto_convert(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Scan recent incidents and auto-convert those above the threshold to leads."""
    service = IncidentIntelligenceService(db_session)
    leads_created = service.auto_convert_qualifying_incidents()
    return {"leads_created": leads_created}
