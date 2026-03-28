#!/usr/bin/env python

"""CRUD operations for the CallTypeConfig model"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.call_type_config import CallTypeConfig
from app.schemas.call_type_config import CallTypeConfigCreate, CallTypeConfigUpdate


class CRUDCallTypeConfig(CRUDBase[CallTypeConfig, CallTypeConfigCreate, CallTypeConfigUpdate]):
    def get_by_code(self, db_session: Session, *, code: str) -> CallTypeConfig | None:
        """Look up a call type config by its code."""
        stmt = select(CallTypeConfig).where(CallTypeConfig.code == code)
        return db_session.scalar(stmt)

    def get_auto_lead_codes(self, db_session: Session) -> set[str]:
        """Return call type codes that have auto_lead_enabled = True."""
        stmt = (
            select(CallTypeConfig.code)
            .where(CallTypeConfig.auto_lead_enabled.is_(True))
        )
        return set(db_session.scalars(stmt).all())

    def get_enabled_codes(self, db_session: Session) -> list[str]:
        """Return all enabled call type codes."""
        stmt = (
            select(CallTypeConfig.code)
            .where(CallTypeConfig.is_enabled.is_(True))
            .order_by(CallTypeConfig.sort_order)
        )
        return list(db_session.scalars(stmt).all())

    def bulk_toggle(
        self, db_session: Session, *, codes: list[str], enabled: bool
    ) -> int:
        """Enable or disable multiple call types at once."""
        count = 0
        stmt = select(CallTypeConfig).where(CallTypeConfig.code.in_(codes))
        configs = db_session.scalars(stmt).all()
        for cfg in configs:
            cfg.is_enabled = enabled
            db_session.add(cfg)
            count += 1
        db_session.commit()
        return count


call_type_config = CRUDCallTypeConfig(CallTypeConfig)
