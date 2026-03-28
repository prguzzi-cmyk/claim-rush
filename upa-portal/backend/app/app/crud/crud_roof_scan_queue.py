#!/usr/bin/env python

"""CRUD operations for the RoofScanQueue model"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.log import logger
from app.crud.base import CRUDBase
from app.models.roof_scan_queue import RoofScanQueue
from app.schemas.roof_scan_queue import RoofScanQueueCreate, RoofScanQueueUpdate


class CRUDRoofScanQueue(CRUDBase[RoofScanQueue, RoofScanQueueCreate, RoofScanQueueUpdate]):

    def bulk_create(
        self, db_session: Session, *, items: list[dict]
    ) -> int:
        """Batch insert, skip duplicates on (property_id, zone_id).

        Returns the number of rows actually inserted.
        """
        if not items:
            return 0

        with db_session as session:
            stmt = pg_insert(RoofScanQueue).values(items)
            stmt = stmt.on_conflict_do_nothing(
                constraint="uq_scan_property_zone"
            )
            result = session.execute(stmt)
            session.commit()
            return result.rowcount  # type: ignore[return-value]

    def get_by_zone(
        self,
        db_session: Session,
        *,
        zone_id: str,
        scan_status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[Sequence[RoofScanQueue], int]:
        """Paginated query for a specific zone. Returns (items, total)."""
        with db_session as session:
            filters = [RoofScanQueue.zone_id == zone_id]
            if scan_status:
                filters.append(RoofScanQueue.scan_status == scan_status)

            count_stmt = select(func.count(RoofScanQueue.id)).where(and_(*filters))
            total = session.scalar(count_stmt) or 0

            stmt = (
                select(RoofScanQueue)
                .where(and_(*filters))
                .order_by(RoofScanQueue.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            items = list(session.scalars(stmt).all())
            return items, total

    def get_stats(
        self, db_session: Session, *, zone_id: str | None = None
    ) -> dict:
        """Aggregate counts grouped by scan_status."""
        with db_session as session:
            filters = []
            if zone_id:
                filters.append(RoofScanQueue.zone_id == zone_id)

            base_where = and_(*filters) if filters else True

            total = session.scalar(
                select(func.count(RoofScanQueue.id)).where(base_where)
            ) or 0

            status_rows = session.execute(
                select(RoofScanQueue.scan_status, func.count(RoofScanQueue.id))
                .where(base_where)
                .group_by(RoofScanQueue.scan_status)
            ).all()
            status_map = {row[0]: row[1] for row in status_rows}

            return {
                "total": total,
                "pending": status_map.get("pending", 0),
                "queued": status_map.get("queued", 0),
                "scanning": status_map.get("scanning", 0),
                "completed": status_map.get("completed", 0),
                "errored": status_map.get("error", 0),
            }

    def update_status(
        self,
        db_session: Session,
        *,
        obj_id: UUID,
        scan_status: str,
        roof_analysis_id: UUID | None = None,
        error_message: str | None = None,
    ) -> RoofScanQueue | None:
        """Update a queue item's status and optional linked fields."""
        record = self.get(db_session, obj_id=obj_id)
        if not record:
            return None

        update_data: dict = {"scan_status": scan_status}
        if roof_analysis_id is not None:
            update_data["roof_analysis_id"] = roof_analysis_id
        if error_message is not None:
            update_data["error_message"] = error_message

        return self.update(db_session, db_obj=record, obj_in=update_data)

    def get_pending_batch(
        self, db_session: Session, *, zone_id: str, limit: int = 50
    ) -> list[RoofScanQueue]:
        """Return the next batch of pending items for a zone."""
        with db_session as session:
            stmt = (
                select(RoofScanQueue)
                .where(
                    and_(
                        RoofScanQueue.zone_id == zone_id,
                        RoofScanQueue.scan_status == "pending",
                    )
                )
                .order_by(RoofScanQueue.created_at.asc())
                .limit(limit)
            )
            return list(session.scalars(stmt).all())


roof_scan_queue = CRUDRoofScanQueue(RoofScanQueue)
