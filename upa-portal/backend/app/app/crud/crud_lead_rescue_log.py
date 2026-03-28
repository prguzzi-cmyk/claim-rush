#!/usr/bin/env python

"""CRUD operations for lead rescue logs"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.lead_rescue_log import LeadRescueLog
from app.schemas.lead_rescue_log import LeadRescueLogBase


class CRUDLeadRescueLog(CRUDBase[LeadRescueLog, LeadRescueLogBase, LeadRescueLogBase]):
    def get_by_lead(
        self, db_session: Session, *, lead_id: UUID
    ) -> list[LeadRescueLog]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.lead_id == lead_id)
                .order_by(self.model.created_at.desc())
            )
            return list(session.execute(stmt).scalars().all())

    def get_latest_by_lead(
        self, db_session: Session, *, lead_id: UUID
    ) -> LeadRescueLog | None:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.lead_id == lead_id)
                .order_by(self.model.created_at.desc())
                .limit(1)
            )
            return session.scalars(stmt).first()

    def count_by_lead(
        self, db_session: Session, *, lead_id: UUID
    ) -> int:
        with db_session as session:
            stmt = (
                select(func.count(self.model.id))
                .where(self.model.lead_id == lead_id)
            )
            return session.scalar(stmt) or 0

    def get_active_rescues(
        self, db_session: Session, *, limit: int = 50, offset: int = 0
    ) -> list[LeadRescueLog]:
        with db_session as session:
            stmt = (
                select(self.model)
                .order_by(self.model.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
            return list(session.execute(stmt).scalars().all())

    def get_converted_rescues(
        self, db_session: Session, *, limit: int = 50
    ) -> list[LeadRescueLog]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.is_converted.is_(True))
                .order_by(self.model.created_at.desc())
                .limit(limit)
            )
            return list(session.execute(stmt).scalars().all())


lead_rescue_log = CRUDLeadRescueLog(LeadRescueLog)
