#!/usr/bin/env python

"""Skip trace enrichment service — populates property_intelligence records.

This module is a placeholder. When the skip trace API key is configured,
implement `enrich_incident()` to call the provider and update the DB row.

Usage (future):
    from app.utils.skip_trace_service import enrich_incident
    enrich_incident(db_session, incident_id)

The enrichment can be triggered by:
  - A background task / cron job that processes all "pending" rows
  - A manual "Enrich" button on the frontend
  - A webhook or queue consumer
"""

import json
from uuid import UUID

from sqlalchemy.orm import Session

from app import crud
from app.core.log import logger


def enrich_incident(db_session: Session, incident_id: UUID) -> bool:
    """Look up skip trace data for an incident and update its property_intelligence row.

    Returns True if enrichment succeeded, False otherwise.
    """
    intel = crud.property_intelligence.get_by_incident_id(db_session, incident_id=incident_id)
    if not intel:
        logger.warning("enrich_incident: no property_intelligence row for incident %s", incident_id)
        return False

    if intel.status == "enriched":
        logger.info("enrich_incident: already enriched for incident %s", incident_id)
        return True

    # --- Placeholder: replace with real API call when key is available ---
    try:
        from app.utils.skip_trace import skip_trace_address

        result = skip_trace_address(intel.address)

        if result and result.residents:
            first = result.residents[0]
            update_data = {
                "owner_name": first.full_name,
                "phone": first.phone_numbers[0] if first.phone_numbers else None,
                "phone_type": "Unknown",
                "email": first.emails[0] if first.emails else None,
                "raw_residents": json.dumps(
                    [
                        {
                            "full_name": r.full_name,
                            "phone_numbers": r.phone_numbers,
                            "emails": r.emails,
                            "age": r.age,
                        }
                        for r in result.residents
                    ]
                ),
                "status": "enriched",
            }
        else:
            # Provider returned no data — mark as enriched with empty results
            update_data = {"status": "enriched"}

        crud.property_intelligence.update(db_session, db_obj=intel, obj_in=update_data)
        return True

    except Exception as exc:
        logger.error("enrich_incident failed for %s: %s", incident_id, exc)
        crud.property_intelligence.update(db_session, db_obj=intel, obj_in={"status": "failed"})
        return False


def enrich_all_pending(db_session: Session, limit: int = 50) -> int:
    """Process up to `limit` pending property_intelligence rows.

    Call this from a background task or management command.
    Returns the number of rows processed.
    """
    from app.models.property_intelligence import PropertyIntelligence as PIModel
    from sqlalchemy import select

    with db_session as session:
        stmt = (
            select(PIModel)
            .where(PIModel.status == "pending")
            .limit(limit)
        )
        pending = session.scalars(stmt).all()

    processed = 0
    for row in pending:
        enrich_incident(db_session, row.incident_id)
        processed += 1

    logger.info("enrich_all_pending: processed %d/%d rows", processed, len(pending))
    return processed
