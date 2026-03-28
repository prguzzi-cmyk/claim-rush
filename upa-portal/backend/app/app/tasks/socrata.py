#!/usr/bin/env python

"""Celery tasks for polling Socrata (city open data) fire 911 dispatch feeds."""

from app import crud
from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.utils.socrata import fetch_socrata_incidents


@celery_app.task()
def poll_socrata_sources() -> str:
    """
    Periodic task: poll all active Socrata data source configs and upsert incidents.

    Runs on the beat schedule defined in celery_config.py (every 5 minutes).

    Returns
    -------
    str
        Summary message with counts of sources polled and incidents processed.
    """
    db_session = SessionLocal()
    try:
        configs = crud.fire_data_source_config.get_active_by_type(
            db_session, source_type="socrata"
        )
        if not configs:
            celery_log.info("Socrata poll: no active configs found.")
            return "No active Socrata sources to poll."

        total_incidents = 0
        polled = 0

        for config in configs:
            celery_log.info(f"Polling Socrata source: {config.name}")
            incidents = fetch_socrata_incidents(
                endpoint_url=config.endpoint_url,
                dataset_id=config.dataset_id or "",
                since_datetime=config.last_polled_at,
                extra_config=config.extra_config,
            )

            count = crud.fire_incident.upsert_from_external(
                db_session,
                incidents_list=incidents,
                data_source="socrata",
            )

            crud.fire_data_source_config.update_last_polled(
                db_session, config_id=config.id
            )

            total_incidents += count
            polled += 1
            celery_log.info(f"Socrata {config.name}: {count} incidents processed.")

        summary = (
            f"Polled {polled}/{len(configs)} Socrata sources, "
            f"{total_incidents} total incidents processed."
        )
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error(f"Socrata poll task failed: {exc}")
        raise
    finally:
        db_session.close()
