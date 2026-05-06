#!/usr/bin/env python

"""Celery task: enrich fire_incident rows with ZIP / county via reverse
geocoding when ingestion's inline call failed or was skipped.

Acts as a safety net for the inline best-effort enrichment in
``crud.fire_incident.upsert_from_pulsepoint``. Runs on a slow beat
(every 10 minutes), processes a small batch per tick, and is safe to
run alongside live polling.
"""

from __future__ import annotations

from sqlalchemy import and_, func, or_, select, update

from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.models.fire_incident import FireIncident
from app.models.lead_contact import LeadContact
from app.utils.reverse_geocoder import reverse_geocode

DEFAULT_BATCH_SIZE = 200


@celery_app.task(name="app.tasks.zip_enrichment.enrich_missing_zips")
def enrich_missing_zips(batch_size: int = DEFAULT_BATCH_SIZE) -> str:
    """Backfill ZIP / county for up to ``batch_size`` incidents per tick.

    Idempotent: only operates on rows where ``zip_code`` is NULL and
    ``latitude``/``longitude`` are present. Existing populated ZIPs
    are never overwritten.

    Lead-linked incidents are processed first to maximize skip-trace
    impact per tick.
    """
    enriched = 0
    propagated = 0
    geocoder_misses = 0
    with SessionLocal() as session:
        stmt = (
            select(FireIncident)
            .where(
                and_(
                    FireIncident.zip_code.is_(None),
                    FireIncident.latitude.is_not(None),
                    FireIncident.longitude.is_not(None),
                    # Skip PulsePoint sentinel (0, 0) — un-geocodable.
                    or_(
                        func.abs(FireIncident.latitude) >= 0.01,
                        func.abs(FireIncident.longitude) >= 0.01,
                    ),
                )
            )
            # Lead-linked first
            .order_by(FireIncident.lead_id.is_(None), FireIncident.received_at.desc())
            .limit(batch_size)
        )
        rows = session.scalars(stmt).all()
        if not rows:
            return "[zip_enrichment] no candidates"

        for inc in rows:
            res = reverse_geocode(inc.latitude, inc.longitude)
            if res.is_empty:
                geocoder_misses += 1
                continue
            updated = False
            if not inc.zip_code and res.zip_code:
                inc.zip_code = res.zip_code
                updated = True
            if not inc.county and res.county:
                inc.county = res.county
                updated = True
            if updated:
                enriched += 1

            # Propagate ZIP to a linked lead's contact when blank.
            if inc.lead_id and res.zip_code:
                lc = session.scalar(
                    select(LeadContact).where(LeadContact.lead_id == inc.lead_id)
                )
                if lc is not None and not lc.zip_code_loss:
                    lc.zip_code_loss = res.zip_code
                    propagated += 1

        session.commit()

    summary = (
        f"[zip_enrichment] enriched={enriched} "
        f"propagated_to_lead_contact={propagated} "
        f"geocoder_misses={geocoder_misses} "
        f"of batch={len(rows)}"
    )
    celery_log.info(summary)
    return summary
