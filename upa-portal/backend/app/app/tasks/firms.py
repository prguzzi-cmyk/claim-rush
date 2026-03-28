#!/usr/bin/env python

"""Celery tasks for polling NASA FIRMS satellite fire hotspots."""

import json

from app import crud
from app.core.celery_app import celery_app, celery_log
from app.core.config import settings
from app.db.session import SessionLocal
from app.utils.firms import fetch_firms_hotspots


@celery_app.task()
def poll_firms_hotspots() -> str:
    """
    Periodic task: fetch satellite-detected fire hotspots from NASA FIRMS.

    Runs on the beat schedule defined in celery_config.py (every 15 minutes).

    Returns
    -------
    str
        Summary message with count of hotspots processed.
    """
    db_session = SessionLocal()
    try:
        configs = crud.fire_data_source_config.get_active_by_type(
            db_session, source_type="firms"
        )
        if not configs:
            celery_log.info("FIRMS poll: no active configs found.")
            return "No active FIRMS source to poll."

        config = configs[0]
        celery_log.info(f"Polling NASA FIRMS: {config.name}")

        # Get API key from config or fall back to settings
        api_key = config.api_key or settings.FIRMS_API_KEY
        if not api_key:
            celery_log.warning("FIRMS API key not configured, skipping.")
            return "FIRMS API key not configured."

        # Parse extra config for source/country/days
        extra = {}
        if config.extra_config:
            try:
                extra = json.loads(config.extra_config)
            except (json.JSONDecodeError, TypeError):
                pass

        incidents = fetch_firms_hotspots(
            api_key=api_key,
            area=extra.get("area", "-125,24,-66,50"),
            days=extra.get("days", 1),
            source=extra.get("source", "VIIRS_SNPP_NRT"),
        )

        count = crud.fire_incident.upsert_from_external(
            db_session,
            incidents_list=incidents,
            data_source="firms",
        )

        crud.fire_data_source_config.update_last_polled(
            db_session, config_id=config.id
        )

        summary = f"FIRMS: {count} satellite hotspots processed."
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error(f"FIRMS poll task failed: {exc}")
        raise
    finally:
        db_session.close()
