#!/usr/bin/env python

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.rotation_config import RotationConfig
from app.schemas.rotation_lead import RotationConfigCreate, RotationConfigUpdate


class CRUDRotationConfig(CRUDBase[RotationConfig, RotationConfigCreate, RotationConfigUpdate]):

    def get_by_territory(
        self, db_session: Session, *, territory_id: UUID | None
    ) -> RotationConfig | None:
        """Find config for a specific territory (None = global default)."""
        with db_session as session:
            if territory_id is None:
                stmt = select(RotationConfig).where(
                    RotationConfig.territory_id.is_(None)
                )
            else:
                stmt = select(RotationConfig).where(
                    RotationConfig.territory_id == territory_id
                )
            return session.scalars(stmt).first()

    def get_or_create_for_territory(
        self, db_session: Session, *, territory_id: UUID | None
    ) -> RotationConfig:
        """Return existing config or create a new default one."""
        existing = self.get_by_territory(db_session, territory_id=territory_id)
        if existing:
            return existing
        obj_in = RotationConfigCreate(territory_id=territory_id)
        return self.create(db_session, obj_in=obj_in)

    def advance_rotation(
        self,
        db_session: Session,
        *,
        config: RotationConfig,
        new_index: int,
        agent_id: UUID,
    ) -> RotationConfig:
        """Update rotation_index and last_assigned_agent_id after assignment."""
        return self.update(
            db_session,
            db_obj=config,
            obj_in={
                "rotation_index": new_index,
                "last_assigned_agent_id": agent_id,
            },
        )


rotation_config = CRUDRotationConfig(RotationConfig)
