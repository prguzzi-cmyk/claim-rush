#!/usr/bin/env python

"""Celery tasks for polling NWS storm alerts."""

from app import crud
from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.utils.nws import fetch_nws_storm_alerts


@celery_app.task()
def poll_nws_storm_alerts() -> str:
    """
    Periodic task: poll NWS active alerts API and upsert storm events.

    Runs on the beat schedule defined in celery_config.py (every 5 minutes).

    Returns
    -------
    str
        Summary message with count of events processed.
    """
    db_session = SessionLocal()
    try:
        celery_log.info("NWS poll: fetching active storm alerts...")
        events = fetch_nws_storm_alerts()

        if not events:
            celery_log.info("NWS poll: no relevant alerts found.")
            return "No NWS storm alerts to process."

        count = crud.storm_event.upsert_from_nws(db_session, events_list=events)

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
            trigger_roof_analysis_pipeline.delay(qualifying_ids, "nws")
            celery_log.info(f"NWS poll: dispatched pipeline for {len(qualifying_ids)} qualifying storms.")

        # Dispatch storm auto-lead processing (idempotent due to tracker dedup)
        from app.tasks.storm_lead_rotation import process_storm_claim_zones
        process_storm_claim_zones.delay()
        celery_log.info("NWS poll: dispatched storm auto-lead processing.")

        # Dispatch property-level claim zone pipeline (scores properties, creates leads)
        from app.tasks.claim_zone_lead_pipeline import process_all_pending_zones
        process_all_pending_zones.delay()
        celery_log.info("NWS poll: dispatched claim zone property pipeline.")

        summary = f"NWS poll: {count} storm events processed from {len(events)} alerts."
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error(f"NWS poll task failed: {exc}")
        raise
    finally:
        db_session.close()
