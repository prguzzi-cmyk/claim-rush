#!/usr/bin/env python

"""CRUD operations for the EstimatePhoto module"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.estimate_photo import EstimatePhoto
from app.schemas.estimate_photo import EstimatePhotoCreate, EstimatePhotoUpdate


class CRUDEstimatePhoto(
    CRUDBase[EstimatePhoto, EstimatePhotoCreate, EstimatePhotoUpdate]
):
    def get_by_project(
        self,
        db_session: Session,
        *,
        project_id: UUID,
        room_id: UUID | None = None,
    ) -> list[EstimatePhoto]:
        """Get photos for a project, optionally filtered by room."""
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.project_id == project_id)
                .order_by(self.model.created_at)
            )
            if room_id is not None:
                stmt = stmt.where(self.model.room_id == room_id)
            return list(session.scalars(stmt).all())

    def get_by_room(
        self,
        db_session: Session,
        *,
        room_id: UUID,
    ) -> list[EstimatePhoto]:
        """Get all photos for a specific room."""
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.room_id == room_id)
                .order_by(self.model.created_at)
            )
            return list(session.scalars(stmt).all())


estimate_photo = CRUDEstimatePhoto(EstimatePhoto)
