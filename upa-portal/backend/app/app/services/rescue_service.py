#!/usr/bin/env python

"""
Intelligent Lead Rescue Service
================================
Upgrades simple reassignment into a score-tier-aware rescue system.

RESCUE TRIGGERS:
  1. Escalation reaches level >= 4 (Chapter President)
  2. 60 minutes of inactivity on an assigned lead

ROUTING LOGIC (by score_tier):
  HIGH   → top performing agent in territory; fallback to senior/priority pool
  STRONG → next best available agent (round-robin within eligible pool)
  MEDIUM → standard pool
  LOW    → nurture / follow-up queue (lowest-priority assignment)

PERFORMANCE CRITERIA:
  - conversion rate (closing_rate)
  - response speed (response_speed_score)
  - recent activity (composite_score)

RESCUE BONUS FLAGS:
  If rescued lead converts → set rvp_rescue / cp_rescue = True
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models.escalation_attempt import EscalationAttempt
from app.models.lead import Lead
from app.models.lead_contact_tracker import LeadContactTracker
from app.models.lead_distribution import LeadDistributionHistory
from app.models.lead_rescue_log import LeadRescueLog
from app.models.territory import Territory, UserTerritory
from app.models.user import User
from app.services.agent_performance import compute_agent_scores

logger = logging.getLogger(__name__)

# Minutes of inactivity before rescue triggers
INACTIVITY_THRESHOLD_MINUTES = 60

# Score tier constants
TIER_HIGH = "high"
TIER_STRONG = "strong"
TIER_MEDIUM = "medium"
TIER_LOW = "low"

# Rescue reason constants
REASON_ESCALATION_CP = "escalation_cp"
REASON_ESCALATION_RVP = "escalation_rvp"
REASON_INACTIVITY = "inactivity_timeout"


class RescueService:
    """Orchestrates intelligent lead rescue: detection, routing, and logging."""

    def __init__(self, db_session: Session):
        self.db = db_session

    # ── Public API ────────────────────────────────────────────────────────

    def check_and_rescue_lead(self, lead_id: UUID) -> LeadRescueLog | None:
        """Evaluate a single lead for rescue eligibility and execute if needed.

        Returns a LeadRescueLog if rescue was triggered, None otherwise.
        """
        with self.db as session:
            lead = session.get(Lead, lead_id)
            if not lead:
                return None

            tracker = self._get_tracker(session, lead_id)
            rescue_reason = self._evaluate_trigger(session, lead, tracker)

            if not rescue_reason:
                return None

            return self._execute_rescue(session, lead, tracker, rescue_reason)

    def rescue_from_escalation(
        self,
        lead_id: UUID,
        tracker_id: UUID,
    ) -> LeadRescueLog | None:
        """Rescue triggered explicitly when escalation hits CP level (4+).

        Called by the escalation service when advance_escalation reaches
        chapter_president or higher.
        """
        with self.db as session:
            lead = session.get(Lead, lead_id)
            tracker = session.get(LeadContactTracker, tracker_id)

            if not lead or not tracker:
                return None

            level = tracker.current_escalation_level
            if level >= 5:
                reason = REASON_ESCALATION_RVP
            elif level >= 4:
                reason = REASON_ESCALATION_CP
            else:
                return None

            return self._execute_rescue(session, lead, tracker, reason)

    def scan_inactive_leads(self) -> list[LeadRescueLog]:
        """Bulk scan: find all assigned leads with no meaningful action
        for INACTIVITY_THRESHOLD_MINUTES and trigger rescue for each.

        Returns list of rescue logs created.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=INACTIVITY_THRESHOLD_MINUTES)

        with self.db as session:
            # Leads assigned but with no recent activity
            stmt = (
                select(Lead)
                .where(
                    and_(
                        Lead.assigned_to.isnot(None),
                        Lead.is_removed.is_(False),
                        Lead.is_rescued.is_(False),
                        Lead.status.in_(["callback", "interested", "awaiting-call", "text-sent"]),
                        Lead.updated_at < cutoff,
                    )
                )
            )
            stale_leads = list(session.execute(stmt).scalars().all())

        rescues: list[LeadRescueLog] = []
        for lead in stale_leads:
            try:
                log = self._execute_rescue_by_id(lead.id, REASON_INACTIVITY)
                if log:
                    rescues.append(log)
            except Exception:
                logger.error("Failed to rescue lead %s", lead.id, exc_info=True)

        logger.info(
            "Inactivity scan: %d/%d leads rescued", len(rescues), len(stale_leads),
        )
        return rescues

    def mark_rescue_converted(
        self,
        lead_id: UUID,
    ) -> LeadRescueLog | None:
        """Mark the most recent rescue log for a lead as converted.
        Sets rvp_rescue / cp_rescue bonus flags based on rescue_level.
        """
        with self.db as session:
            stmt = (
                select(LeadRescueLog)
                .where(LeadRescueLog.lead_id == lead_id)
                .order_by(LeadRescueLog.created_at.desc())
            )
            log = session.scalars(stmt).first()
            if not log:
                return None

            log.is_converted = True
            if log.rescue_level == "rvp":
                log.rvp_rescue = True
            elif log.rescue_level == "cp":
                log.cp_rescue = True

            session.commit()
            session.refresh(log)
            logger.info(
                "Rescue log %s marked converted (rvp=%s, cp=%s)",
                log.id, log.rvp_rescue, log.cp_rescue,
            )
            return log

    def get_rescue_logs(
        self,
        session: Session,
        lead_id: UUID | None = None,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[LeadRescueLog]:
        """Retrieve rescue logs, optionally filtered by lead."""
        stmt = select(LeadRescueLog).order_by(LeadRescueLog.created_at.desc())
        if lead_id:
            stmt = stmt.where(LeadRescueLog.lead_id == lead_id)
        stmt = stmt.offset(offset).limit(limit)
        return list(session.execute(stmt).scalars().all())

    # ── Private: Trigger Evaluation ───────────────────────────────────────

    def _evaluate_trigger(
        self,
        session: Session,
        lead: Lead,
        tracker: LeadContactTracker | None,
    ) -> str | None:
        """Determine if a lead qualifies for rescue and return reason."""
        # 1. Check escalation level
        if tracker and not tracker.is_resolved:
            level = tracker.current_escalation_level
            if level >= 5:
                return REASON_ESCALATION_RVP
            if level >= 4:
                return REASON_ESCALATION_CP

        # 2. Check inactivity
        if lead.assigned_to and lead.updated_at:
            cutoff = datetime.now(timezone.utc) - timedelta(
                minutes=INACTIVITY_THRESHOLD_MINUTES
            )
            if lead.updated_at < cutoff and not lead.is_rescued:
                return REASON_INACTIVITY

        return None

    # ── Private: Rescue Execution ─────────────────────────────────────────

    def _execute_rescue_by_id(
        self, lead_id: UUID, reason: str,
    ) -> LeadRescueLog | None:
        """Convenience wrapper for bulk operations."""
        with self.db as session:
            lead = session.get(Lead, lead_id)
            if not lead:
                return None
            tracker = self._get_tracker(session, lead_id)
            return self._execute_rescue(session, lead, tracker, reason)

    def _execute_rescue(
        self,
        session: Session,
        lead: Lead,
        tracker: LeadContactTracker | None,
        reason: str,
    ) -> LeadRescueLog | None:
        """Core rescue logic: route to best agent based on score_tier."""
        score_tier = lead.score_tier or TIER_MEDIUM
        original_agent_id = lead.assigned_to
        territory_id = tracker.territory_id if tracker else None

        # Determine rescue level label
        rescue_level = None
        if reason == REASON_ESCALATION_RVP:
            rescue_level = "rvp"
        elif reason == REASON_ESCALATION_CP:
            rescue_level = "cp"

        # Route to best available agent
        new_agent = self._route_by_tier(
            session, score_tier, territory_id, exclude_agent_id=original_agent_id,
        )

        if not new_agent:
            logger.warning(
                "Rescue for lead %s: no eligible agent found (tier=%s)",
                lead.id, score_tier,
            )
            return None

        # Reassign the lead
        lead.assigned_to = new_agent.id
        lead.is_rescued = True

        # Create rescue log
        rescue_log = LeadRescueLog(
            lead_id=lead.id,
            tracker_id=tracker.id if tracker else None,
            original_agent_id=original_agent_id,
            new_assigned_agent_id=new_agent.id,
            rescue_reason=reason,
            score_tier=score_tier,
            rescue_level=rescue_level,
            escalation_level_at_rescue=(
                tracker.current_escalation_level if tracker else None
            ),
        )
        session.add(rescue_log)
        session.commit()
        session.refresh(rescue_log)

        logger.info(
            "Lead %s rescued: %s → %s (tier=%s, reason=%s)",
            lead.id, original_agent_id, new_agent.id, score_tier, reason,
        )

        # Send notification to new agent
        self._notify_rescue_agent(session, lead, new_agent, rescue_level)

        return rescue_log

    # ── Private: Tier-Based Routing ───────────────────────────────────────

    def _route_by_tier(
        self,
        session: Session,
        score_tier: str,
        territory_id: UUID | None,
        *,
        exclude_agent_id: UUID | None = None,
    ) -> User | None:
        """Select the best agent based on the lead's score tier.

        HIGH   → top performer in territory; fallback to senior pool
        STRONG → next best available via round-robin in eligible pool
        MEDIUM → standard pool agent
        LOW    → any available agent (nurture queue)
        """
        if score_tier == TIER_HIGH:
            return self._route_high_tier(session, territory_id, exclude_agent_id)
        elif score_tier == TIER_STRONG:
            return self._route_strong_tier(session, territory_id, exclude_agent_id)
        elif score_tier == TIER_MEDIUM:
            return self._route_medium_tier(session, territory_id, exclude_agent_id)
        else:  # LOW
            return self._route_low_tier(session, territory_id, exclude_agent_id)

    def _route_high_tier(
        self,
        session: Session,
        territory_id: UUID | None,
        exclude_agent_id: UUID | None,
    ) -> User | None:
        """HIGH tier: top performing agent in territory, fallback to senior pool."""
        # Try territory agents first, ranked by performance
        if territory_id:
            agents = self._get_territory_agents(session, territory_id, exclude_agent_id)
            if agents:
                ranked = self._rank_by_performance(session, agents)
                if ranked:
                    return ranked[0]

        # Fallback: senior / priority closer pool (admin/super-admin with national_access)
        return self._get_senior_pool_agent(session, exclude_agent_id)

    def _route_strong_tier(
        self,
        session: Session,
        territory_id: UUID | None,
        exclude_agent_id: UUID | None,
    ) -> User | None:
        """STRONG tier: next best available agent in territory pool."""
        if territory_id:
            agents = self._get_territory_agents(session, territory_id, exclude_agent_id)
            if agents:
                ranked = self._rank_by_performance(session, agents)
                if ranked:
                    # Skip the #1 performer (reserved for HIGH), take #2+
                    return ranked[1] if len(ranked) > 1 else ranked[0]

        # Fallback to any available
        return self._get_any_available_agent(session, exclude_agent_id)

    def _route_medium_tier(
        self,
        session: Session,
        territory_id: UUID | None,
        exclude_agent_id: UUID | None,
    ) -> User | None:
        """MEDIUM tier: standard pool agent."""
        if territory_id:
            agents = self._get_territory_agents(session, territory_id, exclude_agent_id)
            if agents:
                return agents[0]

        return self._get_any_available_agent(session, exclude_agent_id)

    def _route_low_tier(
        self,
        session: Session,
        territory_id: UUID | None,
        exclude_agent_id: UUID | None,
    ) -> User | None:
        """LOW tier: nurture/follow-up queue — any available agent."""
        return self._get_any_available_agent(session, exclude_agent_id)

    # ── Private: Agent Pools ──────────────────────────────────────────────

    def _get_territory_agents(
        self,
        session: Session,
        territory_id: UUID,
        exclude_agent_id: UUID | None,
    ) -> list[User]:
        """Get active, accepting agents in a territory."""
        stmt = (
            select(User)
            .join(UserTerritory, UserTerritory.user_id == User.id)
            .where(
                UserTerritory.territory_id == territory_id,
                User.is_active.is_(True),
                User.is_accepting_leads.is_(True),
            )
            .order_by(UserTerritory.created_at.asc(), User.id)
        )
        agents = list(session.execute(stmt).scalars().all())
        if exclude_agent_id:
            agents = [a for a in agents if a.id != exclude_agent_id]
        return agents

    def _get_senior_pool_agent(
        self,
        session: Session,
        exclude_agent_id: UUID | None,
    ) -> User | None:
        """Get the top-performing national/admin agent for high-value rescues."""
        from app.models.role import Role

        stmt = (
            select(User)
            .join(Role, Role.id == User.role_id)
            .where(
                User.national_access.is_(True),
                User.is_active.is_(True),
                User.is_accepting_leads.is_(True),
                Role.name.in_(["admin", "super-admin"]),
            )
            .order_by(User.created_at.asc())
        )
        agents = list(session.execute(stmt).scalars().all())
        if exclude_agent_id:
            agents = [a for a in agents if a.id != exclude_agent_id]

        if not agents:
            return None

        # Rank by performance and return best
        ranked = self._rank_by_performance(session, agents)
        return ranked[0] if ranked else agents[0]

    def _get_any_available_agent(
        self,
        session: Session,
        exclude_agent_id: UUID | None,
    ) -> User | None:
        """Fallback: any active agent accepting leads."""
        stmt = (
            select(User)
            .where(
                User.is_active.is_(True),
                User.is_accepting_leads.is_(True),
            )
            .order_by(User.created_at.asc())
            .limit(10)
        )
        agents = list(session.execute(stmt).scalars().all())
        if exclude_agent_id:
            agents = [a for a in agents if a.id != exclude_agent_id]
        return agents[0] if agents else None

    def _rank_by_performance(
        self,
        session: Session,
        agents: list[User],
    ) -> list[User]:
        """Rank agents by composite performance score (descending)."""
        if len(agents) <= 1:
            return agents

        agent_ids = [a.id for a in agents]
        scores = compute_agent_scores(session, agent_ids)

        return sorted(
            agents,
            key=lambda a: scores[a.id].composite_score if a.id in scores else 0.0,
            reverse=True,
        )

    # ── Private: Helpers ──────────────────────────────────────────────────

    def _get_tracker(
        self, session: Session, lead_id: UUID,
    ) -> LeadContactTracker | None:
        """Get the contact tracker for a lead (if any)."""
        stmt = select(LeadContactTracker).where(
            LeadContactTracker.lead_id == lead_id
        )
        return session.scalars(stmt).first()

    def _notify_rescue_agent(
        self,
        session: Session,
        lead: Lead,
        agent: User,
        rescue_level: str | None,
    ) -> None:
        """Send in-app notification about the rescue assignment."""
        try:
            from app.utils.notifications import create_notification

            level_label = (rescue_level or "system").upper()
            create_notification(
                session,
                user_id=agent.id,
                title=f"Rescued Lead Assigned — {level_label}",
                message=(
                    f"A {lead.score_tier or 'unscored'}-tier lead has been rescued "
                    f"and assigned to you. Ref #{lead.ref_number}."
                ),
                link=f"/#/app/leads/{lead.id}",
                notification_type="lead_rescue",
            )
        except Exception:
            logger.warning(
                "Failed to send rescue notification for lead %s", lead.id,
                exc_info=True,
            )
