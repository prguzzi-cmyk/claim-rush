#!/usr/bin/env python

"""CRUD operations for the lead outcome model"""

from uuid import UUID

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.enums import LeadOutcomeStatus
from app.crud.base import CRUDBase
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.lead_outcome import LeadOutcome
from app.models.user import User
from app.schemas.lead_outcome import LeadOutcomeCreateDB, LeadOutcomeUpdate


class CRUDLeadOutcome(CRUDBase[LeadOutcome, LeadOutcomeCreateDB, LeadOutcomeUpdate]):
    @staticmethod
    def get_outcomes_for_lead(db_session: Session, *, lead_id: UUID) -> list[LeadOutcome]:
        with db_session as session:
            stmt = (
                select(LeadOutcome)
                .where(
                    LeadOutcome.lead_id == lead_id,
                    LeadOutcome.is_removed == False,
                )
                .order_by(LeadOutcome.created_at.desc())
            )
            return list(session.scalars(stmt).all())

    @staticmethod
    def group_by_outcome_status(
        db_session: Session, *, filters: list, join_contact: bool = False
    ) -> list[dict]:
        with db_session as session:
            stmt = (
                select(
                    LeadOutcome.outcome_status,
                    LeadOutcome.category,
                    func.count(LeadOutcome.id).label("count"),
                )
                .where(LeadOutcome.is_removed == False)
            )

            if join_contact:
                stmt = (
                    stmt
                    .join(Lead, Lead.id == LeadOutcome.lead_id)
                    .join(LeadContact, LeadContact.lead_id == Lead.id)
                )

            stmt = (
                stmt
                .filter(*filters)
                .group_by(LeadOutcome.outcome_status, LeadOutcome.category)
                .order_by(func.count(LeadOutcome.id).desc())
            )
            rows = session.execute(stmt).all()
            return [
                {
                    "outcome_status": row.outcome_status,
                    "category": row.category,
                    "count": row.count,
                }
                for row in rows
            ]

    @staticmethod
    def get_agent_performance(
        db_session: Session, *, filters: list, join_contact: bool = False
    ) -> list[dict]:
        with db_session as session:
            # Count total leads per agent
            lead_count_q = (
                select(
                    Lead.assigned_to.label("agent_id"),
                    func.count(Lead.id).label("total_leads"),
                )
                .where(Lead.is_removed == False)
            )

            if join_contact:
                lead_count_q = lead_count_q.join(
                    LeadContact, LeadContact.lead_id == Lead.id
                )

            lead_count_sub = (
                lead_count_q
                .filter(*filters)
                .group_by(Lead.assigned_to)
                .subquery()
            )

            # Count outcomes per agent using recorded_by_id
            outcome_sub = (
                select(
                    LeadOutcome.recorded_by_id.label("agent_id"),
                    func.count(LeadOutcome.id).label("total_outcomes"),
                    func.sum(
                        case(
                            (
                                LeadOutcome.category == "contact-attempts",
                                1,
                            ),
                            else_=0,
                        )
                    ).label("contact_attempts"),
                    func.sum(
                        case(
                            (
                                LeadOutcome.outcome_status
                                == LeadOutcomeStatus.APPOINTMENT_SCHEDULED.value,
                                1,
                            ),
                            else_=0,
                        )
                    ).label("appointments_scheduled"),
                    func.sum(
                        case(
                            (
                                LeadOutcome.outcome_status
                                == LeadOutcomeStatus.SIGNED_CLIENT.value,
                                1,
                            ),
                            else_=0,
                        )
                    ).label("signed_clients"),
                    # New metrics
                    func.sum(
                        case(
                            (
                                or_(
                                    LeadOutcome.outcome_status
                                    == LeadOutcomeStatus.NO_ANSWER_LEFT_MESSAGE.value,
                                    LeadOutcome.outcome_status
                                    == LeadOutcomeStatus.NO_ANSWER_NO_MESSAGE.value,
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ).label("no_answer"),
                    func.sum(
                        case(
                            (
                                LeadOutcome.outcome_status
                                == LeadOutcomeStatus.NO_ANSWER_LEFT_MESSAGE.value,
                                1,
                            ),
                            else_=0,
                        )
                    ).label("left_message"),
                    func.sum(
                        case(
                            (
                                or_(
                                    LeadOutcome.outcome_status
                                    == LeadOutcomeStatus.CALL_BACK_LATER_TODAY.value,
                                    LeadOutcome.outcome_status
                                    == LeadOutcomeStatus.CALL_BACK_TOMORROW.value,
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ).label("callbacks_pending"),
                    func.sum(
                        case(
                            (
                                LeadOutcome.outcome_status
                                == LeadOutcomeStatus.WANTS_MORE_INFO.value,
                                1,
                            ),
                            else_=0,
                        )
                    ).label("wants_info"),
                )
                .where(LeadOutcome.is_removed == False)
                .group_by(LeadOutcome.recorded_by_id)
                .subquery()
            )

            stmt = (
                select(
                    lead_count_sub.c.agent_id,
                    func.concat(User.first_name, " ", User.last_name).label("agent_name"),
                    lead_count_sub.c.total_leads.label("total_leads_received"),
                    func.coalesce(outcome_sub.c.contact_attempts, 0).label("contact_attempts"),
                    func.coalesce(outcome_sub.c.appointments_scheduled, 0).label(
                        "appointments_scheduled"
                    ),
                    func.coalesce(outcome_sub.c.signed_clients, 0).label("signed_clients"),
                    func.coalesce(outcome_sub.c.no_answer, 0).label("no_answer"),
                    func.coalesce(outcome_sub.c.left_message, 0).label("left_message"),
                    func.coalesce(outcome_sub.c.callbacks_pending, 0).label("callbacks_pending"),
                    func.coalesce(outcome_sub.c.wants_info, 0).label("wants_info"),
                )
                .join(User, User.id == lead_count_sub.c.agent_id)
                .outerjoin(outcome_sub, outcome_sub.c.agent_id == lead_count_sub.c.agent_id)
                .where(lead_count_sub.c.agent_id.isnot(None))
                .order_by(lead_count_sub.c.total_leads.desc())
            )

            rows = session.execute(stmt).all()
            results = []
            for row in rows:
                total = row.total_leads_received or 0
                signed = row.signed_clients or 0
                closing_rate = round((signed / total) * 100, 1) if total > 0 else 0.0
                results.append(
                    {
                        "agent_id": row.agent_id,
                        "agent_name": row.agent_name,
                        "total_leads_received": total,
                        "contact_attempts": row.contact_attempts or 0,
                        "appointments_scheduled": row.appointments_scheduled or 0,
                        "signed_clients": signed,
                        "closing_rate": closing_rate,
                        "no_answer": row.no_answer or 0,
                        "left_message": row.left_message or 0,
                        "callbacks_pending": row.callbacks_pending or 0,
                        "wants_info": row.wants_info or 0,
                    }
                )
            return results


    @staticmethod
    def get_agent_outcome_percentages(
        db_session: Session, *, filters: list, join_contact: bool = False
    ) -> list[dict]:
        """Return per-agent outcome percentage breakdown for performance tracking."""
        with db_session as session:
            # Total outcomes per agent
            total_q = (
                select(
                    LeadOutcome.recorded_by_id.label("agent_id"),
                    func.count(LeadOutcome.id).label("total"),
                )
                .where(LeadOutcome.is_removed == False)
            )

            if join_contact:
                total_q = (
                    total_q
                    .join(Lead, Lead.id == LeadOutcome.lead_id)
                    .join(LeadContact, LeadContact.lead_id == Lead.id)
                )

            total_sub = (
                total_q
                .filter(*filters)
                .group_by(LeadOutcome.recorded_by_id)
                .subquery()
            )

            # Per-status counts per agent
            detail_q = (
                select(
                    LeadOutcome.recorded_by_id.label("agent_id"),
                    LeadOutcome.outcome_status,
                    func.count(LeadOutcome.id).label("cnt"),
                )
                .where(LeadOutcome.is_removed == False)
            )

            if join_contact:
                detail_q = (
                    detail_q
                    .join(Lead, Lead.id == LeadOutcome.lead_id)
                    .join(LeadContact, LeadContact.lead_id == Lead.id)
                )

            detail_sub = (
                detail_q
                .filter(*filters)
                .group_by(LeadOutcome.recorded_by_id, LeadOutcome.outcome_status)
                .subquery()
            )

            stmt = (
                select(
                    detail_sub.c.agent_id,
                    func.concat(User.first_name, " ", User.last_name).label("agent_name"),
                    detail_sub.c.outcome_status,
                    detail_sub.c.cnt,
                    total_sub.c.total,
                )
                .join(User, User.id == detail_sub.c.agent_id)
                .join(total_sub, total_sub.c.agent_id == detail_sub.c.agent_id)
                .order_by(
                    func.concat(User.first_name, " ", User.last_name),
                    detail_sub.c.cnt.desc(),
                )
            )

            rows = session.execute(stmt).all()

            # Group by agent
            agents: dict[str, dict] = {}
            for row in rows:
                aid = str(row.agent_id)
                if aid not in agents:
                    agents[aid] = {
                        "agent_id": row.agent_id,
                        "agent_name": row.agent_name,
                        "total_outcomes": row.total,
                        "breakdown": [],
                    }
                pct = round((row.cnt / row.total) * 100, 1) if row.total else 0.0
                agents[aid]["breakdown"].append(
                    {
                        "outcome_status": row.outcome_status,
                        "count": row.cnt,
                        "percentage": pct,
                    }
                )

            return list(agents.values())


lead_outcome = CRUDLeadOutcome(LeadOutcome)
