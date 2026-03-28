#!/usr/bin/env python

"""CRUD operations for the lead file model"""

from typing import Sequence
from uuid import UUID

from fastapi_pagination import paginate
from fastapi_pagination.ext.sqlalchemy import paginate as sql_paginate
from fastapi_pagination.utils import disable_installed_extensions_check
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import validate_lock
from app.crud.base import CRUDBase
from app.models.user_personal_file import UserPersonalFile
from app.schemas.user_personal_file import UserPersonalFileCreate, UserPersonalFileUpdate
from app.utils.exceptions import raise_if_unique_violation


class CRUDUserPersonalFile(CRUDBase[UserPersonalFile, UserPersonalFileCreate, UserPersonalFileUpdate]):
    @staticmethod
    def get_all(db_session: Session, *, owner_id: UUID) -> list[UserPersonalFile] | None:
        """
        Retrieve all lead files.

        Parameters
        ----------
        db_session : Session
            Database Session
        owner_id : UUID
            ID of an object

        Returns
        -------
        list of LeadFile
            A list of Lead files.
        """
        disable_installed_extensions_check()

        with db_session as session:
            stmt = select(UserPersonalFile).where(UserPersonalFile.owner_id == owner_id)
            personal_files = session.scalars(stmt).all()

            return paginate(personal_files)

    @staticmethod
    def get_records(
        db_session: Session,
        *,
        owner_id: UUID,
        filters: list = None,
        order_by: list = None,
        paginated: bool = True,
    ) -> Sequence[UserPersonalFile]:
        """
        Get a list of lead files by filtration.

        Parameters
        ----------
        db_session : Session
            Database session
        owner_id : UUID
            The owner id
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns
        paginated : bool
            Add pagination to the response

        Returns
        -------
        Sequence[UserPersonaFile] | None
            On success, return a list of File objects. None if nothing is found.
        """
        with db_session as session:
            stmt = select(UserPersonalFile)

            # Apply where condition
            stmt = stmt.where(UserPersonalFile.owner_id == owner_id)

            # Apply filters
            if filters:
                stmt = stmt.filter(or_(*filters))

            # Apply ordering
            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(UserPersonalFile.created_at)

            if paginated:
                return sql_paginate(session, stmt)
            else:
                return session.scalars(stmt).all()

    def get(
        self, db_session: Session, *, obj_id: UUID, even_removed: bool = False
    ) -> UserPersonalFile | None:
        """
        Retrieve a lead file.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object
        even_removed : bool
            Fetch even if removed

        Returns
        -------
        LeadFile
            A Lead file model object.
        """
        with db_session as session:
            stmt = select(UserPersonalFile).where(UserPersonalFile.id == obj_id)
            lead_file_obj = session.scalars(stmt).first()
            return lead_file_obj

    def create(self, db_session: Session, *, obj_in: UserPersonalFileCreate) -> UserPersonalFile:
        try:
            with db_session as session:
                file_obj = UserPersonalFile(
                    owner_id=obj_in.owner_id,
                    name=obj_in.name,
                    slugged_name=obj_in.slugged_name,
                    type=obj_in.type,
                    size=obj_in.size,
                    path=obj_in.path,
                    description=obj_in.description,
                    state = obj_in.state,
                    expiration_date=obj_in.expiration_date,
                    can_be_removed=obj_in.can_be_removed,
                )

                session.add(file_obj)
                session.commit()
                session.refresh(file_obj)

                return file_obj
        except IntegrityError as exc:
            raise_if_unique_violation(
                exc=exc, msg="A file with this name already exists."
            )

            raise exc

    def remove(self, db_session: Session, *, obj_id: UUID) -> None:
        """
        Delete a record in the database.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of the object to delete
        """
        with db_session as session:
            obj = session.query(UserPersonalFile).get(obj_id)
            if obj:
                validate_lock(obj)

                session.delete(obj)
                session.commit()


user_personal_file = CRUDUserPersonalFile(UserPersonalFile)
