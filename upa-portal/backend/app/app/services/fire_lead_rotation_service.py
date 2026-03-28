#!/usr/bin/env python

"""
Fire Lead Rotation Service
===========================
Automatically converts eligible fire incidents into leads, distributes them
to agents via round-robin rotation, and dispatches delivery notifications.

Called by the `process_new_fire_incidents` Celery task after polling inserts
new incidents.
"""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud
from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.fire_incident import FireIncident
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.territory import Territory, UserTerritory
from app.services.lead_distribution_service import distribute_fire_lead

logger = logging.getLogger(__name__)


class FireLeadRotationService:
    """Orchestrates automatic lead creation from fire incidents."""

    def __init__(self, db_session: Session):
        self.db = db_session

    def process_incident(self, incident_id: UUID) -> None:
        """
        Main entry point. Attempt to auto-convert a single fire incident into a lead.

        Guards (in order):
        1. Incident already has a lead → skip
        2. auto_lead_attempted already True → skip
        3. Call type not in auto-lead-eligible set → skip + log reason
        4. No territory match → skip + log reason
        5. No eligible agents → skip + log reason
        """
        with self.db as session:
            # SELECT FOR UPDATE SKIP LOCKED to prevent concurrent processing
            incident = session.execute(
                select(FireIncident)
                .where(FireIncident.id == incident_id)
                .with_for_update(skip_locked=True)
            ).scalar_one_or_none()

            if not incident:
                logger.debug("Incident %s not found or locked by another worker", incident_id)
                return

            # Guard: already has a lead
            if incident.lead_id is not None:
                logger.debug("Incident %s already linked to lead %s — skipping", incident_id, incident.lead_id)
                incident.auto_lead_attempted = True
                session.add(incident)
                session.commit()
                return

            # Guard: already attempted
            if incident.auto_lead_attempted:
                logger.debug("Incident %s already attempted — skipping", incident_id)
                return

            # Guard: check call type eligibility
            eligible_codes = self._get_auto_lead_eligible_call_types()
            if incident.call_type not in eligible_codes:
                self._mark_skipped(session, incident, "ineligible_call_type")
                return

            # Find territory via agency state
            territory = self._find_territory_for_incident(session, incident)
            if not territory:
                self._mark_skipped(session, incident, "no_territory_match")
                return

            # Create lead + contact
            try:
                lead = self._create_lead_from_incident(session, incident, territory)
            except Exception:
                logger.exception("Failed to create lead from incident %s", incident_id)
                self._mark_skipped(session, incident, "lead_creation_error")
                return

            # Link incident to lead
            incident.lead_id = lead.id
            incident.auto_lead_attempted = True
            session.add(incident)
            session.commit()

            # Trigger skip trace for owner intelligence
            try:
                celery_app.send_task(
                    "app.tasks.skip_trace.run_skiptrace_for_lead",
                    args=[str(lead.id)],
                )
            except Exception:
                logger.warning("Failed to queue skip trace for lead %s", lead.id)

            # Distribute via round-robin
            try:
                result = distribute_fire_lead(
                    self.db,
                    lead_id=lead.id,
                    territory_id=territory.id,
                )
            except ValueError as exc:
                logger.warning(
                    "Distribution failed for incident %s / lead %s: %s",
                    incident_id, lead.id, exc,
                )
                return

            # Dispatch contact / delivery notifications
            for agent_info in result.get("assigned_agents", []):
                if settings.AI_CONTACT_ENABLED:
                    celery_app.send_task(
                        "app.tasks.ai_contact.initiate_ai_contact",
                        args=[
                            str(lead.id),
                            agent_info["agent_id"],
                            str(territory.id),
                            "fire",
                        ],
                    )
                else:
                    celery_app.send_task(
                        "app.tasks.lead_delivery.deliver_lead_assignment",
                        args=[
                            str(lead.id),
                            agent_info["agent_id"],
                            str(territory.id),
                            "fire",
                        ],
                    )

            logger.info(
                "Auto-converted incident %s → lead %s, assigned to %d agent(s) in territory %s",
                incident_id,
                lead.id,
                len(result.get("assigned_agents", [])),
                territory.name,
            )

    def _get_auto_lead_eligible_call_types(self) -> set[str]:
        """Query CallTypeConfig for codes with auto_lead_enabled = True."""
        return crud.call_type_config.get_auto_lead_codes(self.db)

    def _find_territory_for_incident(
        self, session: Session, incident: FireIncident
    ) -> Territory | None:
        """
        Match incident to a territory via the agency's state.

        Strategy: county-level territory first, then fallback to state-level.
        Territory must have at least one assigned agent and lead_fire_enabled.
        """
        agency = incident.agency
        if not agency or not agency.state:
            return None

        state = agency.state.strip().upper()[:2]

        # County territory with agents and fire enabled
        stmt = (
            select(Territory)
            .join(UserTerritory, UserTerritory.territory_id == Territory.id)
            .where(
                Territory.is_active == True,
                Territory.territory_type == "county",
                Territory.state == state,
                Territory.lead_fire_enabled == True,
            )
            .order_by(Territory.name.asc())
            .limit(1)
        )
        territory = session.execute(stmt).scalar_one_or_none()
        if territory:
            return territory

        # Fallback: state-level territory
        stmt_state = (
            select(Territory)
            .join(UserTerritory, UserTerritory.territory_id == Territory.id)
            .where(
                Territory.is_active == True,
                Territory.territory_type == "state",
                Territory.state == state,
                Territory.lead_fire_enabled == True,
            )
            .order_by(Territory.name.asc())
            .limit(1)
        )
        return session.execute(stmt_state).scalar_one_or_none()

    def _create_lead_from_incident(
        self, session: Session, incident: FireIncident, territory: Territory
    ) -> Lead:
        """Create a Lead + LeadContact from incident data."""
        # Generate ref number
        new_ref = crud.lead.generate_new_ref_number(self.db)

        lead = Lead(
            ref_number=new_ref,
            peril="fire",
            loss_date=incident.received_at,
            status="callback",
            source_info="auto-fire-lead",
            instructions_or_notes=f"Auto-generated from fire incident ({incident.call_type_description or incident.call_type})",
        )
        session.add(lead)
        session.flush()  # get lead.id

        # Derive state from agency for loss address
        agency_state = incident.agency.state if incident.agency else None

        contact = LeadContact(
            lead_id=lead.id,
            full_name="Property Owner",
            phone_number="N/A",
            address_loss=incident.address,
            state_loss=agency_state,
        )
        session.add(contact)
        session.commit()
        session.refresh(lead)

        return lead

    @staticmethod
    def _mark_skipped(session: Session, incident: FireIncident, reason: str) -> None:
        """Mark an incident as attempted with a skip reason."""
        incident.auto_lead_attempted = True
        incident.auto_lead_skipped_reason = reason
        session.add(incident)
        session.commit()
        logger.info("Incident %s skipped for auto-lead: %s", incident.id, reason)
