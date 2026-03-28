#!/usr/bin/env python

"""
Incident Intelligence Data Engine
====================================
Continuously ingest real-time property damage incidents and convert them
into leads. Supports fire, storm, crime, and weather incident types.

Core capabilities:
- Multi-source incident ingestion
- Duplicate detection (address + timestamp window + type)
- Priority scoring (damage probability, property type, location density)
- Automatic lead conversion for qualifying incidents
- Geographic coordinate storage for Command Center map
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app import crud
from app.models.incident import Incident
from app.schemas.incident_intelligence import IncidentCreate

logger = logging.getLogger(__name__)


# Scoring weights
SEVERITY_SCORES = {
    "extreme": 1.0,
    "severe": 0.85,
    "high": 0.7,
    "moderate": 0.5,
    "low": 0.25,
}

INCIDENT_TYPE_DAMAGE_PROBABILITY = {
    "fire": 0.9,
    "storm": 0.7,
    "crime": 0.5,
    "weather": 0.6,
}

PROPERTY_TYPE_MULTIPLIERS = {
    "residential": 1.0,
    "commercial": 1.2,
    "industrial": 0.8,
    "vacant": 0.3,
}

# Minimum score to auto-convert to a lead
AUTO_CONVERT_THRESHOLD = 0.6


class IncidentIntelligenceService:
    """Core engine for the Incident Intelligence Data Engine."""

    def __init__(self, db_session: Session):
        self.db = db_session

    def ingest_batch(
        self,
        incidents: list[IncidentCreate],
    ) -> dict:
        """
        Ingest a batch of incidents with duplicate detection.

        Returns summary: {total_received, inserted, duplicates_skipped, errors}
        """
        total = len(incidents)
        inserted = 0
        duplicates = 0
        errors = 0

        for inc_data in incidents:
            try:
                # Duplicate detection
                existing = crud.incident.find_duplicate(
                    self.db,
                    incident_type=inc_data.incident_type,
                    address=inc_data.address,
                    occurred_at=inc_data.occurred_at,
                    external_id=inc_data.external_id,
                    source=inc_data.source,
                )
                if existing:
                    duplicates += 1
                    logger.debug(
                        "Duplicate incident skipped: %s/%s at %s",
                        inc_data.source,
                        inc_data.external_id,
                        inc_data.address,
                    )
                    continue

                # Score the incident before saving
                scored = self._score_incident(inc_data)

                # Create the record
                crud.incident.create(self.db, obj_in=scored)
                inserted += 1

            except Exception:
                errors += 1
                logger.exception(
                    "Failed to ingest incident %s/%s",
                    inc_data.source,
                    inc_data.external_id,
                )

        logger.info(
            "Ingestion complete: %d received, %d inserted, %d duplicates, %d errors",
            total,
            inserted,
            duplicates,
            errors,
        )

        return {
            "total_received": total,
            "inserted": inserted,
            "duplicates_skipped": duplicates,
            "errors": errors,
        }

    def _score_incident(self, inc_data: IncidentCreate) -> IncidentCreate:
        """
        Calculate priority score based on:
        - damage_probability (incident type + severity)
        - property_type multiplier
        - location_density

        Score = (damage_prob * severity_weight * property_multiplier + location_density) / 2
        Clamped to [0.0, 1.0]
        """
        severity_weight = SEVERITY_SCORES.get(
            (inc_data.severity or "moderate").lower(), 0.5
        )
        damage_prob = INCIDENT_TYPE_DAMAGE_PROBABILITY.get(
            (inc_data.incident_type or "").lower(), 0.5
        )
        property_mult = PROPERTY_TYPE_MULTIPLIERS.get(
            (inc_data.property_type or "residential").lower(), 1.0
        )
        location_density = inc_data.location_density or 0.5

        score = (damage_prob * severity_weight * property_mult + location_density) / 2.0
        score = max(0.0, min(1.0, score))

        # Update the schema with computed values
        inc_data.priority_score = round(score, 3)
        inc_data.damage_probability = round(damage_prob * severity_weight, 3)

        return inc_data

    def auto_convert_qualifying_incidents(self) -> int:
        """
        Scan recent unconverted incidents and auto-convert those
        above the threshold to leads.

        Returns the number of leads created.
        """
        leads_created = 0
        incidents = crud.incident.get_active_incidents(
            self.db,
            hours=24,
        )

        for inc in incidents:
            if inc.lead_converted:
                continue
            if inc.priority_score < AUTO_CONVERT_THRESHOLD:
                continue
            if not inc.address:
                self._mark_skip(inc, "no_address")
                continue

            try:
                lead = self._create_lead_from_incident(inc)
                if lead:
                    leads_created += 1
            except Exception:
                logger.exception("Failed to auto-convert incident %s", inc.id)
                self._mark_skip(inc, "conversion_error")

        logger.info("Auto-conversion complete: %d leads created", leads_created)
        return leads_created

    def convert_single_incident(
        self,
        incident_id: UUID,
        full_name: str,
        phone_number: str,
        email: str | None = None,
        assigned_to: UUID | None = None,
    ) -> dict:
        """
        Manually convert a single incident to a lead with contact info.

        Returns {incident_id, lead_id, message}
        """
        inc = crud.incident.get(self.db, obj_id=incident_id)
        if not inc:
            raise ValueError(f"Incident {incident_id} not found")
        if inc.lead_converted:
            raise ValueError(f"Incident {incident_id} already converted to lead {inc.lead_id}")

        from app.schemas.lead import LeadCreate
        from app.schemas.lead_contact import LeadContactCreate

        contact = LeadContactCreate(
            full_name=full_name,
            phone_number=phone_number,
            email=email,
            address_loss=inc.address,
            state_loss=inc.state,
        )

        peril = inc.incident_type
        if inc.description:
            peril = f"{inc.incident_type} - {inc.description[:50]}"

        lead_in = LeadCreate(
            peril=peril,
            loss_date=inc.occurred_at,
            assigned_to=assigned_to,
            contact=contact,
        )

        new_ref = crud.lead.generate_new_ref_number(self.db)
        from app.models.lead import Lead
        from app.models.lead_contact import LeadContact

        with self.db as session:
            lead = Lead(
                ref_number=new_ref,
                peril=peril,
                loss_date=inc.occurred_at,
                status="callback",
                source_info=f"incident-intelligence-{inc.incident_type}",
                instructions_or_notes=(
                    f"Converted from {inc.incident_type} incident. "
                    f"Source: {inc.source}. Severity: {inc.severity}. "
                    f"Priority: {inc.priority_score}"
                ),
                assigned_to=assigned_to,
            )
            session.add(lead)
            session.flush()

            lead_contact = LeadContact(
                lead_id=lead.id,
                full_name=full_name,
                phone_number=phone_number,
                email=email,
                address_loss=inc.address,
                state_loss=inc.state,
            )
            session.add(lead_contact)

            # Mark incident as converted
            inc.lead_converted = True
            inc.lead_id = str(lead.id)
            session.add(inc)
            session.commit()
            session.refresh(lead)

            return {
                "incident_id": inc.id,
                "lead_id": lead.id,
                "message": f"Incident converted to lead {lead.id}",
            }

    def _create_lead_from_incident(self, inc: Incident) -> "Lead | None":
        """Auto-create a lead from a qualifying incident (no contact info)."""
        from app.models.lead import Lead
        from app.models.lead_contact import LeadContact

        new_ref = crud.lead.generate_new_ref_number(self.db)

        with self.db as session:
            lead = Lead(
                ref_number=new_ref,
                peril=inc.incident_type,
                loss_date=inc.occurred_at,
                status="callback",
                source_info=f"auto-incident-{inc.incident_type}",
                instructions_or_notes=(
                    f"Auto-generated from {inc.incident_type} incident. "
                    f"Source: {inc.source}. Severity: {inc.severity}. "
                    f"Score: {inc.priority_score}"
                ),
            )
            session.add(lead)
            session.flush()

            contact = LeadContact(
                lead_id=lead.id,
                full_name="Property Owner",
                phone_number="N/A",
                address_loss=inc.address,
                state_loss=inc.state,
            )
            session.add(contact)

            inc.lead_converted = True
            inc.lead_id = str(lead.id)
            session.add(inc)
            session.commit()
            session.refresh(lead)

            logger.info(
                "Auto-converted incident %s → lead %s (score=%s)",
                inc.id,
                lead.id,
                inc.priority_score,
            )
            return lead

    def _mark_skip(self, inc: Incident, reason: str) -> None:
        """Mark an incident as skipped for conversion."""
        with self.db as session:
            inc.conversion_skipped_reason = reason
            session.add(inc)
            session.commit()

    def sync_fire_incidents(self) -> int:
        """Pull recent fire incidents into the unified table.

        Syncs ALL incidents (active + cleared) — dispatch_status is not a
        filter here because historical incidents should appear in the unified
        intelligence view.
        """
        from datetime import datetime, timedelta, timezone

        from app.models.fire_incident import FireIncident

        count = 0
        # Sync incidents from the last 7 days (covers well beyond the 24h live view)
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        with self.db as session:
            from sqlalchemy import select

            stmt = select(FireIncident).where(FireIncident.received_at >= cutoff)
            fire_incidents = list(session.scalars(stmt).all())

        for fi in fire_incidents:
            existing = crud.incident.find_duplicate(
                self.db,
                incident_type="fire",
                address=fi.address,
                occurred_at=fi.received_at,
                external_id=fi.external_id or fi.pulsepoint_id,
                source=f"fire_{fi.data_source}",
            )
            if existing:
                continue

            # Map PulsePoint call types to severity levels
            HIGH_SEVERITY_TYPES = {
                "SF", "CF", "RF", "WSF", "WCF", "WRF", "FIRE", "FULL", "EXP",
            }
            MODERATE_SEVERITY_TYPES = {
                "FA", "BA", "ELF", "AF", "CHIM",
            }
            if fi.call_type in HIGH_SEVERITY_TYPES:
                severity = "high"
            elif fi.call_type in MODERATE_SEVERITY_TYPES:
                severity = "moderate"
            else:
                severity = "low"

            inc_data = IncidentCreate(
                incident_type="fire",
                source=f"fire_{fi.data_source}",
                external_id=fi.external_id or fi.pulsepoint_id,
                address=fi.address,
                latitude=fi.latitude,
                longitude=fi.longitude,
                occurred_at=fi.received_at,
                description=fi.call_type_description or fi.call_type,
                severity=severity,
                source_record_id=str(fi.id),
            )
            scored = self._score_incident(inc_data)
            crud.incident.create(self.db, obj_in=scored)
            count += 1

        logger.info("Synced %d fire incidents", count)
        return count

    def sync_crime_incidents(self) -> int:
        """Pull recent crime incidents into the unified table."""
        from app.models.crime_incident import CrimeIncident

        count = 0
        with self.db as session:
            from sqlalchemy import select

            stmt = select(CrimeIncident).where(CrimeIncident.active.is_(True))
            crime_incidents = list(session.scalars(stmt).all())

        for ci in crime_incidents:
            existing = crud.incident.find_duplicate(
                self.db,
                incident_type="crime",
                address=ci.address,
                occurred_at=ci.occurred_at,
                external_id=ci.external_id,
                source=f"crime_{ci.data_source}",
            )
            if existing:
                continue

            inc_data = IncidentCreate(
                incident_type="crime",
                source=f"crime_{ci.data_source}",
                external_id=ci.external_id,
                address=ci.address,
                city=ci.city,
                state=ci.state,
                zip_code=ci.zip_code,
                latitude=ci.latitude,
                longitude=ci.longitude,
                occurred_at=ci.occurred_at,
                description=ci.raw_incident_type or ci.incident_type,
                severity=ci.severity,
                property_type=ci.property_type,
                source_record_id=str(ci.id),
            )
            scored = self._score_incident(inc_data)
            crud.incident.create(self.db, obj_in=scored)
            count += 1

        logger.info("Synced %d crime incidents", count)
        return count

    def sync_storm_events(self) -> int:
        """Pull recent storm events into the unified table."""
        from app.models.storm_event import StormEvent

        count = 0
        with self.db as session:
            from sqlalchemy import select

            stmt = select(StormEvent).where(StormEvent.is_active.is_(True))
            storm_events = list(session.scalars(stmt).all())

        for se in storm_events:
            existing = crud.incident.find_duplicate(
                self.db,
                incident_type="storm",
                address=f"{se.county}, {se.state}",
                occurred_at=se.reported_at,
                external_id=se.external_id,
                source=f"storm_{se.data_source}",
            )
            if existing:
                continue

            inc_data = IncidentCreate(
                incident_type="storm",
                source=f"storm_{se.data_source}",
                external_id=se.external_id,
                address=f"{se.county}, {se.state}",
                state=se.state,
                latitude=se.latitude,
                longitude=se.longitude,
                occurred_at=se.reported_at,
                description=f"{se.event_type}: {se.title}",
                severity=se.severity,
                source_record_id=str(se.id),
            )
            scored = self._score_incident(inc_data)
            crud.incident.create(self.db, obj_in=scored)
            count += 1

        logger.info("Synced %d storm events", count)
        return count

    def sync_all_sources(self) -> dict:
        """Sync all incident sources into the unified table."""
        return {
            "fire": self.sync_fire_incidents(),
            "crime": self.sync_crime_incidents(),
            "storm": self.sync_storm_events(),
        }
