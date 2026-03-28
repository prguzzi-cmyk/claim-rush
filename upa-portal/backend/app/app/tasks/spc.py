#!/usr/bin/env python

"""Celery tasks for polling SPC storm reports."""

from app import crud
from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.utils.spc import fetch_spc_storm_reports


@celery_app.task(name="app.tasks.spc.poll_spc_storm_reports")
def poll_spc_storm_reports() -> str:
    """Periodic task: poll SPC filtered storm reports CSV and upsert storm events."""
    db_session = SessionLocal()
    try:
        celery_log.info("SPC poll: fetching today's storm reports...")
        events = fetch_spc_storm_reports()
        if not events:
            celery_log.info("SPC poll: no storm reports found.")
            return "No SPC storm reports to process."

        count = crud.storm_event.upsert_from_source(db_session, events_list=events, data_source="spc")
        summary = f"SPC poll: {count} storm events processed from {len(events)} reports."
        celery_log.info(summary)

        # Auto-trigger pipeline for qualifying storms
        from app.utils.storm_pipeline import DAMAGE_THRESHOLDS
        qualifying_ids = []
        for item in events:
            event_type = item.get("event_type", "")
            hail = item.get("hail_size_inches") or 0
            wind = item.get("wind_speed_mph") or 0
            if (
                event_type == "tornado"
                or hail >= DAMAGE_THRESHOLDS["hail"]
                or wind >= DAMAGE_THRESHOLDS["wind"]
            ):
                ext_id = item.get("external_id", "")
                if ext_id:
                    qualifying_ids.append(ext_id)

        if qualifying_ids:
            from app.tasks.storm_pipeline import trigger_roof_analysis_pipeline
            trigger_roof_analysis_pipeline.delay(qualifying_ids, "spc")
            celery_log.info(f"SPC poll: dispatched pipeline for {len(qualifying_ids)} qualifying storms.")

        # Dispatch storm auto-lead processing (idempotent due to tracker dedup)
        from app.tasks.storm_lead_rotation import process_storm_claim_zones
        process_storm_claim_zones.delay()
        celery_log.info("SPC poll: dispatched storm auto-lead processing.")

        return summary
    except Exception as exc:
        celery_log.error(f"SPC poll task failed: {exc}")
        raise
    finally:
        db_session.close()
