#!/usr/bin/env python

"""Routes for the Roof Analysis module"""

import logging
import uuid
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.schemas.roof_analysis_db import (
    RoofAnalysisBatchRequest,
    RoofAnalysisBatchResponse,
    RoofAnalysisBatchStatusResponse,
    RoofAnalysisListResponse,
    RoofAnalysisOut,
    RoofAnalysisStatsOut,
    RoofAnalysisUpdate,
)
from app.schemas.roof_scan_queue import (
    RoofScanQueueOut,
    RoofScanQueueStats,
    ZoneScanRequest,
    ZoneScanResponse,
)
from app.utils.territory_filter import get_roof_analysis_territory_filters

logger = logging.getLogger(__name__)

router = APIRouter()

permissions = Permissions(Modules.ROOF_ANALYSIS.value)


@router.get(
    "",
    summary="List Roof Analyses",
    response_description="Paginated list of roof analysis records",
    response_model=RoofAnalysisListResponse,
    dependencies=[Depends(permissions.read())],
)
def read_roof_analyses(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    status_filter: Annotated[str | None, Query(alias="status", description="Pipeline status")] = None,
    damage_label: Annotated[str | None, Query(description="none, low, moderate, high, severe")] = None,
    state: Annotated[str | None, Query(description="Two-letter state code")] = None,
    city: Annotated[str | None, Query(description="City name (partial match)")] = None,
    analysis_mode: Annotated[str | None, Query(description="ai_vision, rules, demo")] = None,
    is_demo: Annotated[bool | None, Query(description="Filter demo vs live")] = None,
) -> Any:
    """Retrieve roof analysis records with optional filtering."""
    territory_filters = get_roof_analysis_territory_filters(db_session, current_user)
    items, total = crud.roof_analysis.get_filtered(
        db_session,
        skip=skip,
        limit=limit,
        status=status_filter,
        damage_label=damage_label,
        state=state,
        city=city,
        analysis_mode=analysis_mode,
        is_demo=is_demo,
        territory_filters=territory_filters,
    )
    return RoofAnalysisListResponse(items=items, total=total)


@router.get(
    "/opportunities",
    summary="Generate Roof Intelligence Opportunities (V1)",
    response_description="Scored property opportunities from storm data",
    dependencies=[Depends(permissions.read())],
)
def get_roof_opportunities(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    date_range: Annotated[str, Query(description="24h, 3d, or 7d")] = "7d",
    state: Annotated[str | None, Query(description="Two-letter state code")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> Any:
    """Generate scored property opportunities from real storm event data.

    Uses V1 heuristic scoring: storm severity + recency + area density + roof vulnerability.
    Properties are synthetically generated within storm impact zones.
    """
    from app.services.roof_scoring_engine import generate_roof_opportunities

    try:
        properties = generate_roof_opportunities(
            db_session,
            date_range=date_range,
            state=state,
            limit=limit,
        )
        return {
            "items": properties,
            "total": len(properties),
            "scoring_version": "v1_heuristic",
            "source": "storm_events",
        }
    except Exception as e:
        logger.error(f"Roof opportunities generation failed: {e}")
        return {
            "items": [],
            "total": 0,
            "scoring_version": "v1_heuristic",
            "source": "storm_events",
            "error": str(e),
        }


@router.get(
    "/stats",
    summary="Get Roof Analysis Stats",
    response_description="Aggregate statistics for dashboard",
    response_model=RoofAnalysisStatsOut,
    dependencies=[Depends(permissions.read())],
)
def read_roof_analysis_stats(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return aggregate counts grouped by status, damage_label, and analysis_mode."""
    territory_filters = get_roof_analysis_territory_filters(db_session, current_user)
    return crud.roof_analysis.get_stats(db_session, territory_filters=territory_filters)


# ── Scan Queue Endpoints ─────────────────────────────────────────


@router.post(
    "/zone-scan",
    summary="Trigger Zone Property Scan",
    response_description="Zone scan dispatch confirmation",
    response_model=ZoneScanResponse,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_202_ACCEPTED,
)
def trigger_zone_scan(
    body: ZoneScanRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Discover properties inside a predicted claim zone and queue them for roof scans."""
    try:
        from app.tasks.property_ingestion import ingest_zone_properties

        ingest_zone_properties.delay(
            body.zone_id,
            body.center[0],
            body.center[1],
            body.radius_meters,
            body.storm_event_id,
            body.max_properties,
        )
    except Exception as exc:
        logger.warning("Could not dispatch zone scan task: %s", exc)
        raise HTTPException(status_code=503, detail="Task queue unavailable") from exc

    return ZoneScanResponse(
        zone_id=body.zone_id,
        properties_found=0,  # async — will populate in background
        queued_for_scan=0,
        message=f"Zone scan dispatched for {body.zone_id}. Properties will be discovered and queued.",
    )


@router.get(
    "/scan-queue",
    summary="List Scan Queue Items",
    response_description="Paginated scan queue items",
    dependencies=[Depends(permissions.read())],
)
def read_scan_queue(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    zone_id: Annotated[str | None, Query(description="Filter by zone")] = None,
    scan_status: Annotated[str | None, Query(description="pending, queued, scanning, completed, error")] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> Any:
    """Retrieve scan queue items with optional filtering."""
    if not zone_id:
        return {"items": [], "total": 0}
    items, total = crud.roof_scan_queue.get_by_zone(
        db_session, zone_id=zone_id, scan_status=scan_status, skip=skip, limit=limit
    )
    return {"items": items, "total": total}


@router.get(
    "/scan-queue/stats",
    summary="Scan Queue Statistics",
    response_description="Aggregate scan queue counts",
    response_model=RoofScanQueueStats,
    dependencies=[Depends(permissions.read())],
)
def read_scan_queue_stats(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    zone_id: Annotated[str | None, Query(description="Filter by zone (optional)")] = None,
) -> Any:
    """Return aggregate counts for the scan queue grouped by status."""
    return crud.roof_scan_queue.get_stats(db_session, zone_id=zone_id)


@router.get(
    "/{analysis_id}",
    summary="Get Roof Analysis Detail",
    response_description="Single roof analysis record",
    response_model=RoofAnalysisOut,
    dependencies=[Depends(permissions.read())],
)
def read_roof_analysis(
    analysis_id: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single roof analysis record by ID."""
    record = crud.roof_analysis.get(db_session, obj_id=analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Roof analysis record not found")
    return record


@router.post(
    "/batch",
    summary="Submit Batch for Analysis",
    response_description="Batch submission confirmation",
    response_model=RoofAnalysisBatchResponse,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def submit_batch(
    body: RoofAnalysisBatchRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Submit a batch of properties for roof damage analysis.

    Creates records with status='queued' and kicks off a Celery task.
    """
    batch_id = str(uuid.uuid4())
    record_ids = []

    with db_session as session:
        for prop in body.properties:
            prop_data = prop.model_dump() if hasattr(prop, "model_dump") else prop.dict()
            prop_data["batch_id"] = batch_id
            prop_data["status"] = "queued"
            prop_data["analysis_mode"] = body.analysis_mode
            if body.storm_event_id:
                prop_data["storm_event_id"] = body.storm_event_id

            from app.models.roof_analysis import RoofAnalysis
            db_obj = RoofAnalysis(**prop_data)
            session.add(db_obj)
            session.flush()
            record_ids.append(str(db_obj.id))

        session.commit()

    # Kick off Celery task for async processing
    try:
        from app.tasks.roof_analysis import process_roof_batch
        process_roof_batch.delay(record_ids, body.analysis_mode)
    except Exception as exc:
        logger.warning("Could not dispatch Celery task (will process synchronously): %s", exc)

    return RoofAnalysisBatchResponse(
        batch_id=batch_id,
        queued=len(record_ids),
        message=f"Batch {batch_id}: {len(record_ids)} properties queued for analysis.",
    )


@router.get(
    "/batch/{batch_id}/status",
    summary="Get Batch Status",
    response_description="Processing status of a batch",
    response_model=RoofAnalysisBatchStatusResponse,
    dependencies=[Depends(permissions.read())],
)
def read_batch_status(
    batch_id: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Check the processing status of a submitted batch."""
    return crud.roof_analysis.get_batch_status(db_session, batch_id=batch_id)


@router.put(
    "/{analysis_id}",
    summary="Update Roof Analysis",
    response_description="Updated roof analysis record",
    response_model=RoofAnalysisOut,
    dependencies=[Depends(permissions.update())],
)
def update_roof_analysis(
    analysis_id: str,
    body: RoofAnalysisUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update adjuster notes, outreach status, or skip trace status."""
    record = crud.roof_analysis.get(db_session, obj_id=analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Roof analysis record not found")
    return crud.roof_analysis.update(db_session, db_obj=record, obj_in=body)


@router.get(
    "/images/{filename}",
    summary="Serve Roof Analysis Image",
    response_description="JPEG satellite image",
    dependencies=[Depends(permissions.read())],
)
def get_roof_image(
    filename: str,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Serve a saved satellite roof image."""
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    docker_path = Path("/app/media/roof-analysis") / filename
    local_path = Path("media/roof-analysis") / filename

    if docker_path.is_file():
        return FileResponse(str(docker_path), media_type="image/jpeg")
    if local_path.is_file():
        return FileResponse(str(local_path), media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Image not found")
