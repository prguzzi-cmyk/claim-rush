#!/usr/bin/env python

"""
Lead Delivery Service
======================
Orchestrates automatic lead distribution + delivery notifications.
Called after a lead is created to:
  1. Find a matching territory by the lead's loss address (state).
  2. Distribute the lead via the distribution engine (CP → rotation → national queue).
  3. Dispatch async Celery tasks to deliver SMS + email to assigned agents.
  4. Log the assignment in the activity feed.
"""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.models.lead import Lead
from app.models.territory import Territory, UserTerritory
from app.services.lead_distribution_service import (
    distribute_lead,
    REASON_CP_PRIORITY,
    REASON_NATIONAL_QUEUE,
    REASON_ROTATION,
)

logger = logging.getLogger(__name__)

# Map peril text → distribution lead_type
PERIL_MAP = {
    "fire": "fire",
    "hail": "hail",
    "storm": "storm",
    "wind": "storm",
    "hurricane": "storm",
    "tornado": "storm",
    "lightning": "lightning",
    "flood": "flood",
    "water": "flood",
    "theft": "theft_vandalism",
    "vandalism": "theft_vandalism",
    "burglary": "theft_vandalism",
}

# Human-readable labels for assignment reasons
_REASON_LABELS = {
    REASON_CP_PRIORITY: "Chapter President priority",
    REASON_ROTATION: "territory rotation",
    REASON_NATIONAL_QUEUE: "national queue (no territory agents)",
}


class LeadDeliveryService:
    """Orchestrates automatic territory matching, distribution, and delivery dispatch."""

    def __init__(self, db_session: Session):
        self.db_session = db_session

    def auto_distribute_and_deliver(self, lead_id: UUID, lead_entity: Lead) -> dict | None:
        """
        Called after lead creation. Finds territory, distributes, triggers delivery.

        Distribution priority:
          1. Chapter President → assign first if available
          2. Territory agents → rotate (fire) or broadcast (other)
          3. National queue → fallback when no territory agents

        Returns the distribution result dict, or None if no territory matched.
        """
        territory = self._find_territory_for_lead(lead_entity)
        if not territory:
            logger.warning(
                "No territory match for lead %s (state_loss=%s)",
                lead_id,
                getattr(lead_entity.contact, "state_loss", None) if lead_entity.contact else None,
            )
            return None

        lead_type = self._determine_lead_type(lead_entity)
        logger.info(
            "Auto-distributing lead %s as '%s' in territory '%s' (%s)",
            lead_id, lead_type, territory.name, territory.id,
        )

        result = distribute_lead(
            self.db_session,
            lead_id=lead_id,
            territory_id=territory.id,
            lead_type=lead_type,
        )

        assignment_reason = result.get("assignment_reason", REASON_ROTATION)
        assigned_agents = result.get("assigned_agents", [])
        reason_label = _REASON_LABELS.get(assignment_reason, assignment_reason)

        # Dispatch async delivery for each assigned agent
        for agent_info in assigned_agents:
            celery_app.send_task(
                "app.tasks.lead_delivery.deliver_lead_assignment",
                args=[
                    str(lead_id),
                    agent_info["agent_id"],
                    str(territory.id),
                    lead_type,
                ],
            )

        # Log the distribution in the activity feed
        self._log_distribution_activity(
            lead_entity=lead_entity,
            assigned_agents=assigned_agents,
            territory=territory,
            lead_type=lead_type,
            reason_label=reason_label,
        )

        logger.info(
            "Auto-distribution complete for lead %s: %d agents assigned via %s",
            lead_id, len(assigned_agents), reason_label,
        )
        return result

    def _log_distribution_activity(
        self,
        *,
        lead_entity: Lead,
        assigned_agents: list[dict],
        territory: Territory,
        lead_type: str,
        reason_label: str,
    ) -> None:
        """Log lead distribution as a RotationLeadActivity entry if a rotation_lead exists."""
        try:
            from app.models.rotation_lead import RotationLead
            from app.models.rotation_lead_activity import RotationLeadActivity

            with self.db_session as session:
                # Find the rotation lead associated with this lead
                stmt = select(RotationLead).where(RotationLead.lead_id == lead_entity.id)
                rotation_lead = session.execute(stmt).scalar_one_or_none()

                if not rotation_lead:
                    # No rotation lead record — skip activity logging
                    return

                agent_names = ", ".join(a["agent_name"] for a in assigned_agents)
                description = (
                    f"Lead auto-assigned to {agent_names} via {reason_label} "
                    f"in territory '{territory.name}' ({lead_type})"
                )

                activity = RotationLeadActivity(
                    rotation_lead_id=rotation_lead.id,
                    activity_type="lead-distributed",
                    description=description,
                    new_value=agent_names,
                )
                session.add(activity)
                session.commit()
        except Exception:
            logger.debug(
                "Could not log distribution activity for lead %s (non-critical)",
                lead_entity.id,
            )

    def _find_territory_for_lead(self, lead_entity: Lead) -> Territory | None:
        """
        Match lead's loss address state to an active territory.

        Strategy:
          - Use state_loss from LeadContact to find county-level territories.
          - Also consider territories with a Chapter President even without agents.
          - Fall back to state-level territory.
        """
        contact = lead_entity.contact
        if not contact or not contact.state_loss:
            return None

        state = contact.state_loss.strip().upper()[:2]

        with self.db_session as session:
            # Try county territories with agents assigned
            stmt = (
                select(Territory)
                .join(UserTerritory, UserTerritory.territory_id == Territory.id)
                .where(
                    Territory.is_active == True,
                    Territory.territory_type == "county",
                    Territory.state == state,
                )
                .order_by(Territory.name.asc())
                .limit(1)
            )
            territory = session.execute(stmt).scalar_one_or_none()
            if territory:
                return territory

            # Try county territories with a Chapter President (may not have agents)
            stmt_cp = (
                select(Territory)
                .where(
                    Territory.is_active == True,
                    Territory.territory_type == "county",
                    Territory.state == state,
                    Territory.chapter_president_id.isnot(None),
                )
                .order_by(Territory.name.asc())
                .limit(1)
            )
            territory = session.execute(stmt_cp).scalar_one_or_none()
            if territory:
                return territory

            # Fallback: state-level territory with agents
            stmt_state = (
                select(Territory)
                .join(UserTerritory, UserTerritory.territory_id == Territory.id)
                .where(
                    Territory.is_active == True,
                    Territory.territory_type == "state",
                    Territory.state == state,
                )
                .order_by(Territory.name.asc())
                .limit(1)
            )
            return session.execute(stmt_state).scalar_one_or_none()

    @staticmethod
    def _determine_lead_type(lead_entity: Lead) -> str:
        """Map lead peril field to distribution lead_type via keyword matching."""
        peril = (lead_entity.peril or "").lower()
        for keyword, lead_type in PERIL_MAP.items():
            if keyword in peril:
                return lead_type
        return "storm"  # default
