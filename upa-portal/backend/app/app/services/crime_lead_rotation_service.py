#!/usr/bin/env python

"""
Crime Lead Rotation Service
=============================
Automatically converts eligible crime incidents into rotation leads,
distributes them to agents via round-robin rotation, and dispatches
delivery notifications.

Called by the `process_crime_leads` Celery task after crime ingestion
inserts new incidents.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.crime_incident import CrimeIncident
from app.schemas.rotation_lead import RotationLeadCreate
from app.services.rotation_lead_service import RotationLeadService

logger = logging.getLogger(__name__)

# Minimum claim relevance score for auto-conversion
MIN_RELEVANCE_SCORE = 0.4


class CrimeLeadRotationService:
    """Orchestrates automatic rotation lead creation from crime incidents."""

    def __init__(self, db_session: Session):
        self.db = db_session

    def process_recent_incidents(self, lookback_hours: int = 24) -> int:
        """
        Convert recent unprocessed crime incidents into rotation leads.

        Returns the count of leads created.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
        leads_created = 0

        with self.db as session:
            stmt = (
                select(CrimeIncident)
                .where(
                    and_(
                        CrimeIncident.active.is_(True),
                        CrimeIncident.created_at >= cutoff,
                        CrimeIncident.claim_relevance_score >= MIN_RELEVANCE_SCORE,
                        # Only incidents with address info
                        CrimeIncident.address.isnot(None),
                        CrimeIncident.state.isnot(None),
                    )
                )
                .order_by(CrimeIncident.created_at.asc())
            )
            incidents = list(session.scalars(stmt).all())

        if not incidents:
            logger.info("No eligible crime incidents found for lead conversion.")
            return 0

        rotation_svc = RotationLeadService(self.db)

        for incident in incidents:
            try:
                # Check if this incident was already converted (by external_id tag in notes)
                if self._already_converted(incident):
                    continue

                lead_data = RotationLeadCreate(
                    lead_source="crime_claim",
                    property_address=incident.address or "Unknown",
                    property_city=incident.city or "Unknown",
                    property_state=(incident.state or "")[:2].upper(),
                    property_zip=incident.zip_code or "00000",
                    owner_name="Property Owner",
                    phone="N/A",
                    incident_type="theft_vandalism",
                )

                lead = rotation_svc.create_lead_with_auto_assign(lead_data)

                # Tag the lead notes with the crime incident reference
                from app import crud
                crud.rotation_lead.update(
                    self.db,
                    db_obj=lead,
                    obj_in={
                        "notes": (
                            f"Auto-generated from crime incident "
                            f"({incident.data_source}:{incident.external_id}). "
                            f"Type: {incident.raw_incident_type or incident.incident_type}. "
                            f"Severity: {incident.severity}."
                        ),
                    },
                )

                # Mark incident as inactive so it's not re-processed
                incident.active = False
                with self.db as session:
                    session.add(incident)
                    session.commit()

                leads_created += 1
                logger.info(
                    "Crime incident %s (%s:%s) → rotation lead %s",
                    incident.id,
                    incident.data_source,
                    incident.external_id,
                    lead.id,
                )

            except Exception:
                logger.error(
                    "Failed to convert crime incident %s to rotation lead",
                    incident.id,
                    exc_info=True,
                )

        logger.info(
            "Crime lead conversion complete: %d/%d incidents converted",
            leads_created,
            len(incidents),
        )
        return leads_created

    def _already_converted(self, incident: CrimeIncident) -> bool:
        """Check if this crime incident was already converted by looking at
        existing rotation leads with matching notes reference."""
        from app.models.rotation_lead import RotationLead

        ref_tag = f"{incident.data_source}:{incident.external_id}"
        with self.db as session:
            exists = session.scalar(
                select(RotationLead.id).where(
                    and_(
                        RotationLead.lead_source == "crime_claim",
                        RotationLead.notes.contains(ref_tag),
                        RotationLead.is_removed.is_(False),
                    )
                )
            )
            return exists is not None
