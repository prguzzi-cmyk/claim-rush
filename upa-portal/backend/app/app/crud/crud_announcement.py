#!/usr/bin/env python

"""CRUD operations for the announcement model"""

from typing import Any, Sequence
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import and_, select
from sqlalchemy.orm import Session, joinedload

from app.core.log import logger
from app.core.security import is_removed
from app.crud.base import CRUDBase
from app.models import Announcement
from app.schemas import AnnouncementCreate, AnnouncementUpdate
from app.utils.exceptions import exc_conflict


class CRUDAnnouncement(CRUDBase[Announcement, AnnouncementCreate, AnnouncementUpdate]):
    def get_multi(
        self,
        db_session: Session,
        join_target: Any = None,
        is_outer: bool = False,
        removed: bool = False,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[Announcement] | None:
        """
        Get a list of records of a specific model

        Parameters
        ----------
        db_session : Session
            Database session
        join_target : Any
            Join target model
        is_outer : bool
            Implement Full Outer Join
        removed : bool
            Fetch only removed records
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns

        Returns
        -------
        Sequence[ModelType] or None
            On success, return the found records. None if nothing is found.
        """
        with db_session as session:
            try:
                stmt = select(self.model)

                # Apply Join
                if join_target:
                    stmt = stmt.options(joinedload(join_target))

                # Removed records query
                stmt = stmt.where(self.model.is_removed.is_(removed))

                # Apply filters
                if filters:
                    stmt = stmt.filter(and_(*filters))

                # Apply ordering
                if order_by:
                    stmt = stmt.order_by(*order_by)
                else:
                    stmt = stmt.order_by(self.model.created_at)

                return paginate(session, stmt, unique=True)
            except Exception as e:
                logger.error(str(e))
                exc_conflict(
                    "There is some issue with the provided values. "
                    "Please check and try again."
                )

    def create(
        self, db_session: Session, *, obj_in: AnnouncementCreate
    ) -> Announcement:
        with db_session as session:
            announcement_obj = Announcement(
                title=obj_in.title,
                content=obj_in.content,
                announcement_date=obj_in.announcement_date,
                expiration_date=obj_in.expiration_date,
                can_be_removed=obj_in.can_be_removed,
            )

            session.add(announcement_obj)
            session.commit()
            session.refresh(announcement_obj)

            return announcement_obj

    def update(
        self,
        db_session: Session,
        *,
        announcement_id: UUID,
        obj_in: AnnouncementUpdate | dict[str, Any],
    ) -> Announcement:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            announcement_obj: Announcement = session.query(Announcement).get(
                announcement_id
            )
            obj_data = jsonable_encoder(announcement_obj)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data:
                    setattr(announcement_obj, field, update_data[field])

            session.commit()
            session.refresh(announcement_obj)

            return announcement_obj

    def restore(
        self,
        db_session: Session,
        *,
        db_obj: Announcement,
    ) -> Announcement:
        """
        Restore a record in the database.

        Parameters
        ----------
        db_session : Session
            Database session
        db_obj : Announcement
            Database model object

        Returns
        -------
        Announcement
            Returns updated record.
        """
        is_removed(db_obj)

        obj_in = dict(is_removed=False)

        db_obj = self.update(
            db_session=db_session, announcement_id=db_obj.id, obj_in=obj_in
        )

        return db_obj


announcement = CRUDAnnouncement(Announcement)
