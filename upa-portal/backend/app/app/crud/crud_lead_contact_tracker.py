#!/usr/bin/env python

"""CRUD operations for lead contact tracker"""

from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.lead_contact_tracker import LeadContactTracker
from app.schemas.lead_contact_tracker import (
    LeadContactTrackerCreate,
    LeadContactTrackerUpdate,
)


class CRUDLeadContactTracker(
    CRUDBase[LeadContactTracker, LeadContactTrackerCreate, LeadContactTrackerUpdate]
):
    def get_by_lead(
        self, db_session: Session, *, lead_id: UUID
    ) -> LeadContactTracker | None:
        with db_session as session:
            stmt = select(self.model).where(self.model.lead_id == lead_id)
            return session.execute(stmt).scalar_one_or_none()

    def get_by_call_sid(
        self, db_session: Session, *, call_sid: str
    ) -> LeadContactTracker | None:
        with db_session as session:
            stmt = select(self.model).where(self.model.ai_call_sid == call_sid)
            return session.execute(stmt).scalar_one_or_none()

    def get_active(
        self, db_session: Session, *, limit: int = 50, offset: int = 0
    ) -> list[LeadContactTracker]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.is_resolved == False)
                .order_by(self.model.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            return list(session.execute(stmt).scalars().all())

    def get_active_count(self, db_session: Session) -> int:
        with db_session as session:
            stmt = (
                select(func.count())
                .select_from(self.model)
                .where(self.model.is_resolved == False)
            )
            return session.execute(stmt).scalar() or 0

    def get_by_agent(
        self, db_session: Session, *, agent_id: UUID
    ) -> list[LeadContactTracker]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(
                    self.model.current_agent_id == agent_id,
                    self.model.is_resolved == False,
                )
                .order_by(self.model.created_at.desc())
            )
            return list(session.execute(stmt).scalars().all())


lead_contact_tracker = CRUDLeadContactTracker(LeadContactTracker)
