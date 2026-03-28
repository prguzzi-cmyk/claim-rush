#!/usr/bin/env python

"""Celery task for the Claim Zone → Lead Generation pipeline.

This task runs **asynchronously** and is dispatched when a predicted claim zone
reaches P1 or P2 severity.  It does NOT modify the Storm Prediction Engine.

The task is triggered in two ways:
  1. Directly from the ``process_storm_claim_zones`` task after zone processing.
  2. On-demand via the ``/potential-claims/trigger-pipeline`` endpoint.
"""

from app.core.celery_app import celery_app, celery_log
from app.core.config import settings
from app.db.session import SessionLocal
from app.services.claim_zone_lead_pipeline import ClaimZoneLeadPipelineService


@celery_app.task(name="app.tasks.claim_zone_lead_pipeline.run_claim_zone_pipeline")
def run_claim_zone_pipeline(zone_data: dict) -> dict:
    """Execute the Claim Zone → Lead Generation pipeline for a single zone.

    Parameters
    ----------
    zone_data : dict
        Keys: zone_id, event_type, county, state, priority,
              claim_probability, center, radius_meters,
              event_timestamp, storm_event_id (optional)

    Returns
    -------
    dict
        Pipeline run summary.
    """
    if not getattr(settings, "CLAIM_ZONE_PIPELINE_ENABLED", True):
        return {"zone_id": zone_data.get("zone_id", ""), "skipped": True,
                "reason": "Pipeline disabled"}

    zone_id = zone_data.get("zone_id", "unknown")
    celery_log.info("Claim zone pipeline: starting for zone %s", zone_id)

    db_session = SessionLocal()
    try:
        service = ClaimZoneLeadPipelineService(db_session)
        result = service.run_pipeline(zone_data)

        celery_log.info(
            "Claim zone pipeline: zone %s — %d properties, %d claims, "
            "%d leads, %d assigned, %d errors",
            zone_id,
            result["properties_discovered"],
            result["claims_created"],
            result["leads_created"],
            result["leads_assigned"],
            result["errors"],
        )
        return result

    except Exception as exc:
        celery_log.error("Claim zone pipeline failed for zone %s: %s", zone_id, exc)
        raise
    finally:
        db_session.close()


@celery_app.task(
    name="app.tasks.claim_zone_lead_pipeline.process_all_pending_zones"
)
def process_all_pending_zones() -> str:
    """Scan all P1/P2 claim zones from the last 24h and run the pipeline.

    This is the scheduled entry point (Celery beat) that discovers which
    zones need property-level lead generation.

    It reads claim zones from the potential-claims zone computation and
    dispatches ``run_claim_zone_pipeline`` for each qualifying zone that
    hasn't been processed yet.
    """
    if not getattr(settings, "CLAIM_ZONE_PIPELINE_ENABLED", True):
        return "Claim zone pipeline is disabled."

    db_session = SessionLocal()
    try:
        from app import crud
        from app.utils.claim_probability import (
            compute_claim_probability,
            map_to_claim_severity,
            severity_to_priority,
        )

        # Fetch target areas from last 24h
        areas = crud.storm_event.get_target_areas(db_session, date_range="24h")
        if not areas:
            celery_log.info("Claim zone pipeline: no target areas found.")
            return "No target areas to process."

        dispatched = 0
        for area in areas:
            events = area.get("events", [])
            if not events:
                continue

            # Compute max probability
            max_prob = 0
            for e in events:
                p = compute_claim_probability(e)
                if p > max_prob:
                    max_prob = p

            claim_severity = map_to_claim_severity(area["severity"])
            priority = severity_to_priority(claim_severity)

            # Only P1 and P2
            if priority not in ("P1", "P2"):
                continue

            zone_id = f"PCZ-{area['county']}-{area['state']}"

            # Skip if already processed
            existing_count = crud.potential_claim.count_by_zone(
                db_session, zone_id=zone_id
            )
            if existing_count > 0:
                continue

            # Compute centroid for zone center
            avg_lat = sum(e.latitude for e in events) / len(events)
            avg_lng = sum(e.longitude for e in events) / len(events)

            # Estimate radius from ZIP count
            radius_meters = min(max(len(area["zip_codes"]) * 3000, 3000), 20000)

            earliest = min(
                (e.reported_at for e in events if e.reported_at),
                default=None,
            )

            # Find a representative storm_event_id
            storm_event_id = str(events[0].id) if events else None

            zone_data = {
                "zone_id": zone_id,
                "event_type": area["primary_event_type"],
                "county": area["county"],
                "state": area["state"],
                "priority": priority,
                "claim_probability": max_prob,
                "center": [avg_lat, avg_lng],
                "radius_meters": radius_meters,
                "event_timestamp": earliest.isoformat() if earliest else None,
                "storm_event_id": storm_event_id,
            }

            run_claim_zone_pipeline.apply_async(
                args=[zone_data], queue="main-queue"
            )
            dispatched += 1

        summary = (
            f"Claim zone pipeline: dispatched {dispatched} zones "
            f"from {len(areas)} target areas."
        )
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error("Claim zone pipeline scan failed: %s", exc)
        raise
    finally:
        db_session.close()
