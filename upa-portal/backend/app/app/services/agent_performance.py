#!/usr/bin/env python

"""
Agent Performance Scoring
=========================
Computes a composite performance score for each agent to enable
performance-weighted lead rotation.

Formula (matching frontend LeadRotationEngineService):
  composite = W1 * closingRate + W2 * responseSpeed + W3 * satisfaction

Data sources:
  - Closing rate: signed_client outcomes / total leads distributed
  - Response speed: inverted avg hours from assignment to first contact (lower = better)
  - Satisfaction: placeholder (default 70) until real data source available
"""

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.core.enums import LeadOutcomeStatus
from app.models.lead_distribution import LeadDistributionHistory
from app.models.lead_outcome import LeadOutcome
from app.models.rotation_lead import RotationLead

logger = logging.getLogger(__name__)

# Cap response hours at 48h for score normalization (same as frontend)
MAX_RESPONSE_HOURS = 48.0

# Default satisfaction score (placeholder until real data source)
DEFAULT_SATISFACTION = 70.0


@dataclass
class AgentScore:
    agent_id: UUID
    closing_rate: float        # 0-100
    avg_response_hours: float  # actual hours, None → 0
    response_speed_score: float  # 0-100 (inverted, higher = faster)
    satisfaction_score: float    # 0-100
    composite_score: float       # weighted composite 0-100


def compute_agent_scores(
    session: Session,
    agent_ids: list[UUID],
    *,
    weight_closing_rate: float = 0.4,
    weight_response_speed: float = 0.3,
    weight_satisfaction: float = 0.3,
) -> dict[UUID, AgentScore]:
    """
    Compute performance scores for the given agents.

    Returns a dict mapping agent_id → AgentScore.
    Agents with no data get a default mid-range score.
    """
    if not agent_ids:
        return {}

    # ── 1. Closing rate: signed outcomes / total leads distributed ──
    closing_rates = _compute_closing_rates(session, agent_ids)

    # ── 2. Avg response hours: assignment_date → last_contact_attempt ──
    response_hours = _compute_avg_response_hours(session, agent_ids)

    # ── 3. Build scores ──
    scores: dict[UUID, AgentScore] = {}
    for agent_id in agent_ids:
        cr = closing_rates.get(agent_id, 0.0)
        avg_hrs = response_hours.get(agent_id)

        # Response speed: 100 = instant, 0 = MAX_RESPONSE_HOURS or worse
        if avg_hrs is not None:
            response_speed = max(0.0, 100.0 - (avg_hrs / MAX_RESPONSE_HOURS) * 100.0)
        else:
            response_speed = 50.0  # mid-range default when no data

        satisfaction = DEFAULT_SATISFACTION

        composite = (
            cr * weight_closing_rate
            + response_speed * weight_response_speed
            + satisfaction * weight_satisfaction
        )

        scores[agent_id] = AgentScore(
            agent_id=agent_id,
            closing_rate=round(cr, 1),
            avg_response_hours=round(avg_hrs, 1) if avg_hrs is not None else 0.0,
            response_speed_score=round(response_speed, 1),
            satisfaction_score=satisfaction,
            composite_score=round(composite, 1),
        )

    return scores


def _compute_closing_rates(
    session: Session,
    agent_ids: list[UUID],
) -> dict[UUID, float]:
    """Compute closing rate (%) per agent from distribution history + outcomes."""
    # Total leads distributed to each agent
    total_stmt = (
        select(
            LeadDistributionHistory.assigned_agent_id,
            func.count(LeadDistributionHistory.id).label("total"),
        )
        .where(LeadDistributionHistory.assigned_agent_id.in_(agent_ids))
        .group_by(LeadDistributionHistory.assigned_agent_id)
    )
    total_rows = session.execute(total_stmt).all()
    totals: dict[UUID, int] = {row[0]: row[1] for row in total_rows}

    # Signed client outcomes per agent
    signed_stmt = (
        select(
            LeadOutcome.recorded_by_id,
            func.count(LeadOutcome.id).label("signed"),
        )
        .where(
            and_(
                LeadOutcome.recorded_by_id.in_(agent_ids),
                LeadOutcome.outcome_status == LeadOutcomeStatus.SIGNED_CLIENT.value,
                LeadOutcome.is_removed == False,
            )
        )
        .group_by(LeadOutcome.recorded_by_id)
    )
    signed_rows = session.execute(signed_stmt).all()
    signed: dict[UUID, int] = {row[0]: row[1] for row in signed_rows}

    rates: dict[UUID, float] = {}
    for agent_id in agent_ids:
        t = totals.get(agent_id, 0)
        s = signed.get(agent_id, 0)
        rates[agent_id] = (s / t * 100.0) if t > 0 else 0.0

    return rates


def _compute_avg_response_hours(
    session: Session,
    agent_ids: list[UUID],
) -> dict[UUID, float | None]:
    """Compute average response hours per agent from RotationLead data.

    Response time = last_contact_attempt - assignment_date.
    Only includes leads where both timestamps exist.
    """
    stmt = (
        select(
            RotationLead.assigned_agent_id,
            func.avg(
                func.extract(
                    "epoch",
                    RotationLead.last_contact_attempt - RotationLead.assignment_date,
                )
                / 3600.0
            ).label("avg_hours"),
        )
        .where(
            and_(
                RotationLead.assigned_agent_id.in_(agent_ids),
                RotationLead.assignment_date.isnot(None),
                RotationLead.last_contact_attempt.isnot(None),
                RotationLead.is_removed.is_(False),
            )
        )
        .group_by(RotationLead.assigned_agent_id)
    )
    rows = session.execute(stmt).all()

    result: dict[UUID, float | None] = {}
    for row in rows:
        avg_val = row[1]
        if avg_val is not None:
            result[row[0]] = max(0.0, float(avg_val))

    return result
