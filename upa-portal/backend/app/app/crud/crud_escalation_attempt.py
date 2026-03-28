#!/usr/bin/env python

"""CRUD operations for escalation attempts"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.escalation_attempt import EscalationAttempt
from app.schemas.lead_contact_tracker import (
    EscalationAttemptCreate,
    EscalationAttemptUpdate,
)


class CRUDEscalationAttempt(
    CRUDBase[EscalationAttempt, EscalationAttemptCreate, EscalationAttemptUpdate]
):
    def get_by_tracker(
        self, db_session: Session, *, tracker_id: UUID
    ) -> list[EscalationAttempt]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.tracker_id == tracker_id)
                .order_by(self.model.escalation_level.asc())
            )
            return list(session.execute(stmt).scalars().all())

    def get_tried_agent_ids(
        self, db_session: Session, *, tracker_id: UUID
    ) -> set[UUID]:
        with db_session as session:
            stmt = (
                select(self.model.agent_id)
                .where(self.model.tracker_id == tracker_id)
            )
            return set(session.execute(stmt).scalars().all())

    def get_active_by_agent(
        self, db_session: Session, *, agent_id: UUID
    ) -> list[EscalationAttempt]:
        from app.models.lead_contact_tracker import LeadContactTracker

        with db_session as session:
            stmt = (
                select(self.model)
                .join(
                    LeadContactTracker,
                    LeadContactTracker.id == self.model.tracker_id,
                )
                .where(
                    self.model.agent_id == agent_id,
                    self.model.transfer_status.in_(
                        ["pending", "initiated", "ringing"]
                    ),
                    LeadContactTracker.is_resolved == False,
                )
                .order_by(self.model.created_at.desc())
            )
            return list(session.execute(stmt).scalars().all())


escalation_attempt = CRUDEscalationAttempt(EscalationAttempt)
