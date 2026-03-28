#!/usr/bin/env python

"""CRUD operations for the FireDataSourceConfig model"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.fire_data_source_config import FireDataSourceConfig
from app.schemas.fire_data_source_config import (
    FireDataSourceConfigCreate,
    FireDataSourceConfigUpdate,
)


class CRUDFireDataSourceConfig(
    CRUDBase[FireDataSourceConfig, FireDataSourceConfigCreate, FireDataSourceConfigUpdate]
):
    def get_active_by_type(
        self, db_session: Session, *, source_type: str
    ) -> list[FireDataSourceConfig]:
        """
        Get all active data source configs for a given source type.

        Parameters
        ----------
        db_session : Session
            Database session.
        source_type : str
            Source type to filter by (socrata, nifc, firms).

        Returns
        -------
        list[FireDataSourceConfig]
        """
        with db_session as session:
            stmt = select(FireDataSourceConfig).where(
                FireDataSourceConfig.source_type == source_type,
                FireDataSourceConfig.is_active.is_(True),
            )
            return list(session.scalars(stmt).all())

    def update_last_polled(
        self, db_session: Session, *, config_id: UUID
    ) -> None:
        """
        Update the last_polled_at timestamp for a data source config.

        Parameters
        ----------
        db_session : Session
            Database session.
        config_id : UUID
            UUID of the config to update.
        """
        with db_session as session:
            obj = session.get(FireDataSourceConfig, config_id)
            if obj:
                obj.last_polled_at = datetime.now(tz=timezone.utc)
                session.add(obj)
                session.commit()
                session.refresh(obj)


fire_data_source_config = CRUDFireDataSourceConfig(FireDataSourceConfig)
