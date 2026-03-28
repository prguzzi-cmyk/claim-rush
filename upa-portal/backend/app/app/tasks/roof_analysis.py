#!/usr/bin/env python

"""Celery tasks for batch roof damage analysis."""

import json

from app import crud
from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.utils.roof_analysis import analyze_single_roof


@celery_app.task(name="app.tasks.roof_analysis.process_roof_batch")
def process_roof_batch(record_ids: list[str], analysis_mode: str = "rules") -> str:
    """
    Process a batch of queued roof analysis records.

    For each record_id:
    1. Load RoofAnalysis record from DB
    2. Load storm context if storm_event_id set
    3. Fetch imagery → update status to "imagery_fetched"
    4. Run analysis (AI or rules based on mode)
    5. Update record with results + status
    """
    db_session = SessionLocal()
    processed = 0
    errors = 0

    try:
        celery_log.info(
            "Roof batch: processing %d records (mode=%s)", len(record_ids), analysis_mode
        )

        for record_id in record_ids:
            try:
                record = crud.roof_analysis.get(db_session, obj_id=record_id)
                if not record:
                    celery_log.warning("Roof batch: record %s not found, skipping", record_id)
                    continue

                # Build storm context from record fields
                storm_context = {}
                if record.storm_event_id:
                    storm_event = crud.storm_event.get(db_session, obj_id=record.storm_event_id)
                    if storm_event:
                        storm_context = {
                            "storm_type": storm_event.event_type,
                            "storm_severity": storm_event.severity,
                            "hail_size_inches": storm_event.hail_size_inches,
                            "wind_speed_mph": storm_event.wind_speed_mph,
                        }
                elif record.storm_type or record.hail_size_inches or record.wind_speed_mph:
                    storm_context = {
                        "storm_type": record.storm_type,
                        "storm_severity": None,
                        "hail_size_inches": record.hail_size_inches,
                        "wind_speed_mph": record.wind_speed_mph,
                    }

                # Build roof metadata from record fields
                roof_metadata = {
                    "roof_type": record.roof_type,
                    "roof_age_years": record.roof_age_years,
                    "roof_size_sqft": record.roof_size_sqft,
                }

                # Run analysis pipeline
                result = analyze_single_roof(
                    property_id=record.property_id,
                    lat=record.latitude,
                    lng=record.longitude,
                    analysis_mode=analysis_mode,
                    storm_context=storm_context,
                    roof_metadata=roof_metadata,
                )

                # Determine final status
                final_mode = result.get("analysis_mode", "rules")
                if result.get("error"):
                    final_status = "error"
                elif final_mode == "ai_vision":
                    final_status = "ai_analyzed"
                else:
                    final_status = "rules_scored"

                # Serialize indicators list to JSON string
                indicators = result.get("indicators", [])
                if isinstance(indicators, list):
                    indicators = json.dumps(indicators)

                # Update record with results
                update_fields = {
                    "damage_score": result.get("damage_score", 0),
                    "damage_label": result.get("damage_label", "none"),
                    "confidence": result.get("confidence", "low"),
                    "summary": result.get("summary", ""),
                    "indicators": indicators,
                    "analysis_mode": final_mode,
                    "image_source": result.get("image_source"),
                    "image_path": result.get("image_path"),
                    "scan_timestamp": result.get("scan_timestamp"),
                    "claim_range_low": result.get("claim_range_low"),
                    "claim_range_high": result.get("claim_range_high"),
                    "estimated_claim_value": result.get("estimated_claim_value"),
                    "recommended_action": result.get("recommended_action"),
                    "error_message": result.get("error"),
                    "status": final_status,
                }

                crud.roof_analysis.update_status(
                    db_session,
                    obj_id=record_id,
                    status=final_status,
                    result_fields=update_fields,
                )

                processed += 1
                celery_log.info(
                    "Roof batch: %s → %s (score=%d, mode=%s)",
                    record.property_id, final_status,
                    result.get("damage_score", 0), final_mode,
                )

            except Exception as exc:
                errors += 1
                celery_log.error("Roof batch: error processing %s: %s", record_id, exc)
                try:
                    crud.roof_analysis.update_status(
                        db_session,
                        obj_id=record_id,
                        status="error",
                        result_fields={"error_message": str(exc)},
                    )
                except Exception:
                    pass

        summary = (
            f"Roof batch complete: {processed}/{len(record_ids)} processed, "
            f"{errors} errors."
        )
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error(f"Roof batch task failed: {exc}")
        raise
    finally:
        db_session.close()
