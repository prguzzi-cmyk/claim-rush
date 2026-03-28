#!/usr/bin/env python

"""Celery task for polling crime data sources."""

import json

from app.core.log import logger
from app.db.session import SessionLocal
from app.worker import celery_app


@celery_app.task(name="app.tasks.crime_ingestion.poll_crime_sources")
def poll_crime_sources() -> str:
    """
    1. Load all enabled CrimeDataSourceConfig rows
    2. For each config, dispatch to correct fetcher based on source_type
    3. Normalize via crime_type_mapping (skip non-insurance-relevant)
    4. Upsert into crime_incidents table
    5. Update config.last_polled_at, connection_status, last_record_count
    6. Log summary
    """
    from app import crud

    db_session = SessionLocal()
    try:
        configs = crud.crime_data_source_config.get_enabled(db_session)
        if not configs:
            logger.info("No enabled crime data source configs found.")
            return "No enabled crime sources."

        total_processed = 0
        for config in configs:
            try:
                incidents = _fetch_for_config(config)
                count = _upsert_incidents(db_session, config, incidents)
                total_processed += count

                crud.crime_data_source_config.update_poll_status(
                    db_session,
                    config_id=config.id,
                    status="connected",
                    record_count=count,
                )
                logger.info(
                    f"Crime source '{config.name}' polled: {count} incidents processed."
                )
            except Exception as exc:
                logger.error(f"Error polling crime source '{config.name}': {exc}")
                crud.crime_data_source_config.update_poll_status(
                    db_session,
                    config_id=config.id,
                    status="error",
                    record_count=0,
                )

        return f"Crime polling complete. {total_processed} total incidents processed across {len(configs)} sources."
    finally:
        db_session.close()


def _fetch_for_config(config) -> list[dict]:
    """Dispatch to the correct fetcher based on source_type."""
    source_type = config.source_type

    if source_type == "socrata":
        from app.utils.socrata_crime import fetch_chicago_crime

        return fetch_chicago_crime(
            endpoint_url=config.endpoint_url or "",
            dataset_id=config.dataset_id or "",
            since_datetime=config.last_polled_at,
        )

    elif source_type == "carto":
        from app.utils.philly_carto import fetch_philly_crime

        return fetch_philly_crime(
            endpoint_url=config.endpoint_url or "",
            since_datetime=config.last_polled_at,
        )

    elif source_type == "fbi_api":
        from app.utils.fbi_crime import fetch_fbi_aggregate_stats

        api_key = config.api_key or ""
        return fetch_fbi_aggregate_stats(
            endpoint_url=config.endpoint_url or "",
            api_key=api_key if api_key else None,
        )

    elif source_type == "mock":
        from app.utils.fbi_crime import generate_fbi_mock_incidents

        return generate_fbi_mock_incidents()

    else:
        logger.warning(f"Unknown crime source_type: {source_type}")
        return []


def _upsert_incidents(db_session, config, incidents: list[dict]) -> int:
    """Upsert a list of normalized crime incident dicts."""
    from app import crud

    data_source_name = _get_data_source_name(config)
    count = 0

    for item in incidents:
        external_id = item.get("external_id", "")
        if not external_id:
            continue

        incident_type = item.get("incident_type")
        if not incident_type:
            continue

        try:
            crud.crime_incident.upsert_from_external(
                db_session,
                data_source=data_source_name,
                external_id=external_id,
                defaults={
                    "incident_type": incident_type,
                    "raw_incident_type": item.get("raw_incident_type"),
                    "occurred_at": item.get("occurred_at"),
                    "reported_at": item.get("reported_at"),
                    "address": item.get("address"),
                    "city": item.get("city"),
                    "state": item.get("state"),
                    "zip_code": item.get("zip_code"),
                    "county": item.get("county"),
                    "latitude": item.get("latitude"),
                    "longitude": item.get("longitude"),
                    "severity": item.get("severity", "moderate"),
                    "claim_relevance_score": item.get("claim_relevance_score", 0.5),
                    "estimated_loss": item.get("estimated_loss"),
                    "property_type": item.get("property_type"),
                    "description": item.get("description"),
                    "source_freshness": item.get("source_freshness"),
                    "is_mock": item.get("is_mock", False),
                    "active": True,
                },
            )
            count += 1
        except Exception as exc:
            logger.error(f"Error upserting crime incident {external_id}: {exc}")

    return count


def _get_data_source_name(config) -> str:
    """Map config source_type to data_source string for crime_incidents table."""
    mapping = {
        "socrata": "chicago_socrata",
        "carto": "philly_carto",
        "fbi_api": "fbi_ucr",
        "mock": "mock",
    }
    return mapping.get(config.source_type, config.source_type)
