#!/usr/bin/env python

"""CRUD operations for the CrimeIncident model"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.log import logger
from app.crud.base import CRUDBase
from app.models.crime_incident import CrimeIncident
from app.schemas.crime_incident import CrimeIncidentCreate, CrimeIncidentUpdate


class CRUDCrimeIncident(CRUDBase[CrimeIncident, CrimeIncidentCreate, CrimeIncidentUpdate]):
    def get_by_external_id(
        self, db_session: Session, *, data_source: str, external_id: str
    ) -> CrimeIncident | None:
        with db_session as session:
            stmt = select(CrimeIncident).where(
                and_(
                    CrimeIncident.data_source == data_source,
                    CrimeIncident.external_id == external_id,
                )
            )
            return session.scalar(stmt)

    def upsert_from_external(
        self,
        db_session: Session,
        *,
        data_source: str,
        external_id: str,
        defaults: dict,
    ) -> CrimeIncident:
        existing = self.get_by_external_id(
            db_session, data_source=data_source, external_id=external_id
        )
        if existing:
            return self.update(db_session, db_obj=existing, obj_in=defaults)
        else:
            create_data = CrimeIncidentCreate(
                data_source=data_source,
                external_id=external_id,
                **defaults,
            )
            return self.create(db_session, obj_in=create_data)

    def deactivate_stale_external(
        self,
        db_session: Session,
        data_source: str,
        cutoff_dt: datetime,
    ) -> int:
        """Mark crime incidents as inactive if they haven't been updated since cutoff."""
        with db_session as session:
            from sqlalchemy import update
            stmt = (
                update(CrimeIncident)
                .where(
                    and_(
                        CrimeIncident.data_source == data_source,
                        CrimeIncident.active.is_(True),
                        CrimeIncident.updated_at < cutoff_dt,
                    )
                )
                .values(active=False)
            )
            result = session.execute(stmt)
            session.commit()
            return result.rowcount

    def get_filtered(
        self,
        db_session: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        incident_type: str | None = None,
        severity: str | None = None,
        city: str | None = None,
        state: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        is_mock: bool | None = None,
    ) -> tuple[list[CrimeIncident], int]:
        with db_session as session:
            filters = [CrimeIncident.active.is_(True)]

            if incident_type:
                filters.append(CrimeIncident.incident_type == incident_type)
            if severity:
                filters.append(CrimeIncident.severity == severity)
            if city:
                filters.append(CrimeIncident.city.ilike(f"%{city}%"))
            if state:
                filters.append(CrimeIncident.state == state.upper())
            if date_from:
                filters.append(CrimeIncident.occurred_at >= date_from)
            if date_to:
                filters.append(CrimeIncident.occurred_at <= date_to)
            if is_mock is not None:
                filters.append(CrimeIncident.is_mock.is_(is_mock))

            where = and_(*filters)

            count_stmt = select(func.count()).select_from(CrimeIncident).where(where)
            total = session.scalar(count_stmt) or 0

            stmt = (
                select(CrimeIncident)
                .where(where)
                .order_by(CrimeIncident.occurred_at.desc().nullslast())
                .offset(skip)
                .limit(limit)
            )
            items = list(session.scalars(stmt).all())

            return items, total

    def get_stats(self, db_session: Session) -> dict:
        with db_session as session:
            base = CrimeIncident.active.is_(True)

            total = session.scalar(
                select(func.count()).select_from(CrimeIncident).where(base)
            ) or 0

            by_type_rows = session.execute(
                select(CrimeIncident.incident_type, func.count())
                .where(base)
                .group_by(CrimeIncident.incident_type)
            ).all()

            by_severity_rows = session.execute(
                select(CrimeIncident.severity, func.count())
                .where(base)
                .group_by(CrimeIncident.severity)
            ).all()

            by_source_rows = session.execute(
                select(CrimeIncident.data_source, func.count())
                .where(base)
                .group_by(CrimeIncident.data_source)
            ).all()

            return {
                "total": total,
                "by_type": {row[0]: row[1] for row in by_type_rows},
                "by_severity": {row[0]: row[1] for row in by_severity_rows},
                "by_source": {row[0]: row[1] for row in by_source_rows},
            }


crime_incident = CRUDCrimeIncident(CrimeIncident)
