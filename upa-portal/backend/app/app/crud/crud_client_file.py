#!/usr/bin/env python

"""CRUD operations for the client file model"""

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
from app.models import Client, ClientFile
from app.schemas import ClientFileCreate, ClientFileUpdate
from app.utils.exceptions import raise_if_unique_violation


class CRUDClientFile(CRUDBase[ClientFile, ClientFileCreate, ClientFileUpdate]):
    @staticmethod
    def get_all(db_session: Session, *, obj_id: UUID) -> list[ClientFile] | None:
        """
        Retrieve all client files.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object

        Returns
        -------
        list of ClientFile
            A list of Client files.
        """
        disable_installed_extensions_check()

        with db_session as session:
            stmt = select(Client).where(Client.id == obj_id)
            client_obj = session.scalars(stmt).first()

            return paginate(client_obj.client_files)

    @staticmethod
    def get_records(
        db_session: Session,
        *,
        obj_id: UUID,
        filters: list = None,
        order_by: list = None,
        paginated: bool = True,
    ) -> Sequence[ClientFile] | None:
        """
        Get a list of client files by filtration.

        Parameters
        ----------
        db_session : Session
            Database session
        obj_id : UUID
            The client id
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns
        paginated : bool
            Add pagination to the response

        Returns
        -------
        Sequence[ClientFile] | None
            On success, return a list of File objects. None if nothing is found.
        """
        with db_session as session:
            stmt = select(ClientFile)

            # Apply where condition
            stmt = stmt.where(ClientFile.client_id == obj_id)

            # Apply filters
            if filters:
                stmt = stmt.filter(or_(*filters))

            # Apply ordering
            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(ClientFile.created_at)

            if paginated:
                return sql_paginate(session, stmt)
            else:
                return session.scalars(stmt).all()

    def get(
        self, db_session: Session, *, obj_id: UUID, even_removed: bool = False
    ) -> ClientFile | None:
        """
        Retrieve a client file.

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
        ClientFile
            A Client file model object.
        """
        with db_session as session:
            stmt = select(ClientFile).where(ClientFile.id == obj_id)
            client_file_obj = session.scalar(stmt)
            return client_file_obj

    def create(self, db_session: Session, *, obj_in: ClientFileCreate) -> ClientFile:
        try:
            with db_session as session:
                file_obj = ClientFile(
                    client_id=obj_in.client_id,
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
            obj = session.query(ClientFile).get(obj_id)
            if obj:
                validate_lock(obj)

                session.delete(obj)
                session.commit()


client_file = CRUDClientFile(ClientFile)
