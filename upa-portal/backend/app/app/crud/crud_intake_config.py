#!/usr/bin/env python

"""CRUD operations for Intake Config"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.intake_config import IntakeConfig
from app.schemas.intake_config import IntakeConfigCreate, IntakeConfigUpdate


class CRUDIntakeConfig(CRUDBase[IntakeConfig, IntakeConfigCreate, IntakeConfigUpdate]):
    def get_by_slug(self, db_session: Session, *, slug: str) -> IntakeConfig | None:
        with db_session as session:
            stmt = select(self.model).where(self.model.slug == slug)
            return session.scalars(stmt).first()

    def get_active(self, db_session: Session) -> list[IntakeConfig]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.is_active.is_(True))
                .order_by(self.model.created_at.desc())
            )
            return list(session.execute(stmt).scalars().all())


intake_config = CRUDIntakeConfig(IntakeConfig)
