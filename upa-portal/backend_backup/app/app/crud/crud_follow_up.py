#!/usr/bin/env python

"""CRUD operations for follow-up model"""

from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud
from app.core.security import validate_lock
from app.models import FollowUp
from app.schemas import FollowUpCreate, FollowUpUpdate


class CRUDFollowUp:
    def get(self, db_session: Session, *, obj_id: UUID) -> FollowUp | None:
        """
        Retrieve a single record by ID

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object

        Returns
        -------
        ModelType
            On success, returns the found record, or None if nothing is found.
        """
        with db_session as session:
            stmt = select(FollowUp).where(FollowUp.id == obj_id)
            return session.scalars(stmt).first()

    def create(
        self, db_session: Session, *, lead_id: UUID, obj_in: FollowUpCreate
    ) -> FollowUp:
        lead_obj = crud.lead.get(db_session, obj_id=lead_id)

        with db_session as session:
            follow_up_obj = FollowUp(
                type=obj_in.type.value,
                dated=obj_in.dated,
                note=obj_in.note,
                next_date=obj_in.next_date,
            )
            follow_up_obj.lead = lead_obj

            session.add(follow_up_obj)
            session.commit()
            session.refresh(follow_up_obj)

            return follow_up_obj

    def update(
        self,
        db_session: Session,
        *,
        db_obj: FollowUp,
        obj_in: FollowUpUpdate | dict[str, Any]
    ) -> FollowUp:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            obj_data = jsonable_encoder(db_obj)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data:
                    setattr(db_obj, field, update_data[field])

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

        return db_obj

    def remove(self, db_session: Session, *, obj_id: UUID) -> FollowUp | None:
        """
        Delete a record in the database.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of the object to delete

        Returns
        -------
        ModelType
            Returns the deleted object, or None if not found.
        """
        with db_session as session:
            obj = self.get(db_session, obj_id=obj_id)
            if obj:
                validate_lock(obj)

                obj.is_removed = True

                session.add(obj)
                session.commit()
                session.refresh(obj)

        return obj


follow_up = CRUDFollowUp()
