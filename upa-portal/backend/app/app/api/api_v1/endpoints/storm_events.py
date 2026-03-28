#!/usr/bin/env python

"""Routes for the Storm Events module"""

import json
import logging
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.utils.zip_boundaries import get_zip_boundaries
from app.utils.osm_properties import get_properties_in_radius
from app.utils.roof_analysis import analyze_single_roof
from app.utils.territory_filter import get_storm_event_territory_filters

logger = logging.getLogger(__name__)

router = APIRouter()

permissions = Permissions(Modules.STORM_EVENT.value)
outreach_permissions = Permissions(Modules.STORM_OUTREACH_BATCH.value)


@router.get(
    "",
    summary="List Storm Events",
    response_description="Filtered list of storm events (unpaginated for map rendering)",
    response_model=list[schemas.storm_event.StormEvent],
    dependencies=[Depends(permissions.read())],
)
def read_storm_events(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    date_range: Annotated[str | None, Query(description="24h, 3d, or 7d")] = "7d",
    event_type: Annotated[str | None, Query(description="Comma-separated: hail,wind,hurricane,lightning")] = None,
    state: Annotated[str | None, Query(description="Two-letter state code")] = None,
    county: Annotated[str | None, Query(description="County name (partial match)")] = None,
    min_severity: Annotated[str | None, Query(description="low, moderate, high, severe, extreme")] = None,
) -> Any:
    """Retrieve storm events with optional filtering. Returns all matching events (no pagination)."""
    territory_filters = get_storm_event_territory_filters(db_session, current_user)
    return crud.storm_event.get_filtered(
        db_session,
        date_range=date_range,
        event_type=event_type,
        state=state,
        county=county,
        min_severity=min_severity,
        territory_filters=territory_filters,
    )


@router.get(
    "/target-areas",
    summary="Get Storm Target Areas",
    response_description="Aggregated target areas ranked by risk",
    response_model=list[schemas.storm_event.StormTargetAreaResponse],
    dependencies=[Depends(permissions.read())],
)
def read_target_areas(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    date_range: Annotated[str | None, Query(description="24h, 3d, or 7d")] = "7d",
    event_type: Annotated[str | None, Query(description="Comma-separated event types")] = None,
    state: Annotated[str | None, Query(description="Two-letter state code")] = None,
    county: Annotated[str | None, Query(description="County name")] = None,
) -> Any:
    """Aggregate events by county/state, compute risk scores, and return ranked target areas."""
    territory_filters = get_storm_event_territory_filters(db_session, current_user)
    return crud.storm_event.get_target_areas(
        db_session,
        date_range=date_range,
        event_type=event_type,
        state=state,
        county=county,
        territory_filters=territory_filters,
    )


@router.get(
    "/states",
    summary="Get Distinct States",
    response_description="List of state abbreviations that have storm events",
    response_model=list[str],
    dependencies=[Depends(permissions.read())],
)
def read_states(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return sorted list of distinct state values from storm events."""
    return crud.storm_event.get_distinct_states(db_session)


@router.get(
    "/counties",
    summary="Get Distinct Counties",
    response_description="List of county names, optionally filtered by state",
    response_model=list[str],
    dependencies=[Depends(permissions.read())],
)
def read_counties(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    state: Annotated[str | None, Query(description="Two-letter state code")] = None,
) -> Any:
    """Return sorted list of distinct county values, optionally filtered by state."""
    return crud.storm_event.get_distinct_counties(db_session, state=state)


@router.get(
    "/zip-boundaries",
    summary="Get ZIP Code Boundary Polygons",
    response_description="GeoJSON FeatureCollection of ZCTA boundary polygons",
    dependencies=[Depends(permissions.read())],
)
async def read_zip_boundaries(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    zip_codes: Annotated[str | None, Query(description="Comma-separated ZIP codes (max 500)")] = None,
    points: Annotated[str | None, Query(description="Comma-separated lat,lng pairs: lat1,lng1,lat2,lng2,...")] = None,
) -> Any:
    """Fetch ZCTA boundary polygons from Census TIGERweb API (cached 24h).

    Two modes:
    - zip_codes: provide known ZIP codes directly
    - points: provide lat,lng coordinate pairs — ZIPs are auto-detected from coordinates
    """
    from app.utils.zip_boundaries import get_zips_at_points

    codes: list[str] = []

    # Mode 1: explicit ZIP codes
    if zip_codes:
        codes = [z.strip() for z in zip_codes.split(",") if z.strip()]

    # Mode 2: derive ZIPs from lat/lng points
    if not codes and points:
        coords = [float(x.strip()) for x in points.split(",") if x.strip()]
        point_list = [(coords[i], coords[i + 1]) for i in range(0, len(coords) - 1, 2)]
        if point_list:
            codes = await get_zips_at_points(point_list[:100])  # cap at 100 points

    if not codes:
        return {"type": "FeatureCollection", "features": []}

    if len(codes) > 500:
        codes = codes[:500]

    return await get_zip_boundaries(codes)


@router.get(
    "/properties-in-radius",
    summary="Get Properties in Radius",
    response_description="List of properties within the given radius from OpenStreetMap data",
    dependencies=[Depends(permissions.read())],
)
def read_properties_in_radius(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    latitude: Annotated[float, Query(description="Center latitude")],
    longitude: Annotated[float, Query(description="Center longitude")],
    radius_miles: Annotated[float, Query(description="Radius in miles")] = 10,
) -> Any:
    """Return properties within the specified radius using OpenStreetMap data."""
    return get_properties_in_radius(latitude, longitude, radius_miles)


@router.post(
    "/roof-analysis",
    summary="Analyze Roof Damage from Satellite Imagery",
    response_description="Roof damage analysis results for each property",
    response_model=schemas.RoofAnalysisResponse,
    dependencies=[Depends(permissions.read())],
)
def analyze_roofs(
    body: schemas.RoofAnalysisRequest,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Fetch satellite imagery and run AI damage analysis for up to 50 properties."""
    results = []
    failed = 0

    for prop in body.properties:
        analysis = analyze_single_roof(prop.property_id, prop.latitude, prop.longitude)

        image_url = None
        if analysis.get("image_path"):
            image_url = f"/v1/storm-events/roof-analysis/images/{prop.property_id}.jpg"

        result = schemas.RoofAnalysisResult(
            property_id=analysis["property_id"],
            damage_score=analysis["damage_score"],
            damage_label=analysis["damage_label"],
            confidence=analysis["confidence"],
            summary=analysis["summary"],
            indicators=analysis["indicators"],
            image_url=image_url,
            error=analysis.get("error"),
        )
        results.append(result)
        if analysis.get("error"):
            failed += 1

    return schemas.RoofAnalysisResponse(
        results=results,
        total=len(body.properties),
        analyzed=len(results) - failed,
        failed=failed,
    )


@router.get(
    "/roof-analysis/images/{filename}",
    summary="Serve Roof Analysis Satellite Image",
    response_description="JPEG satellite image of the property roof",
    dependencies=[Depends(permissions.read())],
)
def get_roof_analysis_image(
    filename: str,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Serve a saved satellite roof image."""
    # Sanitise filename to prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Try Docker path first, then local
    docker_path = Path("/app/media/roof-analysis") / filename
    local_path = Path("media/roof-analysis") / filename

    if docker_path.is_file():
        return FileResponse(str(docker_path), media_type="image/jpeg")
    if local_path.is_file():
        return FileResponse(str(local_path), media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Image not found")


@router.post(
    "/outreach-batch",
    summary="Create Outreach Batch",
    response_description="The newly created outreach batch",
    response_model=schemas.storm_outreach_batch.StormOutreachBatch,
    dependencies=[Depends(outreach_permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_outreach_batch(
    batch_in: schemas.StormOutreachBatchCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a CRM outreach batch for a target area."""
    # Attach the current user as creator
    batch_data = batch_in.dict()
    batch_data["created_by_id"] = current_user.id

    from app.schemas.storm_outreach_batch import StormOutreachBatchCreate

    # We need to pass created_by_id through to the model directly
    from app.models.storm_outreach_batch import StormOutreachBatch as StormOutreachBatchModel
    from fastapi.encoders import jsonable_encoder

    with db_session as session:
        db_obj = StormOutreachBatchModel(**batch_data)
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)

    return db_obj
