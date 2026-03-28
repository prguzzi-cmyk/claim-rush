#!/usr/bin/env python

"""Celery task for auto-triggering roof analysis from qualifying storm events."""

from app import crud
from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.schemas.roof_analysis_db import RoofAnalysisCreate
from app.utils.storm_pipeline import (
    MAX_RECORDS_PER_STORM,
    generate_zone_properties,
    should_trigger_pipeline,
)


@celery_app.task(name="app.tasks.storm_pipeline.trigger_roof_analysis_pipeline")
def trigger_roof_analysis_pipeline(external_ids: list[str], data_source: str) -> str:
    """Auto-generate RoofAnalysis records for qualifying storm events, then run rules engine.

    1. Load StormEvents by external_id + data_source
    2. generate_zone_properties() for each qualifying event
    3. Create RoofAnalysis records (skip duplicates via uq_roof_property_storm)
    4. Dispatch process_roof_batch() to run rules engine
    """
    db_session = SessionLocal()
    total_created = 0
    total_skipped = 0
    batch_record_ids: list[str] = []

    try:
        celery_log.info(
            f"Storm pipeline: processing {len(external_ids)} external IDs (source={data_source})."
        )

        for ext_id in external_ids:
            storm_event = crud.storm_event.get_by_external_id(
                db_session, external_id=ext_id, data_source=data_source
            )
            if not storm_event:
                celery_log.warning(f"Storm pipeline: event {ext_id} not found, skipping.")
                continue

            if not should_trigger_pipeline(storm_event):
                celery_log.debug(f"Storm pipeline: event {ext_id} below thresholds, skipping.")
                continue

            zone_props = generate_zone_properties(storm_event)

            for prop_data in zone_props:
                # Check for existing record (unique on property_id + storm_event_id)
                existing = crud.roof_analysis.get_by_property_and_storm(
                    db_session,
                    property_id=prop_data["property_id"],
                    storm_event_id=storm_event.id,
                )
                if existing:
                    total_skipped += 1
                    continue

                try:
                    create_data = RoofAnalysisCreate(**prop_data)
                    record = crud.roof_analysis.create(db_session, obj_in=create_data)
                    batch_record_ids.append(str(record.id))
                    total_created += 1
                except Exception as exc:
                    celery_log.error(
                        f"Storm pipeline: failed to create record for {prop_data['property_id']}: {exc}"
                    )

                # Safety cap
                if total_created >= MAX_RECORDS_PER_STORM:
                    celery_log.warning("Storm pipeline: hit max records cap, stopping.")
                    break

        # Dispatch batch processing — auto mode tries AI Vision, falls back to rules
        if batch_record_ids:
            from app.tasks.roof_analysis import process_roof_batch
            process_roof_batch.delay(batch_record_ids, "auto")
            celery_log.info(
                f"Storm pipeline: dispatched auto analysis for {len(batch_record_ids)} records."
            )

        summary = (
            f"Storm pipeline complete: {total_created} created, "
            f"{total_skipped} duplicates skipped, "
            f"{len(batch_record_ids)} queued for analysis."
        )
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error(f"Storm pipeline task failed: {exc}")
        raise
    finally:
        db_session.close()
