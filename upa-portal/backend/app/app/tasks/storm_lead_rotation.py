#!/usr/bin/env python

"""Celery task for auto-generating leads from P1/P2 storm claim zones."""

from app import crud
from app.core.celery_app import celery_app, celery_log
from app.core.config import settings
from app.db.session import SessionLocal
from app.services.storm_lead_rotation_service import StormLeadRotationService
from app.utils.claim_probability import (
    compute_claim_probability,
    map_to_claim_severity,
    severity_to_priority,
)


@celery_app.task(name="app.tasks.storm_lead_rotation.process_storm_claim_zones")
def process_storm_claim_zones() -> str:
    """
    Build claim zones from recent storm events, compute priority for each,
    and auto-generate leads for P1/P2 zones.

    Idempotent — the tracker table prevents duplicate lead generation.
    """
    if not settings.STORM_AUTO_LEAD_ENABLED:
        return "Storm auto-lead generation is disabled."

    db_session = SessionLocal()
    try:
        # Fetch target areas from last 24h
        areas = crud.storm_event.get_target_areas(db_session, date_range="24h")
        if not areas:
            celery_log.info("Storm auto-lead: no target areas found.")
            return "No storm target areas to process."

        service = StormLeadRotationService(db_session)
        processed = 0

        for area in areas:
            events = area.get("events", [])
            if not events:
                continue

            # Compute max probability for the zone
            max_prob = 0
            for e in events:
                p = compute_claim_probability(e)
                if p > max_prob:
                    max_prob = p

            claim_severity = map_to_claim_severity(area["severity"])
            priority = severity_to_priority(claim_severity)
            zone_id = f"PCZ-{area['county']}-{area['state']}"

            zone_data = {
                "zone_id": zone_id,
                "event_type": area["primary_event_type"],
                "county": area["county"],
                "state": area["state"],
                "priority": priority,
                "claim_probability": max_prob,
                "name": f"{area['county']} {area['primary_event_type'].title()} Zone",
            }

            service.process_zone(zone_data)
            processed += 1

        summary = f"Storm auto-lead: processed {processed} zones from {len(areas)} target areas."
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error(f"Storm auto-lead task failed: {exc}")
        raise
    finally:
        db_session.close()
