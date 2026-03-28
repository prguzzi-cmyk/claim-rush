#!/usr/bin/env python

"""CRUD operations for the RoofAnalysis model"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.log import logger
from app.crud.base import CRUDBase
from app.models.roof_analysis import RoofAnalysis
from app.schemas.roof_analysis_db import RoofAnalysisCreate, RoofAnalysisUpdate


class CRUDRoofAnalysis(CRUDBase[RoofAnalysis, RoofAnalysisCreate, RoofAnalysisUpdate]):

    def get_by_property_id(
        self, db_session: Session, *, property_id: str
    ) -> RoofAnalysis | None:
        """Get the latest analysis for a given property_id."""
        with db_session as session:
            stmt = (
                select(RoofAnalysis)
                .where(RoofAnalysis.property_id == property_id)
                .order_by(RoofAnalysis.created_at.desc())
                .limit(1)
            )
            return session.scalar(stmt)

    def get_by_property_and_storm(
        self, db_session: Session, *, property_id: str, storm_event_id: str
    ) -> RoofAnalysis | None:
        """Get analysis for a specific property + storm combination."""
        with db_session as session:
            stmt = select(RoofAnalysis).where(
                and_(
                    RoofAnalysis.property_id == property_id,
                    RoofAnalysis.storm_event_id == storm_event_id,
                )
            )
            return session.scalar(stmt)

    def get_filtered(
        self,
        db_session: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        status: str | None = None,
        damage_label: str | None = None,
        state: str | None = None,
        city: str | None = None,
        analysis_mode: str | None = None,
        is_demo: bool | None = None,
        batch_id: str | None = None,
        territory_filters: list | None = None,
    ) -> tuple[Sequence[RoofAnalysis], int]:
        """Paginated filtered query. Returns (items, total_count)."""
        with db_session as session:
            stmt = select(RoofAnalysis).where(RoofAnalysis.is_active.is_(True))
            count_stmt = select(func.count(RoofAnalysis.id)).where(RoofAnalysis.is_active.is_(True))

            filters = []

            if territory_filters:
                filters.extend(territory_filters)

            if status:
                filters.append(RoofAnalysis.status == status)
            if damage_label:
                filters.append(RoofAnalysis.damage_label == damage_label)
            if state:
                filters.append(RoofAnalysis.state == state)
            if city:
                filters.append(RoofAnalysis.city.ilike(f"%{city}%"))
            if analysis_mode:
                filters.append(RoofAnalysis.analysis_mode == analysis_mode)
            if is_demo is not None:
                filters.append(RoofAnalysis.is_demo.is_(is_demo))
            if batch_id:
                filters.append(RoofAnalysis.batch_id == batch_id)

            if filters:
                stmt = stmt.filter(and_(*filters))
                count_stmt = count_stmt.filter(and_(*filters))

            total = session.scalar(count_stmt) or 0

            stmt = stmt.order_by(RoofAnalysis.created_at.desc())
            stmt = stmt.offset(skip).limit(limit)

            items = list(session.scalars(stmt).all())
            return items, total

    def get_stats(
        self,
        db_session: Session,
        *,
        territory_filters: list | None = None,
    ) -> dict:
        """Aggregate counts for dashboard stats."""
        with db_session as session:
            base_filter = [RoofAnalysis.is_active.is_(True)]
            if territory_filters:
                base_filter.extend(territory_filters)

            # Total
            total = session.scalar(
                select(func.count(RoofAnalysis.id)).where(and_(*base_filter))
            ) or 0

            # By status
            status_rows = session.execute(
                select(RoofAnalysis.status, func.count(RoofAnalysis.id))
                .where(and_(*base_filter))
                .group_by(RoofAnalysis.status)
            ).all()
            by_status = {row[0]: row[1] for row in status_rows}

            # By damage_label
            label_rows = session.execute(
                select(RoofAnalysis.damage_label, func.count(RoofAnalysis.id))
                .where(and_(*base_filter))
                .group_by(RoofAnalysis.damage_label)
            ).all()
            by_damage_label = {row[0]: row[1] for row in label_rows}

            # By analysis_mode
            mode_rows = session.execute(
                select(RoofAnalysis.analysis_mode, func.count(RoofAnalysis.id))
                .where(and_(*base_filter))
                .group_by(RoofAnalysis.analysis_mode)
            ).all()
            by_analysis_mode = {row[0]: row[1] for row in mode_rows}

            return {
                "total": total,
                "by_status": by_status,
                "by_damage_label": by_damage_label,
                "by_analysis_mode": by_analysis_mode,
            }

    def get_batch_status(
        self, db_session: Session, *, batch_id: str
    ) -> dict:
        """Get processing status of a batch."""
        with db_session as session:
            base_filter = [RoofAnalysis.batch_id == batch_id]

            total = session.scalar(
                select(func.count(RoofAnalysis.id)).where(and_(*base_filter))
            ) or 0

            status_rows = session.execute(
                select(RoofAnalysis.status, func.count(RoofAnalysis.id))
                .where(and_(*base_filter))
                .group_by(RoofAnalysis.status)
            ).all()
            status_map = {row[0]: row[1] for row in status_rows}

            return {
                "batch_id": batch_id,
                "total": total,
                "completed": sum(
                    v for k, v in status_map.items()
                    if k in ("ai_analyzed", "rules_scored", "lead_qualified", "packet_ready")
                ),
                "in_progress": status_map.get("imagery_fetched", 0),
                "queued": status_map.get("queued", 0),
                "errored": status_map.get("error", 0),
            }

    def update_status(
        self,
        db_session: Session,
        *,
        obj_id: UUID,
        status: str,
        result_fields: dict | None = None,
    ) -> RoofAnalysis | None:
        """Update a record's status and optional result fields."""
        with db_session as session:
            record = self.get(db_session, obj_id=obj_id)
            if not record:
                return None

            update_data = {"status": status}
            if result_fields:
                update_data.update(result_fields)

            return self.update(db_session, db_obj=record, obj_in=update_data)


roof_analysis = CRUDRoofAnalysis(RoofAnalysis)
