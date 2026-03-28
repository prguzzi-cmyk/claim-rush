#!/usr/bin/env python

"""
Claim Zone → Lead Generation Pipeline
=======================================
A **separate** service that converts P1/P2 predicted claim zones into
property-level leads.  This does NOT modify the Storm Prediction Engine.

Trigger
-------
Called asynchronously (via Celery) when a predicted claim zone reaches
severity P1 or P2.

Pipeline Steps
--------------
1. Identify properties within the zone boundary (OpenStreetMap / Overpass).
2. Generate PotentialClaim records for each property.
3. Create Lead + LeadContact for qualified properties.
4. Assign leads to agents by licensing state/county territory.
5. Push into the existing Lead Rotation system.

Each lead includes:
  - property address
  - event type
  - estimated claim probability
  - estimated claim value
  - event timestamp
  - source zone ID
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud
from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.potential_claim import PotentialClaim
from app.models.territory import Territory, UserTerritory
from app.services.lead_distribution_service import (
    LEAD_TYPE_FLAG_MAP,
    distribute_multi_agent_lead,
)
from app.utils.osm_properties import get_properties_in_radius

logger = logging.getLogger(__name__)

# Minimum claim probability to generate a lead (configurable via settings)
MIN_LEAD_PROBABILITY = 50

# Map event_type → lead_type for territory flag checking
EVENT_TO_LEAD_TYPE = {
    "hail": "hail",
    "wind": "storm",
    "tornado": "storm",
    "lightning": "lightning",
    "hurricane": "storm",
    "flooding": "flood",
    "fire": "fire",
}

# Base claim value estimates by event type and property type
_BASE_CLAIM_VALUES = {
    "hail": {"Single Family": 12_000, "Multi-Family": 25_000, "default": 15_000},
    "wind": {"Single Family": 8_000, "Multi-Family": 18_000, "default": 10_000},
    "tornado": {"Single Family": 45_000, "Multi-Family": 80_000, "default": 50_000},
    "hurricane": {"Single Family": 35_000, "Multi-Family": 65_000, "default": 40_000},
    "lightning": {"Single Family": 5_000, "Multi-Family": 10_000, "default": 6_000},
}


def _estimate_claim_value(
    event_type: str, property_type: str, claim_probability: int
) -> float:
    """Estimate claim value based on event type, property type, and probability."""
    type_values = _BASE_CLAIM_VALUES.get(event_type, _BASE_CLAIM_VALUES["wind"])
    base = type_values.get(property_type, type_values["default"])
    # Scale by probability: higher probability → closer to full base value
    return round(base * (claim_probability / 100.0), 2)


class ClaimZoneLeadPipelineService:
    """Orchestrates the full Claim Zone → Lead Generation pipeline.

    This is a **separate service** from the Storm Prediction Engine and
    StormLeadRotationService.  It focuses on property-level lead generation
    whereas StormLeadRotationService handles zone-level lead creation.
    """

    def __init__(self, db_session: Session):
        self.db = db_session

    def run_pipeline(self, zone_data: dict) -> dict:
        """Execute the full pipeline for a single claim zone.

        Parameters
        ----------
        zone_data : dict
            Keys: zone_id, event_type, county, state, priority,
                  claim_probability, center (list[float]),
                  radius_meters, event_timestamp, storm_event_id (optional)

        Returns
        -------
        dict
            Summary with keys: zone_id, properties_discovered,
            claims_created, leads_created, leads_assigned, errors
        """
        zone_id = zone_data["zone_id"]
        priority = zone_data.get("priority", "P4")
        event_type = zone_data.get("event_type", "")
        county = zone_data.get("county", "")
        state = zone_data.get("state", "")
        center = zone_data.get("center", [0.0, 0.0])
        radius_meters = zone_data.get("radius_meters", 5000)
        claim_probability = zone_data.get("claim_probability", 0)
        event_timestamp = zone_data.get("event_timestamp")
        storm_event_id = zone_data.get("storm_event_id")

        summary = {
            "zone_id": zone_id,
            "properties_discovered": 0,
            "claims_created": 0,
            "leads_created": 0,
            "leads_assigned": 0,
            "errors": 0,
        }

        # Guard: only P1 and P2
        if priority not in ("P1", "P2"):
            logger.debug("Pipeline: zone %s is %s — skipping", zone_id, priority)
            return summary

        # Guard: already processed this zone
        existing_count = crud.potential_claim.count_by_zone(self.db, zone_id=zone_id)
        if existing_count > 0:
            logger.debug(
                "Pipeline: zone %s already has %d claims — skipping",
                zone_id,
                existing_count,
            )
            return summary

        logger.info(
            "Pipeline: starting for zone %s (%s, %s %s, P=%d%%)",
            zone_id,
            event_type,
            county,
            state,
            claim_probability,
        )

        # ── Step 1: Identify properties ─────────────────────────────────
        radius_miles = radius_meters / 1609.34
        center_lat = center[0] if len(center) > 0 else 0.0
        center_lng = center[1] if len(center) > 1 else 0.0

        try:
            properties = get_properties_in_radius(center_lat, center_lng, radius_miles)
        except Exception as exc:
            logger.error("Pipeline: property discovery failed for zone %s: %s", zone_id, exc)
            summary["errors"] += 1
            return summary

        summary["properties_discovered"] = len(properties)
        if not properties:
            logger.info("Pipeline: no properties found for zone %s", zone_id)
            return summary

        # ── Step 2: Generate PotentialClaim records ──────────────────────
        avg_claim_value = _estimate_claim_value(
            event_type, "default", claim_probability
        )

        storm_event_uuid = None
        if storm_event_id:
            try:
                storm_event_uuid = UUID(str(storm_event_id))
            except (ValueError, AttributeError):
                pass

        try:
            inserted = crud.potential_claim.bulk_create_from_properties(
                self.db,
                zone_id=zone_id,
                properties=properties,
                event_type=event_type,
                claim_probability=claim_probability,
                estimated_claim_value=avg_claim_value,
                event_timestamp=event_timestamp,
                severity=priority,
                county=county,
                storm_event_id=storm_event_uuid,
            )
            summary["claims_created"] = inserted
        except Exception as exc:
            logger.error(
                "Pipeline: bulk claim creation failed for zone %s: %s",
                zone_id,
                exc,
            )
            summary["errors"] += 1
            return summary

        logger.info(
            "Pipeline: created %d potential claims for zone %s",
            inserted,
            zone_id,
        )

        # ── Step 3-5: Create leads and assign to agents ──────────────────
        lead_type = EVENT_TO_LEAD_TYPE.get(event_type, "storm")
        territory = self._find_territory(county, state, lead_type)

        if not territory:
            logger.warning(
                "Pipeline: no territory match for zone %s (%s, %s) — "
                "claims created but leads not assigned",
                zone_id,
                county,
                state,
            )
            return summary

        # Get pending claims above minimum probability
        min_prob = getattr(settings, "CLAIM_ZONE_MIN_LEAD_PROBABILITY", MIN_LEAD_PROBABILITY)
        pending_claims = crud.potential_claim.get_pending_for_zone(
            self.db, zone_id=zone_id, min_probability=min_prob
        )

        for pc in pending_claims:
            try:
                lead = self._create_lead_from_claim(pc, zone_data, territory)
                summary["leads_created"] += 1

                # Update PotentialClaim with lead reference
                crud.potential_claim.update_status(
                    self.db,
                    claim_id=pc.id,
                    status="lead_created",
                    lead_id=lead.id,
                    territory_id=territory.id,
                )

                # Distribute to agents
                try:
                    result = distribute_multi_agent_lead(
                        self.db,
                        lead_id=lead.id,
                        territory_id=territory.id,
                        lead_type=lead_type,
                    )
                    agent_count = len(result.get("assigned_agents", []))
                    summary["leads_assigned"] += agent_count

                    # Update status to assigned
                    crud.potential_claim.update_status(
                        self.db,
                        claim_id=pc.id,
                        status="assigned",
                    )

                    # Dispatch delivery notifications
                    for agent_info in result.get("assigned_agents", []):
                        if getattr(settings, "AI_CONTACT_ENABLED", False):
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

                except ValueError as exc:
                    logger.warning(
                        "Pipeline: distribution failed for claim %s: %s",
                        pc.id,
                        exc,
                    )

            except Exception as exc:
                logger.error(
                    "Pipeline: lead creation failed for claim %s: %s",
                    pc.id,
                    exc,
                )
                summary["errors"] += 1

        logger.info(
            "Pipeline complete for zone %s: %d properties, %d claims, "
            "%d leads, %d assigned, %d errors",
            zone_id,
            summary["properties_discovered"],
            summary["claims_created"],
            summary["leads_created"],
            summary["leads_assigned"],
            summary["errors"],
        )

        return summary

    def _find_territory(
        self, county: str, state: str, lead_type: str
    ) -> Territory | None:
        """Find matching territory by county + state, then fallback to state-level."""
        state_upper = (state or "").strip().upper()[:2]
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

    def _create_lead_from_claim(
        self, pc: PotentialClaim, zone_data: dict, territory: Territory
    ) -> Lead:
        """Create a Lead + LeadContact from a PotentialClaim record.

        Each lead includes all required fields:
          - property address
          - event type
          - estimated claim probability
          - estimated claim value
          - event timestamp
          - source zone ID
        """
        lead_type = EVENT_TO_LEAD_TYPE.get(pc.event_type, "storm")

        with self.db as session:
            new_ref = crud.lead.generate_new_ref_number(self.db)

            lead = Lead(
                ref_number=new_ref,
                peril=lead_type,
                status="callback",
                source_info="claim-zone-pipeline",
                loss_date=pc.event_timestamp,
                instructions_or_notes=(
                    f"Auto-generated from Claim Zone Pipeline\n"
                    f"Zone: {pc.zone_id}\n"
                    f"Event: {pc.event_type}\n"
                    f"Claim Probability: {pc.claim_probability}%\n"
                    f"Estimated Value: ${pc.estimated_claim_value:,.2f}\n"
                    f"Property: {pc.property_address}, {pc.city}, {pc.state} {pc.zip_code}\n"
                    f"Severity: {pc.severity}"
                ),
            )
            session.add(lead)
            session.flush()

            contact = LeadContact(
                lead_id=lead.id,
                full_name="Property Owner",
                phone_number="N/A",
                address_loss=pc.property_address,
                city_loss=pc.city or "",
                state_loss=pc.state,
                zip_code_loss=pc.zip_code or "",
            )
            session.add(contact)
            session.commit()
            session.refresh(lead)
            return lead
