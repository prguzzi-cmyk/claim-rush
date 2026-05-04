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
from app.models.fire_incident import FireIncident
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.territory import Territory, UserTerritory
from app.models.user import User

logger = logging.getLogger(__name__)

# Sentinel UUID for the RIN Home Office system user (created Stage 1).
# When no Chapter President covers a lead's state, the lead is owned by
# this user as the policy fallback. The hourly rollup task (Stage 6) will
# email a state-grouped digest of newly home-office-owned leads.
HOME_OFFICE_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


# ── Fire-signal predicate ──────────────────────────────────────────────
# Conservative allowlist of PulsePoint call_type codes that represent a
# real structural fire worth converting into a lead. Anything not in
# this set is dropped at the conversion gate with skip reason
# "ineligible_call_type" — including alarms, medical, traffic, vehicle
# fire, vegetation/wildland, hazmat, rescue, and ambiguous "outside"
# fires.
#
# This deliberately overrides the data-driven CallTypeConfig.auto_lead_
# enabled lookup so we control lead quality from code, not from a table
# that other migrations (or admin UI) might inadvertently widen.
#
# WF caveat: app/utils/pulsepoint.py treats "WF" as "Working Fire"
# (active confirmed structure fire). The legacy alembic seed for
# call_type_config treats "WF" as "Wildland Fire" — a real per-agency
# CAD difference. LAFDC and most PulsePoint agencies use the Working
# Fire reading; revisit per-agency overrides before scaling to
# wildland-prone agencies that use WF for vegetation.
FIRE_SIGNAL_CODES: frozenset[str] = frozenset({
    "SF",   # Structure Fire
    "WSF",  # Confirmed (Working) Structure Fire
    "WF",   # Working Fire (PulsePoint reading; see caveat above)
    "AF",   # Appliance Fire (in-structure)
})

# Flooding ("FL") is intentionally NOT in FIRE_SIGNAL_CODES — it is a
# water-damage signal handled by WATER_SIGNAL_CODES below. Fire vs water
# stays segregated end-to-end: separate predicate, separate peril value,
# separate routing-engine `lead_source`, separate UI chip.
WATER_SIGNAL_CODES: frozenset[str] = frozenset({
    "FL",   # Flooding (PulsePoint dispatch — water damage at a structure)
})


def is_fire_signal(call_type: str | None) -> bool:
    """True iff the dispatch code is a real structural fire worth a lead.
    Case-insensitive; tolerates None / empty for defensive callers."""
    if not call_type:
        return False
    return call_type.upper() in FIRE_SIGNAL_CODES


def is_water_signal(call_type: str | None) -> bool:
    """True iff the dispatch code is a real water-damage event worth a
    lead (currently just FL Flooding). Case-insensitive."""
    if not call_type:
        return False
    return call_type.upper() in WATER_SIGNAL_CODES


# Per-signal lead-creation defaults. Keyed by canonical signal kind so
# adding a new water code (or a third peril category) is a one-line
# extension. The fire entry preserves the original hard-coded values
# so existing fire leads round-trip identically.
_LEAD_DEFAULTS_BY_KIND: dict[str, dict[str, str]] = {
    "fire": {
        "peril": "fire",
        "lead_type": "structure_fire",
        "source_info": "auto-fire-lead",
        "routing_source": "fire",
        "incident_label": "fire incident",
    },
    "water": {
        "peril": "flood",
        "lead_type": "flood_damage",
        "source_info": "auto-water-lead",
        "routing_source": "flood",
        "incident_label": "flooding incident",
    },
}


def _signal_kind(call_type: str | None) -> str | None:
    """Return 'fire' / 'water' / None for a call_type. Used to pick the
    correct lead defaults + routing source. None means the gate would
    have already rejected the incident."""
    if is_fire_signal(call_type):
        return "fire"
    if is_water_signal(call_type):
        return "water"
    return None


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
                # Scope the row lock to FireIncident itself; without `of=`,
                # Postgres rejects FOR UPDATE on the eagerly-joined `agency`
                # relationship ("cannot be applied to the nullable side of
                # an outer join"). The lock-skip semantics are preserved.
                .with_for_update(skip_locked=True, of=FireIncident)
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

            # ── REVISED OWNERSHIP POLICY (Reading A) ─────────────────────
            # Every lead has an owner on creation. Owner is the state's
            # Chapter President if one is active, otherwise the RIN Home
            # Office system user. Adjuster-level rotation does NOT run
            # here — it runs only after the CP delegates the lead.
            # CP `is_accepting_leads` is intentionally NOT gated: a CP
            # owns their state's leads even when off-duty.
            # ─────────────────────────────────────────────────────────────
            agency_state = (incident.agency.state if incident.agency else None)
            cp_id = self._find_cp_for_state(session, agency_state)
            owner_id = cp_id if cp_id is not None else HOME_OFFICE_USER_ID
            bucket = "cp" if cp_id is not None else "house"

            # Create lead + contact. Territory arg is unused inside
            # _create_lead_from_incident; passing None preserves the
            # signature without a behavior change.
            try:
                lead = self._create_lead_from_incident(session, incident, None)
            except Exception:
                logger.exception("Failed to create lead from incident %s", incident_id)
                self._mark_skipped(session, incident, "lead_creation_error")
                return

            # Set ownership + bucket. House visibility (escalated_to_aci)
            # preserved so existing house-feed views still surface every
            # structure-fire lead regardless of who owns it.
            lead.assigned_to = owner_id
            lead.routing_bucket = bucket
            lead.escalated_to_aci = True
            session.add(lead)

            # Link incident to lead and record the routing reason.
            incident.lead_id = lead.id
            incident.auto_lead_attempted = True
            if cp_id is None:
                incident.auto_lead_skipped_reason = "no_cp_coverage_home_office"
                # Structured signal for Stage 6's hourly rollup. The rollup
                # itself queries the lead table on a time window — this log
                # is for ad-hoc CloudWatch search, not a primary event bus.
                logger.info(
                    "uncovered_state_routed_home_office state=%s lead_id=%s incident_id=%s",
                    agency_state, lead.id, incident_id,
                )
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

            # Adjuster-level rotation (route_lead, AI contact, lead
            # delivery) intentionally NOT invoked here. Per Reading A,
            # those run only after the CP explicitly delegates the lead.
            logger.info(
                "Auto-converted incident %s -> lead %s; owner=%s state=%s bucket=%s cp_owned=%s",
                incident_id, lead.id, owner_id, agency_state, bucket, cp_id is not None,
            )

    def _get_auto_lead_eligible_call_types(self) -> frozenset[str]:
        """Return the union of fire + water signal codes that are eligible
        for auto-conversion. The downstream code path branches on the
        signal kind (via _signal_kind / _LEAD_DEFAULTS_BY_KIND) to set
        the correct peril, lead_type, and routing source — fire stays
        fire, water becomes flood, no cross-contamination.

        Previously delegated to CallTypeConfig.auto_lead_enabled (a
        data-driven, per-row admin toggle). Replaced with the static
        FIRE_SIGNAL_CODES + WATER_SIGNAL_CODES frozensets above so lead
        quality stays under code review, not table edits. The existing
        call-site logic at process_incident() —
        `if incident.call_type not in eligible_codes` — keeps working
        unchanged because frozenset union supports `in`.
        """
        return FIRE_SIGNAL_CODES | WATER_SIGNAL_CODES

    @staticmethod
    def _find_cp_for_state(session: Session, state: str | None) -> UUID | None:
        """Return the active Chapter President's user UUID for a given
        state, or None if no covered CP exists.

        Coverage rule: a CP "covers" a state when (a) a state-level
        Territory row exists for that state with `is_active=True` and a
        non-NULL `chapter_president_id`, and (b) the referenced User is
        active and not soft-deleted. `is_accepting_leads` is intentionally
        NOT gated — CP ownership reflects state-level responsibility, not
        per-lead capacity. Adjuster-level rotation (which does check
        capacity) runs only after the CP delegates.
        """
        if not state:
            return None
        normalized = state.strip().upper()[:2]
        stmt = (
            select(Territory.chapter_president_id)
            .join(User, User.id == Territory.chapter_president_id)
            .where(
                Territory.territory_type == "state",
                Territory.state == normalized,
                Territory.is_active.is_(True),
                Territory.chapter_president_id.isnot(None),
                User.is_active.is_(True),
                User.is_removed.is_(False),
            )
            .limit(1)
        )
        return session.execute(stmt).scalar_one_or_none()

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
        self, session: Session, incident: FireIncident, territory: Territory | None
    ) -> Lead:
        """Create a Lead + LeadContact from incident data.

        Lead defaults (peril, lead_type, source_info, incident_label) are
        derived from the signal kind via _LEAD_DEFAULTS_BY_KIND so fire
        signals produce peril='fire' and water signals produce
        peril='flood' — segregating Fire Leads from Water Leads in the
        same lead table without any schema change.
        """
        # Generate ref number
        new_ref = crud.lead.generate_new_ref_number(self.db)

        kind = _signal_kind(incident.call_type)
        defaults = _LEAD_DEFAULTS_BY_KIND.get(kind, _LEAD_DEFAULTS_BY_KIND["fire"])

        lead = Lead(
            ref_number=new_ref,
            peril=defaults["peril"],
            lead_type=defaults["lead_type"],
            loss_date=incident.received_at,
            status="callback",
            source_info=defaults["source_info"],
            instructions_or_notes=(
                f"Auto-generated from {defaults['incident_label']} "
                f"({incident.call_type_description or incident.call_type})"
            ),
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
