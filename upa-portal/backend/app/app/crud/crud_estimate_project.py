#!/usr/bin/env python

"""CRUD operations for the EstimateProject model"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.crud.base import CRUDBase
from app.models.estimate_project import EstimateProject
from app.models.estimate_room import EstimateRoom
from app.models.estimate_line_item import EstimateLineItem
from app.schemas.estimate_project import EstimateProjectCreate, EstimateProjectUpdate


class CRUDEstimateProject(CRUDBase[EstimateProject, EstimateProjectCreate, EstimateProjectUpdate]):
    def get_with_details(self, db_session: Session, *, obj_id: UUID) -> EstimateProject | None:
        """
        Retrieve a project with all nested rooms, line items, measurements, and photos.
        """
        with db_session as session:
            stmt = (
                select(EstimateProject)
                .options(
                    selectinload(EstimateProject.rooms)
                    .selectinload(EstimateRoom.line_items),
                    selectinload(EstimateProject.rooms)
                    .selectinload(EstimateRoom.measurements),
                    selectinload(EstimateProject.rooms)
                    .selectinload(EstimateRoom.photos),
                    selectinload(EstimateProject.photos),
                    selectinload(EstimateProject.fire_claim),
                )
                .where(EstimateProject.id == obj_id)
            )
            if hasattr(EstimateProject, "is_removed"):
                stmt = stmt.where(EstimateProject.is_removed.is_(False))
            return session.scalar(stmt)

    def create_with_rooms(
        self, db_session: Session, *, obj_in: EstimateProjectCreate
    ) -> EstimateProject:
        """
        Create a project with nested rooms and line items in one transaction.
        """
        with db_session as session:
            project = EstimateProject(
                name=obj_in.name,
                status=obj_in.status or "draft",
                estimate_mode=obj_in.estimate_mode or "residential",
                total_cost=obj_in.total_cost,
                notes=obj_in.notes,
                claim_id=obj_in.claim_id,
            )
            session.add(project)
            session.flush()

            if obj_in.rooms:
                for room_in in obj_in.rooms:
                    room = EstimateRoom(
                        name=room_in.name,
                        room_type=room_in.room_type,
                        floor_level=room_in.floor_level,
                        notes=room_in.notes,
                        project_id=project.id,
                    )
                    session.add(room)
                    session.flush()

                    if room_in.line_items:
                        for item_in in room_in.line_items:
                            line_item = EstimateLineItem(
                                description=item_in.description,
                                quantity=item_in.quantity,
                                unit=item_in.unit,
                                unit_cost=item_in.unit_cost,
                                total_cost=item_in.total_cost,
                                notes=item_in.notes,
                                category=item_in.category,
                                room_id=room.id,
                            )
                            session.add(line_item)

            session.commit()
            project_id = project.id

        # Re-fetch with eager loading so relationships are available after session closes
        return self.get_with_details(db_session, obj_id=project_id)


estimate_project = CRUDEstimateProject(EstimateProject)
