#!/usr/bin/env python

"""Celery tasks for property discovery and scan queue processing."""

import uuid

from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app import crud
from app.models.roof_analysis import RoofAnalysis
from app.utils.property_ingestion import discover_properties_in_zone


@celery_app.task(name="app.tasks.property_ingestion.ingest_zone_properties")
def ingest_zone_properties(
    zone_id: str,
    center_lat: float,
    center_lng: float,
    radius_meters: float,
    storm_event_id: str | None = None,
    max_properties: int = 200,
) -> str:
    """Discover properties in a zone and queue them for roof scanning.

    1. Call discover_properties_in_zone() (OSM + grid fallback)
    2. Bulk insert into roof_scan_queue with scan_status='pending'
    3. Dispatch process_zone_scan to start scanning
    """
    db_session = SessionLocal()

    try:
        celery_log.info(
            "Ingesting properties for zone %s at (%.4f, %.4f) radius=%.0fm",
            zone_id, center_lat, center_lng, radius_meters,
        )

        # 1. Discover properties
        raw_props = discover_properties_in_zone(
            center_lat, center_lng, radius_meters, max_properties
        )

        if not raw_props:
            celery_log.warning("No properties discovered for zone %s", zone_id)
            return f"0 properties found for zone {zone_id}"

        # 2. Prepare queue items
        queue_items = []
        for prop in raw_props:
            item = {
                "id": uuid.uuid4(),
                "property_id": prop["property_id"],
                "address": prop.get("address"),
                "latitude": prop["latitude"],
                "longitude": prop["longitude"],
                "zone_id": zone_id,
                "storm_event_id": storm_event_id,
                "scan_status": "pending",
                "source": prop.get("source", "osm"),
                "building_type": prop.get("building_type"),
                "building_area_sqft": prop.get("building_area_sqft"),
            }
            queue_items.append(item)

        # 3. Bulk insert (skip duplicates)
        inserted = crud.roof_scan_queue.bulk_create(db_session, items=queue_items)

        celery_log.info(
            "Zone %s: discovered %d properties, inserted %d into scan queue",
            zone_id, len(raw_props), inserted,
        )

        # 4. Dispatch scan processing
        if inserted > 0:
            process_zone_scan.apply_async(args=[zone_id], queue="main-queue")

        return f"{inserted} properties queued for zone {zone_id}"

    except Exception as exc:
        celery_log.error("Failed to ingest zone %s: %s", zone_id, exc)
        raise
    finally:
        db_session.close()


@celery_app.task(name="app.tasks.property_ingestion.process_zone_scan")
def process_zone_scan(zone_id: str, batch_size: int = 25) -> str:
    """Process pending scan queue items for a zone.

    1. Load next batch of pending queue items
    2. Create RoofAnalysis records for each
    3. Update queue: scan_status='queued', roof_analysis_id=new_id
    4. Dispatch process_roof_batch for Vision AI analysis
    5. Self-dispatch if more pending items remain
    """
    db_session = SessionLocal()

    try:
        # 1. Get pending batch
        pending = crud.roof_scan_queue.get_pending_batch(
            db_session, zone_id=zone_id, limit=batch_size
        )

        if not pending:
            celery_log.info("No more pending items for zone %s", zone_id)
            return f"Zone {zone_id}: no pending items"

        celery_log.info(
            "Processing %d pending scan items for zone %s", len(pending), zone_id
        )

        # 2-3. Create RoofAnalysis records and update queue
        record_ids: list[str] = []

        with db_session as session:
            for item in pending:
                try:
                    # Create RoofAnalysis record
                    roof_obj = RoofAnalysis(
                        property_id=item.property_id,
                        address=item.address or f"Near {item.latitude:.5f}, {item.longitude:.5f}",
                        city="",
                        state="",
                        zip_code="",
                        latitude=item.latitude,
                        longitude=item.longitude,
                        storm_event_id=item.storm_event_id,
                        status="queued",
                        analysis_mode="auto",
                        roof_type=item.building_type if item.building_type else "unknown",
                        roof_size_sqft=item.building_area_sqft,
                        is_demo=False,
                        is_active=True,
                    )
                    session.add(roof_obj)
                    session.flush()

                    new_id = roof_obj.id
                    record_ids.append(str(new_id))

                    # Update queue item
                    item.scan_status = "queued"
                    item.roof_analysis_id = new_id
                    session.add(item)

                except Exception as exc:
                    celery_log.error(
                        "Failed to process queue item %s: %s", item.id, exc
                    )
                    item.scan_status = "error"
                    item.error_message = str(exc)[:500]
                    session.add(item)

            session.commit()

        # 4. Dispatch batch processing for Vision AI
        if record_ids:
            try:
                from app.tasks.roof_analysis import process_roof_batch
                process_roof_batch.apply_async(args=[record_ids, "auto"], queue="main-queue")
                celery_log.info(
                    "Dispatched process_roof_batch for %d records from zone %s",
                    len(record_ids), zone_id,
                )
            except Exception as exc:
                celery_log.warning("Could not dispatch roof batch: %s", exc)

        # 5. Self-dispatch if more pending items remain
        remaining = crud.roof_scan_queue.get_pending_batch(
            db_session, zone_id=zone_id, limit=1
        )
        if remaining:
            process_zone_scan.apply_async(args=[zone_id, batch_size], queue="main-queue")
            celery_log.info("More pending items for zone %s, self-dispatching", zone_id)

        return f"Zone {zone_id}: processed {len(pending)}, created {len(record_ids)} analyses"

    except Exception as exc:
        celery_log.error("Failed to process zone scan %s: %s", zone_id, exc)
        raise
    finally:
        db_session.close()
