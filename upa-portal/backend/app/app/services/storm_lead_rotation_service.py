#!/usr/bin/env python

"""
Storm Lead Rotation Service
=============================
Automatically converts eligible P1/P2 storm claim zones into leads,
distributes them to all agents in matching territories, and dispatches
delivery notifications.

Called by the `process_storm_claim_zones` Celery task after storm polling.
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud
from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.territory import Territory, UserTerritory
from app.services.lead_distribution_service import distribute_multi_agent_lead

logger = logging.getLogger(__name__)

# Map event_type → lead_type for territory flag checking
EVENT_TO_LEAD_TYPE = {
    "hail": "hail",
    "wind": "storm",
    "tornado": "storm",
    "lightning": "lightning",
    "flooding": "flood",
    "fire": "fire",
}


class StormLeadRotationService:
    """Orchestrates automatic lead creation from P1/P2 storm claim zones."""

    def __init__(self, db_session: Session):
        self.db = db_session

    def process_zone(self, zone_data: dict) -> None:
        """
        Main entry point. Attempt to auto-convert a single claim zone into a lead.

        zone_data keys:
          - zone_id: str (e.g. "PCZ-Clark-IN" or "PCZ-FIRE-TX")
          - event_type: str
          - county: str
          - state: str
          - priority: str (P1-P4)
          - claim_probability: float
          - name: str

        Guards (in order):
        1. Zone already has a lead (check tracker) → skip
        2. Priority not P1 or P2 → skip
        3. No territory match → skip
        4. Lead type not enabled for territory → skip
        5. No eligible agents → skip
        """
        zone_id = zone_data.get("zone_id", "")
        priority = zone_data.get("priority", "P4")
        event_type = zone_data.get("event_type", "")
        county = zone_data.get("county", "")
        state = zone_data.get("state", "")

        # Guard: already has a lead
        if crud.claim_zone_lead_tracker.has_lead_been_generated(self.db, zone_id=zone_id):
            logger.debug("Zone %s already has a lead — skipping", zone_id)
            return

        # Guard: only P1 and P2
        if priority not in ("P1", "P2"):
            logger.debug("Zone %s is %s — skipping (only P1/P2)", zone_id, priority)
            return

        # Map event type to lead type
        lead_type = EVENT_TO_LEAD_TYPE.get(event_type, "storm")

        # Find territory
        territory = self._find_territory(county, state, lead_type)
        if not territory:
            logger.info("Zone %s: no matching territory for %s, %s — skipping", zone_id, county, state)
            return

        # Create lead
        try:
            lead = self._create_lead(zone_data, territory)
        except Exception:
            logger.exception("Failed to create lead for zone %s", zone_id)
            return

        # Trigger skip trace for owner intelligence
        try:
            from app.core.celery_app import celery_app
            celery_app.send_task(
                "app.tasks.skip_trace.run_skiptrace_for_lead",
                args=[str(lead.id)],
            )
        except Exception:
            logger.warning("Failed to queue skip trace for lead %s", lead.id)

        # Record in tracker
        crud.claim_zone_lead_tracker.create(
            self.db,
            zone_id=zone_id,
            event_type=event_type,
            county=county,
            state=state,
            priority=priority,
            claim_probability=zone_data.get("claim_probability"),
            lead_id=lead.id,
            territory_id=territory.id,
        )

        # Distribute to all eligible agents
        try:
            result = distribute_multi_agent_lead(
                self.db,
                lead_id=lead.id,
                territory_id=territory.id,
                lead_type=lead_type,
            )
        except ValueError as exc:
            logger.warning(
                "Distribution failed for zone %s / lead %s: %s",
                zone_id, lead.id, exc,
            )
            return

        # Dispatch delivery notifications
        for agent_info in result.get("assigned_agents", []):
            if settings.AI_CONTACT_ENABLED:
                celery_app.send_task(
                    "app.tasks.ai_contact.initiate_ai_contact",
                    args=[
                        str(lead.id),
                        agent_info["agent_id"],
                        str(territory.id),
                        lead_type,
                    ],
                )
            else:
                celery_app.send_task(
                    "app.tasks.lead_delivery.deliver_lead_assignment",
                    args=[
                        str(lead.id),
                        agent_info["agent_id"],
                        str(territory.id),
                        lead_type,
                    ],
                )

        logger.info(
            "Auto-converted zone %s → lead %s, assigned to %d agent(s) in territory %s",
            zone_id,
            lead.id,
            len(result.get("assigned_agents", [])),
            territory.name,
        )

    def _find_territory(self, county: str, state: str, lead_type: str) -> Territory | None:
        """
        Find matching territory by county + state, then fallback to state-level.
        Territory must be active, have agents, and have the lead type enabled.
        """
        state_upper = (state or "").strip().upper()[:2]

        # Build the lead_type flag attribute name
        from app.services.lead_distribution_service import LEAD_TYPE_FLAG_MAP
        flag_attr = LEAD_TYPE_FLAG_MAP.get(lead_type)
        if not flag_attr:
            return None

        with self.db as session:
            # County-level territory
            if county:
                stmt = (
                    select(Territory)
                    .join(UserTerritory, UserTerritory.territory_id == Territory.id)
                    .where(
                        Territory.is_active == True,
                        Territory.territory_type == "county",
                        Territory.state == state_upper,
                        Territory.county == county,
                        getattr(Territory, flag_attr) == True,
                    )
                    .order_by(Territory.name.asc())
                    .limit(1)
                )
                territory = session.execute(stmt).scalar_one_or_none()
                if territory:
                    return territory

            # State-level fallback
            stmt_state = (
                select(Territory)
                .join(UserTerritory, UserTerritory.territory_id == Territory.id)
                .where(
                    Territory.is_active == True,
                    Territory.territory_type == "state",
                    Territory.state == state_upper,
                    getattr(Territory, flag_attr) == True,
                )
                .order_by(Territory.name.asc())
                .limit(1)
            )
            return session.execute(stmt_state).scalar_one_or_none()

    def _create_lead(self, zone_data: dict, territory: Territory) -> Lead:
        """Create a Lead + LeadContact from zone data."""
        with self.db as session:
            new_ref = crud.lead.generate_new_ref_number(self.db)
            lead_type = EVENT_TO_LEAD_TYPE.get(zone_data.get("event_type", ""), "storm")

            lead = Lead(
                ref_number=new_ref,
                peril=lead_type,
                status="callback",
                source_info="auto-storm-lead",
                instructions_or_notes=(
                    f"Auto-generated from {zone_data.get('name', 'claim zone')} "
                    f"({zone_data.get('priority', '')} — {zone_data.get('claim_probability', 0)}% probability)"
                ),
            )
            session.add(lead)
            session.flush()

            contact = LeadContact(
                lead_id=lead.id,
                full_name="Property Owner",
                phone_number="N/A",
                state_loss=zone_data.get("state"),
            )
            session.add(contact)
            session.commit()
            session.refresh(lead)
            return lead
