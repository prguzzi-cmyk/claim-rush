#!/usr/bin/env python

"""Storm-to-roof-analysis pipeline orchestration logic."""

import json
import uuid

from app.core.log import logger
from app.models.storm_event import StormEvent

# Damage thresholds for auto-triggering roof analysis
DAMAGE_THRESHOLDS = {
    "hail": 1.0,    # inches
    "wind": 58.0,   # mph
    "tornado": 0,   # any tornado qualifies
}

MAX_RECORDS_PER_STORM = 500


def should_trigger_pipeline(storm_event: StormEvent) -> bool:
    """Check if a storm event meets damage thresholds for auto-pipeline."""
    event_type = storm_event.event_type

    if event_type == "tornado":
        return True

    if event_type == "hail" and storm_event.hail_size_inches:
        return storm_event.hail_size_inches >= DAMAGE_THRESHOLDS["hail"]

    if event_type == "wind" and storm_event.wind_speed_mph:
        return storm_event.wind_speed_mph >= DAMAGE_THRESHOLDS["wind"]

    return False


def generate_zone_properties(storm_event: StormEvent) -> list[dict]:
    """Create synthetic RoofAnalysis records for each affected ZIP code.

    Returns a list of dicts suitable for creating RoofAnalysis records.
    """
    # Parse zip codes from the storm event
    zip_codes: list[str] = []
    if storm_event.zip_codes:
        try:
            zip_codes = json.loads(storm_event.zip_codes)
        except (json.JSONDecodeError, TypeError):
            pass

    # If no zip codes, create a single record for the county
    if not zip_codes:
        zip_codes = ["00000"]  # placeholder

    storm_id_short = str(storm_event.id)[:8]
    properties = []

    for zip_code in zip_codes[:MAX_RECORDS_PER_STORM]:
        property_id = f"zone-{zip_code}-{storm_id_short}"
        address = f"{storm_event.county} County, {storm_event.state}"
        if zip_code != "00000":
            address += f" (ZIP {zip_code})"

        prop = {
            "property_id": property_id,
            "address": address,
            "city": storm_event.county,
            "state": storm_event.state,
            "zip_code": zip_code,
            "county": storm_event.county,
            "latitude": storm_event.latitude,
            "longitude": storm_event.longitude,
            "roof_type": "asphalt_shingle",
            "roof_age_years": 15,
            "roof_size_sqft": 2000.0,
            "storm_event_id": storm_event.id,
            "storm_type": storm_event.event_type,
            "hail_size_inches": storm_event.hail_size_inches,
            "wind_speed_mph": storm_event.wind_speed_mph,
            "status": "queued",
            "analysis_mode": "rules",
            "is_demo": False,
            "is_active": True,
        }
        properties.append(prop)

    logger.info(
        f"Storm pipeline: generated {len(properties)} zone properties for "
        f"storm {storm_event.id} ({storm_event.event_type}, "
        f"{storm_event.county} {storm_event.state})."
    )

    # Auto-dispatch property ingestion for each zone
    try:
        from app.tasks.property_ingestion import ingest_zone_properties

        radius_m = (storm_event.radius_miles or 10) * 1609.34  # miles → meters
        for zip_code in zip_codes[:MAX_RECORDS_PER_STORM]:
            zone_id = f"zone-{zip_code}-{storm_id_short}"
            ingest_zone_properties.apply_async(
                args=[
                    zone_id,
                    storm_event.latitude,
                    storm_event.longitude,
                    radius_m,
                    str(storm_event.id),
                ],
                queue="main-queue",
            )
        logger.info(
            "Storm pipeline: dispatched property ingestion for %d zones",
            min(len(zip_codes), MAX_RECORDS_PER_STORM),
        )
    except Exception as exc:
        logger.warning("Could not dispatch property ingestion: %s", exc)

    return properties
