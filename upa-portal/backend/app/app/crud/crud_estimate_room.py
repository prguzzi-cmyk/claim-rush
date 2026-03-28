#!/usr/bin/env python

"""CRUD operations for the EstimateRoom model"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.crud.base import CRUDBase
from app.models.estimate_room import EstimateRoom
from app.schemas.estimate_room import EstimateRoomCreate, EstimateRoomUpdate


class CRUDEstimateRoom(CRUDBase[EstimateRoom, EstimateRoomCreate, EstimateRoomUpdate]):
    def get_with_details(self, db_session: Session, *, obj_id: UUID) -> EstimateRoom | None:
        """Get a room with eagerly loaded line_items, measurements, and photos."""
        with db_session as session:
            stmt = (
                select(EstimateRoom)
                .options(
                    selectinload(EstimateRoom.line_items),
                    selectinload(EstimateRoom.measurements),
                    selectinload(EstimateRoom.photos),
                )
                .where(EstimateRoom.id == obj_id)
            )
            return session.scalar(stmt)

    def get_by_project(self, db_session: Session, *, project_id: UUID) -> list[EstimateRoom]:
        """Get all rooms belonging to a project."""
        with db_session as session:
            stmt = (
                select(EstimateRoom)
                .options(
                    selectinload(EstimateRoom.line_items),
                    selectinload(EstimateRoom.measurements),
                    selectinload(EstimateRoom.photos),
                )
                .where(EstimateRoom.project_id == project_id)
                .order_by(EstimateRoom.created_at)
            )
            return list(session.scalars(stmt).all())


estimate_room = CRUDEstimateRoom(EstimateRoom)
