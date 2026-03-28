#!/usr/bin/env python

"""Celery tasks for polling NIFC ArcGIS wildland fire incidents."""

from app import crud
from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.utils.nifc import fetch_nifc_incidents


@celery_app.task()
def poll_nifc_incidents() -> str:
    """
    Periodic task: fetch active wildland fires from NIFC ArcGIS and upsert.

    Runs on the beat schedule defined in celery_config.py (every 10 minutes).

    Returns
    -------
    str
        Summary message with count of incidents processed.
    """
    db_session = SessionLocal()
    try:
        configs = crud.fire_data_source_config.get_active_by_type(
            db_session, source_type="nifc"
        )
        if not configs:
            celery_log.info("NIFC poll: no active configs found.")
            return "No active NIFC source to poll."

        config = configs[0]
        celery_log.info(f"Polling NIFC: {config.name}")

        incidents = fetch_nifc_incidents(endpoint_url=config.endpoint_url)

        count = crud.fire_incident.upsert_from_external(
            db_session,
            incidents_list=incidents,
            data_source="nifc",
        )

        crud.fire_data_source_config.update_last_polled(
            db_session, config_id=config.id
        )

        summary = f"NIFC: {count} wildland fire incidents processed."
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error(f"NIFC poll task failed: {exc}")
        raise
    finally:
        db_session.close()
