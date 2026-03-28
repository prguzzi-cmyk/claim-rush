#!/usr/bin/env python

"""CRUD operations for the template file model"""

from typing import Sequence
from uuid import UUID

from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import validate_lock
from app.crud.base import CRUDBase
from app.models import TemplateFile, User
from app.schemas import TemplateFileCreate, TemplateFileUpdate
from app.utils.exceptions import raise_if_unique_violation


class CRUDTemplateFile(CRUDBase[TemplateFile, TemplateFileCreate, TemplateFileUpdate]):
    @staticmethod
    def get_records(
        db_session: Session,
        *,
        where_stmt: list = None,
        filters: list = None,
        order_by: list = None,
        paginated: bool = True,
    ) -> Sequence[TemplateFile] | None:
        """
        Get a list of template files by filtration.

        Parameters
        ----------
        db_session : Session
            Database session
        where_stmt : list
            A list consists of where statements
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns
        paginated : bool
            Add pagination to the response

        Returns
        -------
        Sequence[TemplateFile] | None
            On success, return a list of File objects. None if nothing is found.
        """
        with db_session as session:
            stmt = select(TemplateFile)

            # Apply where
            if where_stmt:
                stmt = stmt.where(or_(*where_stmt))

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply ordering
            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(TemplateFile.created_at)

            if paginated:
                return paginate(session, stmt)
            else:
                return session.scalars(stmt).all()

    def get(
        self, db_session: Session, *, obj_id: UUID, even_removed: bool = False
    ) -> TemplateFile | None:
        """
        Retrieve a template file.

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
        TemplateFile
            A Template file model object.
        """
        with db_session as session:
            stmt = select(TemplateFile).where(TemplateFile.id == obj_id)
            template_file_obj = session.scalar(stmt)
            return template_file_obj

    def create(
        self, db_session: Session, *, obj_in: TemplateFileCreate
    ) -> TemplateFile:
        try:
            with db_session as session:
                file_obj = TemplateFile(
                    state=obj_in.state.upper(),
                    name=obj_in.name,
                    slugged_name=obj_in.slugged_name,
                    type=obj_in.type,
                    size=obj_in.size,
                    path=obj_in.path,
                    description=obj_in.description,
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
            obj = session.query(TemplateFile).get(obj_id)
            if obj:
                validate_lock(obj)

                session.delete(obj)
                session.commit()

    @staticmethod
    def is_owner(
        user: User,
        template_file_obj: TemplateFile | TemplateFileCreate | TemplateFileUpdate,
    ) -> bool:
        """
        Check if the user is an owner of the template file.

        Parameters
        ----------
        user : User
            The user model object
        template_file_obj : TemplateFile | TemplateFileCreate | TemplateFileUpdate
            The template file object

        Returns
        -------
        bool
            True if the user is an owner, otherwise False.
        """
        if (
            hasattr(template_file_obj, "created_by")
            and template_file_obj.created_by == user.id
        ):
            return True

        return False


template_file = CRUDTemplateFile(TemplateFile)
