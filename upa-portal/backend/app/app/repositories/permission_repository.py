#!/usr/bin/env python

"""Permission Repository"""

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Permission
from app.repositories import BaseRepository
from app.schemas import PermissionCreateRepository, PermissionUpdateRepository
from app.utils.exceptions import DatabaseOperationError


class PermissionRepository(
    BaseRepository[Permission, PermissionCreateRepository, PermissionUpdateRepository]
):
    """
    Repository for managing Permission entities in the database.

    Attributes
    ----------
    db_session : Session
        The database session used for accessing permission data.
    """

    def __init__(self, db_session: Session):
        """
        Initializes the PermissionRepository with the given database session.

        Parameters
        ----------
        db_session : Session
            The database session used for accessing permission data.
        """
        super().__init__(db_session, Permission)

    def get_permission_by_name(self, name: str) -> Permission | None:
        """
        Retrieves a permission by its name.

        Parameters
        ----------
        name : str
            The name of the permission to retrieve.

        Returns
        -------
        Permission | None
            The permission entity if found, otherwise None.

        Raises
        ------
        DatabaseOperationError
            If there is an issue retrieving entity.
        """
        with self.db_session as session:
            try:
                stmt = select(Permission).where(Permission.name == name)
                return session.scalar(stmt)
            except SQLAlchemyError as e:
                raise DatabaseOperationError(
                    f"Failed to retrieve {self.model.__name__} with name {name}: {str(e)}"
                )
