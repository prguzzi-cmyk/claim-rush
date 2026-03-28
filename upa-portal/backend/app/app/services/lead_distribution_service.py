#!/usr/bin/env python

"""
Lead Distribution Engine
========================
Rules:
  1. Chapter President priority — if a territory has a CP who is active and
     accepting leads, assign to them first.
  2. Rotation fallback — if no CP, rotate between available territory agents.
  3. National queue fallback — if no territory agents at all, distribute to
     agents with national_access=True.
  4. Fire leads → exactly ONE agent per lead (exclusive).
  5. Other leads (hail, storm, lightning, flood, theft_vandalism) → ALL eligible agents.
  6. Distribution is logged in lead_distribution_history with an assignment_reason.
  7. Fire rotation tracked in territory_rotation_state for even distribution.
  8. Territory must have the lead type enabled (lead_<type>_enabled flag).
"""

import logging
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.lead_distribution import LeadDistributionHistory, TerritoryRotationState
from app.models.rotation_config import RotationConfig
from app.models.territory import Territory, UserTerritory
from app.models.user import User
from app.crud.crud_lead_distribution import (
    lead_distribution_history as history_crud,
    territory_rotation_state as rotation_crud,
)
from app.services.agent_performance import compute_agent_scores

logger = logging.getLogger(__name__)

# Map lead_type string → territory flag column name
LEAD_TYPE_FLAG_MAP = {
    "fire": "lead_fire_enabled",
    "hail": "lead_hail_enabled",
    "storm": "lead_storm_enabled",
    "lightning": "lead_lightning_enabled",
    "flood": "lead_flood_enabled",
    "theft_vandalism": "lead_theft_vandalism_enabled",
    "crime": "lead_theft_vandalism_enabled",
}

# Assignment reason constants
REASON_CP_PRIORITY = "cp_priority"
REASON_ROTATION = "rotation"
REASON_NATIONAL_QUEUE = "national_queue"


def _get_leads_assigned_today(session: Session, agent_id: UUID) -> int:
    """Count leads distributed to an agent today (UTC)."""
    today_start = datetime.combine(date.today(), datetime.min.time(), tzinfo=timezone.utc)
    count = session.scalar(
        select(func.count(LeadDistributionHistory.id)).where(
            LeadDistributionHistory.assigned_agent_id == agent_id,
            LeadDistributionHistory.distributed_at >= today_start,
        )
    )
    return count or 0


def _is_agent_available(session: Session, agent: User) -> bool:
    """Check if an agent is active, accepting leads, and under their daily cap."""
    if not agent.is_active or not agent.is_accepting_leads:
        return False
    if agent.daily_lead_limit is not None:
        assigned_today = _get_leads_assigned_today(session, agent.id)
        if assigned_today >= agent.daily_lead_limit:
            logger.debug(
                "Agent %s (%s %s) skipped — daily cap reached (%d/%d)",
                agent.id, agent.first_name, agent.last_name,
                assigned_today, agent.daily_lead_limit,
            )
            return False
    return True


def _check_chapter_president(
    session: Session,
    territory: Territory,
) -> User | None:
    """
    Check if the territory has a Chapter President who is active and accepting leads.
    Returns the CP User if available, None otherwise.
    """
    if not territory.chapter_president_id:
        return None

    cp = territory.chapter_president
    if not cp:
        # Relationship not loaded — fetch directly
        cp = session.get(User, territory.chapter_president_id)

    if not cp:
        return None

    if _is_agent_available(session, cp):
        logger.info(
            "Chapter President %s (%s %s) available for territory '%s'",
            cp.id, cp.first_name, cp.last_name, territory.name,
        )
        return cp

    logger.debug(
        "Chapter President %s is not available (active=%s, accepting=%s)",
        cp.id, cp.is_active, cp.is_accepting_leads,
    )
    return None


def _get_eligible_agents(
    session: Session,
    territory: Territory,
) -> list[User]:
    """Return active agents assigned to this territory who are accepting leads
    and have not hit their daily cap, ordered for stable rotation."""
    stmt = (
        select(User)
        .join(UserTerritory, UserTerritory.user_id == User.id)
        .where(
            UserTerritory.territory_id == territory.id,
            User.is_active == True,
            User.is_accepting_leads == True,
        )
        .order_by(UserTerritory.created_at.asc(), User.id)
    )
    candidates = list(session.execute(stmt).scalars().all())

    # Filter out agents who have hit their daily lead limit
    eligible = []
    for agent in candidates:
        if _is_agent_available(session, agent):
            eligible.append(agent)

    return eligible


def _get_national_queue_agents(session: Session) -> list[User]:
    """
    Return agents with national_access=True who are active and accepting leads.
    These serve as the fallback when no territory agents are available.
    """
    stmt = (
        select(User)
        .where(
            User.national_access == True,
            User.is_active == True,
            User.is_accepting_leads == True,
        )
        .order_by(User.created_at.asc(), User.id)
    )
    candidates = list(session.execute(stmt).scalars().all())

    eligible = []
    for agent in candidates:
        if _is_agent_available(session, agent):
            eligible.append(agent)

    return eligible


def _sort_agents_by_performance(
    session: Session,
    agents: list[User],
    config: RotationConfig | None,
) -> list[User]:
    """Sort agents by composite performance score (descending) when weighting is enabled.

    When disabled or no config, returns agents in their original order.
    """
    if not config or not config.use_performance_weighting or len(agents) <= 1:
        return agents

    agent_ids = [a.id for a in agents]
    scores = compute_agent_scores(
        session,
        agent_ids,
        weight_closing_rate=config.weight_closing_rate,
        weight_response_speed=config.weight_response_speed,
        weight_satisfaction=config.weight_satisfaction,
    )

    # Sort by composite score descending; agents with no score go to the end
    return sorted(
        agents,
        key=lambda a: scores.get(a.id).composite_score if a.id in scores else 0.0,
        reverse=True,
    )


def _get_rotation_config(
    session: Session,
    territory_id: UUID,
) -> RotationConfig | None:
    """Load the rotation config for a territory (or global fallback)."""
    # Try territory-specific first
    stmt = select(RotationConfig).where(RotationConfig.territory_id == territory_id)
    config = session.scalars(stmt).first()
    if config:
        return config
    # Fallback to global
    stmt = select(RotationConfig).where(RotationConfig.territory_id.is_(None))
    return session.scalars(stmt).first()


def _check_lead_type_enabled(territory: Territory, lead_type: str) -> bool:
    """Check if the territory has this lead type enabled."""
    flag_attr = LEAD_TYPE_FLAG_MAP.get(lead_type)
    if not flag_attr:
        return False
    return getattr(territory, flag_attr, False)


def _create_history_record(
    session: Session,
    *,
    lead_id: UUID,
    territory_id: UUID,
    agent_id: UUID,
    lead_type: str,
    assignment_reason: str = REASON_ROTATION,
) -> LeadDistributionHistory:
    """Insert a distribution history row."""
    record = LeadDistributionHistory(
        lead_id=lead_id,
        territory_id=territory_id,
        assigned_agent_id=agent_id,
        lead_type=lead_type,
        assignment_reason=assignment_reason,
    )
    session.add(record)
    return record


def distribute_fire_lead(
    db_session: Session,
    *,
    lead_id: UUID,
    territory_id: UUID,
) -> dict:
    """
    Distribute a fire lead to exactly ONE agent.

    Priority order:
      1. Chapter President (if available)
      2. Round-robin rotation among territory agents
      3. National queue fallback

    Returns dict with keys: assigned_agents, history_ids, is_exclusive, assignment_reason.
    Raises ValueError on validation failures.
    """
    territory = db_session.get(Territory, territory_id)
    if not territory:
        raise ValueError("The selected territory was not found. Please refresh and try again.")
    if not territory.is_active:
        raise ValueError(f"Territory '{territory.name}' is currently inactive and cannot receive leads.")
    if not _check_lead_type_enabled(territory, "fire"):
        raise ValueError(f"Fire leads are not enabled for territory '{territory.name}'.")

    # ── Step 1: Check Chapter President ──
    cp = _check_chapter_president(db_session, territory)
    if cp:
        record = _create_history_record(
            db_session,
            lead_id=lead_id,
            territory_id=territory_id,
            agent_id=cp.id,
            lead_type="fire",
            assignment_reason=REASON_CP_PRIORITY,
        )
        db_session.commit()

        logger.info(
            "Fire lead %s assigned to Chapter President %s (%s %s) in territory %s",
            lead_id, cp.id, cp.first_name, cp.last_name, territory.name,
        )

        return {
            "assigned_agents": [
                {"agent_id": str(cp.id), "agent_name": f"{cp.first_name} {cp.last_name}"}
            ],
            "history_ids": [record.id],
            "is_exclusive": True,
            "assignment_reason": REASON_CP_PRIORITY,
        }

    # ── Step 2: Rotate among territory agents ──
    agents = _get_eligible_agents(db_session, territory)
    if agents:
        config = _get_rotation_config(db_session, territory_id)
        agents = _sort_agents_by_performance(db_session, agents, config)

        # Cap at max_adjusters (default 3 for fire)
        max_agents = territory.max_adjusters or 3
        agents = agents[:max_agents]

        # Get rotation state
        rotation = rotation_crud.get_or_create(db_session, territory_id=territory_id)
        next_index = rotation.rotation_index % len(agents)
        chosen_agent = agents[next_index]

        record = _create_history_record(
            db_session,
            lead_id=lead_id,
            territory_id=territory_id,
            agent_id=chosen_agent.id,
            lead_type="fire",
            assignment_reason=REASON_ROTATION,
        )
        db_session.commit()

        # Advance rotation
        rotation_crud.advance(
            db_session,
            territory_id=territory_id,
            agent_id=chosen_agent.id,
            new_index=next_index + 1,
        )

        logger.info(
            "Fire lead %s distributed to agent %s (%s %s) in territory %s [rotation index %d]",
            lead_id, chosen_agent.id, chosen_agent.first_name, chosen_agent.last_name,
            territory.name, next_index,
        )

        return {
            "assigned_agents": [
                {"agent_id": str(chosen_agent.id), "agent_name": f"{chosen_agent.first_name} {chosen_agent.last_name}"}
            ],
            "history_ids": [record.id],
            "is_exclusive": True,
            "assignment_reason": REASON_ROTATION,
        }

    # ── Step 3: National queue fallback ──
    national_agents = _get_national_queue_agents(db_session)
    if not national_agents:
        raise ValueError(
            f"No eligible agents in territory '{territory.name}' and no national queue agents available."
        )

    # Pick first available national agent (round-robin could be added later)
    chosen_agent = national_agents[0]
    record = _create_history_record(
        db_session,
        lead_id=lead_id,
        territory_id=territory_id,
        agent_id=chosen_agent.id,
        lead_type="fire",
        assignment_reason=REASON_NATIONAL_QUEUE,
    )
    db_session.commit()

    logger.info(
        "Fire lead %s routed to national queue agent %s (%s %s) — no territory agents available",
        lead_id, chosen_agent.id, chosen_agent.first_name, chosen_agent.last_name,
    )

    return {
        "assigned_agents": [
            {"agent_id": str(chosen_agent.id), "agent_name": f"{chosen_agent.first_name} {chosen_agent.last_name}"}
        ],
        "history_ids": [record.id],
        "is_exclusive": True,
        "assignment_reason": REASON_NATIONAL_QUEUE,
    }


def distribute_multi_agent_lead(
    db_session: Session,
    *,
    lead_id: UUID,
    territory_id: UUID,
    lead_type: str,
) -> dict:
    """
    Distribute a non-fire lead to eligible agents.

    Priority order:
      1. Chapter President (always included if available)
      2. All eligible territory agents
      3. National queue fallback (if no territory agents at all)

    Returns dict with keys: assigned_agents, history_ids, is_exclusive, assignment_reason.
    """
    with db_session as session:
        territory = session.get(Territory, territory_id)
        if not territory:
            raise ValueError("The selected territory was not found. Please refresh and try again.")
        if not territory.is_active:
            raise ValueError(f"Territory '{territory.name}' is currently inactive and cannot receive leads.")
        if not _check_lead_type_enabled(territory, lead_type):
            raise ValueError(f"{lead_type.replace('_', ' ').title()} leads are not enabled for territory '{territory.name}'.")

        agents = _get_eligible_agents(session, territory)
        assignment_reason = REASON_ROTATION

        # ── Ensure Chapter President is included first ──
        cp = _check_chapter_president(session, territory)
        if cp:
            # Add CP at the front if not already in the agents list
            cp_ids = {a.id for a in agents}
            if cp.id not in cp_ids:
                agents.insert(0, cp)
            assignment_reason = REASON_CP_PRIORITY

        # ── National queue fallback ──
        if not agents:
            agents = _get_national_queue_agents(session)
            assignment_reason = REASON_NATIONAL_QUEUE
            if not agents:
                raise ValueError(
                    f"No eligible agents in territory '{territory.name}' and no national queue agents available."
                )

        assigned = []
        history_ids = []
        for agent in agents:
            record = _create_history_record(
                session,
                lead_id=lead_id,
                territory_id=territory_id,
                agent_id=agent.id,
                lead_type=lead_type,
                assignment_reason=assignment_reason,
            )
            session.flush()
            assigned.append(
                {"agent_id": str(agent.id), "agent_name": f"{agent.first_name} {agent.last_name}"}
            )
            history_ids.append(record.id)

        session.commit()

        logger.info(
            "%s lead %s distributed to %d agents in territory %s (reason: %s)",
            lead_type, lead_id, len(assigned), territory.name, assignment_reason,
        )

        return {
            "assigned_agents": assigned,
            "history_ids": history_ids,
            "is_exclusive": False,
            "assignment_reason": assignment_reason,
        }


def distribute_lead(
    db_session: Session,
    *,
    lead_id: UUID,
    territory_id: UUID,
    lead_type: str,
) -> dict:
    """
    Main entry point — routes to fire (exclusive) or multi-agent distribution.

    Distribution priority:
      1. Chapter President → assign first if available
      2. Territory agents → rotate (fire) or broadcast (other)
      3. National queue → fallback when no territory agents
    """
    if lead_type not in LEAD_TYPE_FLAG_MAP:
        raise ValueError(f"Invalid lead_type '{lead_type}'. Must be one of: {', '.join(LEAD_TYPE_FLAG_MAP.keys())}")

    if lead_type == "fire":
        return distribute_fire_lead(db_session, lead_id=lead_id, territory_id=territory_id)
    else:
        return distribute_multi_agent_lead(
            db_session, lead_id=lead_id, territory_id=territory_id, lead_type=lead_type,
        )
