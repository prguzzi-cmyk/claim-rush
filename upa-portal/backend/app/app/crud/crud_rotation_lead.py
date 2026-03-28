#!/usr/bin/env python

from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.crud.base import CRUDBase
from app.models.rotation_lead import RotationLead
from app.models.rotation_lead_activity import RotationLeadActivity
from app.schemas.rotation_lead import RotationLeadCreate, RotationLeadUpdate


class CRUDRotationLead(CRUDBase[RotationLead, RotationLeadCreate, RotationLeadUpdate]):

    def get_with_activities(
        self, db_session: Session, *, obj_id
    ) -> RotationLead | None:
        """Retrieve a rotation lead with activities and their performers eagerly loaded."""
        with db_session as session:
            stmt = (
                select(RotationLead)
                .options(
                    selectinload(RotationLead.activities)
                    .joinedload(RotationLeadActivity.performed_by)
                )
                .where(
                    and_(
                        RotationLead.id == obj_id,
                        RotationLead.is_removed.is_(False),
                    )
                )
            )
            return session.scalar(stmt)

    def get_by_status(
        self, db_session: Session, *, status: str
    ) -> Sequence[RotationLead]:
        """Return all rotation leads with a given status."""
        with db_session as session:
            stmt = (
                select(RotationLead)
                .where(
                    and_(
                        RotationLead.lead_status == status,
                        RotationLead.is_removed.is_(False),
                    )
                )
                .order_by(RotationLead.created_at.desc())
            )
            return session.scalars(stmt).all()

    def get_assigned_leads_past_timeout(
        self, db_session: Session, *, timeout_hours: int
    ) -> Sequence[RotationLead]:
        """Find assigned leads that have not been contacted within the timeout window."""
        cutoff = datetime.now(timezone.utc)
        with db_session as session:
            stmt = (
                select(RotationLead)
                .where(
                    and_(
                        RotationLead.lead_status == "assigned",
                        RotationLead.assigned_agent_id.isnot(None),
                        RotationLead.contact_attempt_count == 0,
                        RotationLead.is_removed.is_(False),
                        RotationLead.assignment_date.isnot(None),
                        func.extract(
                            "epoch",
                            cutoff - RotationLead.assignment_date,
                        )
                        > timeout_hours * 3600,
                    )
                )
            )
            return session.scalars(stmt).all()

    def get_metrics(
        self, db_session: Session
    ) -> dict:
        """Aggregate lead counts by status and agent."""
        with db_session as session:
            # Status breakdown
            status_stmt = (
                select(
                    RotationLead.lead_status,
                    func.count(RotationLead.id).label("count"),
                )
                .where(RotationLead.is_removed.is_(False))
                .group_by(RotationLead.lead_status)
            )
            status_rows = session.execute(status_stmt).all()

            # Agent breakdown
            agent_stmt = (
                select(
                    RotationLead.assigned_agent_id,
                    func.count(RotationLead.id).label("total"),
                    func.count(
                        func.nullif(RotationLead.contact_attempt_count, 0)
                    ).label("contacted"),
                )
                .where(
                    and_(
                        RotationLead.is_removed.is_(False),
                        RotationLead.assigned_agent_id.isnot(None),
                    )
                )
                .group_by(RotationLead.assigned_agent_id)
            )
            agent_rows = session.execute(agent_stmt).all()

            return {
                "status_breakdown": [
                    {"status": row[0], "count": row[1]} for row in status_rows
                ],
                "agent_breakdown": [
                    {
                        "agent_id": row[0],
                        "total": row[1],
                        "contacted": row[2],
                    }
                    for row in agent_rows
                ],
            }


rotation_lead = CRUDRotationLead(RotationLead)
