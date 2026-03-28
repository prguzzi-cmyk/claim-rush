#!/usr/bin/env python

"""CRUD operations for the CrimeDataSourceConfig model"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.crime_data_source_config import CrimeDataSourceConfig
from app.schemas.crime_data_source_config import (
    CrimeDataSourceConfigCreate,
    CrimeDataSourceConfigUpdate,
)


class CRUDCrimeDataSourceConfig(
    CRUDBase[CrimeDataSourceConfig, CrimeDataSourceConfigCreate, CrimeDataSourceConfigUpdate]
):
    def get_enabled(self, db_session: Session) -> list[CrimeDataSourceConfig]:
        with db_session as session:
            stmt = select(CrimeDataSourceConfig).where(
                CrimeDataSourceConfig.enabled.is_(True),
            )
            return list(session.scalars(stmt).all())

    def get_enabled_by_type(
        self, db_session: Session, *, source_type: str
    ) -> list[CrimeDataSourceConfig]:
        with db_session as session:
            stmt = select(CrimeDataSourceConfig).where(
                CrimeDataSourceConfig.source_type == source_type,
                CrimeDataSourceConfig.enabled.is_(True),
            )
            return list(session.scalars(stmt).all())

    def update_poll_status(
        self,
        db_session: Session,
        *,
        config_id: UUID,
        status: str,
        record_count: int,
    ) -> None:
        with db_session as session:
            obj = session.get(CrimeDataSourceConfig, config_id)
            if obj:
                obj.last_polled_at = datetime.now(tz=timezone.utc)
                obj.connection_status = status
                obj.last_record_count = record_count
                session.add(obj)
                session.commit()
                session.refresh(obj)


crime_data_source_config = CRUDCrimeDataSourceConfig(CrimeDataSourceConfig)
