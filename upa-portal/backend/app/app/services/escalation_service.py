#!/usr/bin/env python

"""
Escalation Service
==================
Core orchestration for the lead contact escalation chain.

Escalation levels:
  1 = agent_1  (initial rotation winner)
  2 = agent_2  (next in rotation)
  3 = agent_3  (next after agent_2)
  4 = chapter_president  (territory.chapter_president_id)
  5 = home_office  (national_access admins)
  6 = state_pool  (all agents in same-state territories)
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.escalation_attempt import EscalationAttempt
from app.models.lead_contact_tracker import LeadContactTracker
from app.models.territory import Territory, UserTerritory
from app.models.user import User
from app.services.lead_distribution_service import _get_eligible_agents

logger = logging.getLogger(__name__)

ESCALATION_LABELS = {
    1: "agent_1",
    2: "agent_2",
    3: "agent_3",
    4: "chapter_president",
    5: "home_office",
    6: "state_pool",
}


class EscalationService:
    def __init__(self, db_session: Session):
        self.db = db_session

    def create_tracker(
        self,
        *,
        lead_id: UUID,
        territory_id: UUID,
        lead_type: str,
        initial_agent_id: UUID,
    ) -> LeadContactTracker:
        """Create a new LeadContactTracker and the first EscalationAttempt."""
        with self.db as session:
            now = datetime.now(timezone.utc)
            timeout = now + timedelta(seconds=settings.ESCALATION_TIMEOUT_SECONDS)

            tracker = LeadContactTracker(
                lead_id=lead_id,
                territory_id=territory_id,
                lead_type=lead_type,
                ai_call_status="pending",
                current_escalation_level=1,
                current_agent_id=initial_agent_id,
                escalation_started_at=now,
                contact_status="new",
                is_resolved=False,
            )
            session.add(tracker)
            session.flush()

            attempt = EscalationAttempt(
                tracker_id=tracker.id,
                lead_id=lead_id,
                agent_id=initial_agent_id,
                escalation_level=1,
                escalation_label="agent_1",
                transfer_status="pending",
                timeout_at=timeout,
            )
            session.add(attempt)
            session.commit()
            session.refresh(tracker)

            logger.info(
                "Created escalation tracker %s for lead %s (agent_1=%s)",
                tracker.id, lead_id, initial_agent_id,
            )
            return tracker

    def advance_escalation(self, tracker_id: UUID) -> bool:
        """
        Advance to the next escalation level.

        Returns True if a new agent was found and attempt created.
        Returns False if all levels are exhausted.
        """
        with self.db as session:
            tracker = session.get(LeadContactTracker, tracker_id)
            if not tracker or tracker.is_resolved:
                return False

            tried_ids = self._get_tried_agent_ids(session, tracker_id)
            current_level = tracker.current_escalation_level
            max_level = settings.ESCALATION_MAX_LEVELS

            # Try each subsequent level until we find an agent or exhaust all
            for next_level in range(current_level + 1, max_level + 1):
                agent = self._resolve_agent_for_level(
                    session, tracker, next_level, tried_ids,
                )
                if agent is None:
                    logger.info(
                        "Tracker %s: no agent at level %d (%s), skipping",
                        tracker_id, next_level, ESCALATION_LABELS.get(next_level),
                    )
                    continue

                now = datetime.now(timezone.utc)
                timeout = now + timedelta(seconds=settings.ESCALATION_TIMEOUT_SECONDS)

                tracker.current_escalation_level = next_level
                tracker.current_agent_id = agent.id
                tracker.escalation_started_at = now
                tracker.contact_status = "escalated"

                attempt = EscalationAttempt(
                    tracker_id=tracker_id,
                    lead_id=tracker.lead_id,
                    agent_id=agent.id,
                    escalation_level=next_level,
                    escalation_label=ESCALATION_LABELS.get(next_level, f"level_{next_level}"),
                    transfer_status="pending",
                    timeout_at=timeout,
                )
                session.add(attempt)
                session.commit()
                session.refresh(tracker)

                logger.info(
                    "Tracker %s escalated to level %d (%s) → agent %s (%s %s)",
                    tracker_id, next_level, ESCALATION_LABELS.get(next_level),
                    agent.id, agent.first_name, agent.last_name,
                )

                # Trigger intelligent rescue when reaching CP level (4+)
                if next_level >= 4:
                    self._trigger_rescue(tracker.lead_id, tracker_id)

                return True

            # All levels exhausted
            logger.info("Tracker %s: all escalation levels exhausted", tracker_id)
            return False

    def mark_resolved(
        self, tracker_id: UUID, resolution_type: str
    ) -> None:
        """Mark the tracker as resolved."""
        with self.db as session:
            tracker = session.get(LeadContactTracker, tracker_id)
            if not tracker:
                return
            tracker.is_resolved = True
            tracker.resolved_at = datetime.now(timezone.utc)
            tracker.resolution_type = resolution_type
            session.commit()
            logger.info(
                "Tracker %s resolved: %s", tracker_id, resolution_type,
            )

    @staticmethod
    def is_quiet_hours() -> bool:
        """Check if we're in quiet hours."""
        from app.services.communication_service import CommunicationService
        return CommunicationService._is_quiet_hours()

    @staticmethod
    def next_send_window() -> datetime:
        """Get next datetime when we can send."""
        from app.services.communication_service import CommunicationService
        return CommunicationService._next_send_window()

    # ── Agent resolution per level ──

    def _resolve_agent_for_level(
        self,
        session: Session,
        tracker: LeadContactTracker,
        level: int,
        tried_ids: set[UUID],
    ) -> User | None:
        """Return the agent to try at a given escalation level, or None."""
        if level == 1:
            return None  # Level 1 is set at creation time
        elif level in (2, 3):
            return self._resolve_rotation_agent(session, tracker, level, tried_ids)
        elif level == 4:
            return self._resolve_chapter_president(session, tracker, tried_ids)
        elif level == 5:
            return self._resolve_home_office(session, tried_ids)
        elif level == 6:
            return self._resolve_state_pool(session, tracker, tried_ids)
        return None

    def _resolve_rotation_agent(
        self,
        session: Session,
        tracker: LeadContactTracker,
        level: int,
        tried_ids: set[UUID],
    ) -> User | None:
        """Level 2-3: next agents in the territory rotation order."""
        territory = session.get(Territory, tracker.territory_id)
        if not territory:
            return None

        agents = _get_eligible_agents(session, territory)
        if not agents:
            return None

        # Cap at max_adjusters
        max_agents = territory.max_adjusters or 3
        agents = agents[:max_agents]

        # Find agents not yet tried
        for agent in agents:
            if agent.id not in tried_ids:
                return agent

        return None

    def _resolve_chapter_president(
        self,
        session: Session,
        tracker: LeadContactTracker,
        tried_ids: set[UUID],
    ) -> User | None:
        """Level 4: territory's chapter president."""
        territory = session.get(Territory, tracker.territory_id)
        if not territory or not territory.chapter_president_id:
            return None

        if territory.chapter_president_id in tried_ids:
            return None

        cp = session.get(User, territory.chapter_president_id)
        if cp and cp.is_active:
            return cp
        return None

    def _resolve_home_office(
        self, session: Session, tried_ids: set[UUID]
    ) -> User | None:
        """Level 5: users with national_access=True and admin/super-admin role."""
        from app.models.role import Role

        stmt = (
            select(User)
            .join(Role, Role.id == User.role_id)
            .where(
                User.national_access == True,
                User.is_active == True,
                User.is_accepting_leads == True,
                Role.name.in_(["admin", "super-admin"]),
            )
            .order_by(User.created_at.asc())
        )
        admins = list(session.execute(stmt).scalars().all())

        for admin in admins:
            if admin.id not in tried_ids:
                return admin
        return None

    def _resolve_state_pool(
        self,
        session: Session,
        tracker: LeadContactTracker,
        tried_ids: set[UUID],
    ) -> User | None:
        """Level 6: all active agents in same-state territories, excluding tried."""
        territory = session.get(Territory, tracker.territory_id)
        if not territory or not territory.state:
            return None

        # All agents in territories in the same state
        stmt = (
            select(User)
            .join(UserTerritory, UserTerritory.user_id == User.id)
            .join(Territory, Territory.id == UserTerritory.territory_id)
            .where(
                Territory.state == territory.state,
                Territory.is_active == True,
                User.is_active == True,
                User.is_accepting_leads == True,
            )
            .order_by(User.created_at.asc())
        )
        agents = list(session.execute(stmt).scalars().unique().all())

        for agent in agents:
            if agent.id not in tried_ids:
                return agent
        return None

    def _trigger_rescue(self, lead_id: UUID, tracker_id: UUID) -> None:
        """Trigger the intelligent rescue system when escalation reaches CP+."""
        try:
            from app.services.rescue_service import RescueService

            rescue_svc = RescueService(self.db)
            log = rescue_svc.rescue_from_escalation(lead_id, tracker_id)
            if log:
                logger.info(
                    "Rescue triggered for lead %s (tracker %s) → agent %s",
                    lead_id, tracker_id, log.new_assigned_agent_id,
                )
        except Exception:
            logger.error(
                "Failed to trigger rescue for lead %s", lead_id, exc_info=True,
            )

    @staticmethod
    def _get_tried_agent_ids(session: Session, tracker_id: UUID) -> set[UUID]:
        """Get all agent IDs that have already been tried for this tracker."""
        stmt = (
            select(EscalationAttempt.agent_id)
            .where(EscalationAttempt.tracker_id == tracker_id)
        )
        return set(session.execute(stmt).scalars().all())
