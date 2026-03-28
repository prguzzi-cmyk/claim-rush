#!/usr/bin/env python

from fastapi_pagination import Page, paginate
from fastapi_pagination.utils import disable_installed_extensions_check
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Role, Permission
from app.repositories import BaseRepository
from app.schemas import RoleCreateRepository, RoleUpdateRepository
from app.utils.exceptions import DatabaseOperationError


class RoleRepository(BaseRepository[Role, RoleCreateRepository, RoleUpdateRepository]):
    """
    Repository for managing Role entities in the database.

    Attributes
    ----------
    db_session : Session
        The database session used for accessing role data.
    """

    def __init__(self, db_session: Session):
        """
        Initializes the RoleRepository with the given database session.

        Parameters
        ----------
        db_session : Session
            The database session used for accessing role data.
        """
        super().__init__(db_session, Role)

    def get_role_by_name(self, name: str) -> Role | None:
        """
        Retrieves a role by its name.

        Parameters
        ----------
        name : str
            The name of the role to retrieve.

        Returns
        -------
        Role | None
            The role entity if found, otherwise None.

        Raises
        ------
        DatabaseOperationError
            If there is an issue retrieving entity.
        """
        with self.db_session as session:
            try:
                stmt = select(Role).where(Role.name == name)
                return session.scalar(stmt)
            except SQLAlchemyError as e:
                raise DatabaseOperationError(
                    f"Failed to retrieve {self.model.__name__} with name {name}: {str(e)}"
                )

    @staticmethod
    def get_permissions_for_role(
        role_obj: Role,
        paginated: bool = True,
    ) -> Page | list[Permission] | None:
        """
        Retrieves the permissions associated with a given role.

        Parameters
        ----------
        role_obj : Role
            The role object for which to retrieve permissions.
        paginated : bool
            If True, returns a paginated list of permissions. If False, returns a full list.
            Default is True.

        Returns
        -------
        Page | list[Permission] | None
            - If `paginated` is True, returns a `Page` object containing the paginated permissions.
            - If `paginated` is False, returns a list of `Permission` objects.
            - Returns None if the role has no associated permissions.
        """
        try:
            disable_installed_extensions_check()

            if paginated:
                return paginate(role_obj.permissions)
            else:
                return role_obj.permissions
        except SQLAlchemyError as e:
            raise DatabaseOperationError(
                f"Failed to retrieve permissions for `{role_obj.display_name}`: {str(e)}"
            )

    def append_permissions(self, role: Role, permissions: list[Permission]) -> None:
        """
        Appends a list of permissions to the specified role.

        Parameters
        ----------
        role : Role
            The role entity to which permissions will be appended.
        permissions : list[Permission]
            A list of permission entities to be associated with the role.

        Raises
        ------
        DatabaseOperationError
            If there is an error during the database operation, an exception is raised detailing
            the issue.
        """
        with self.db_session as session:
            try:
                # Ensure the role entity is attached to the current session
                if role not in session:
                    role = session.merge(role)

                # Append each permission to the role, merging if necessary
                for permission in permissions:
                    if permission not in session:
                        permission = session.merge(permission)
                    role.permissions.append(permission)

                # Commit the transaction to the database
                session.commit()
            except SQLAlchemyError as e:
                raise DatabaseOperationError(
                    f"Failed to append permissions {self.model.__name__}: {str(e)}"
                )

    def detach_permissions(self, role: Role, permissions: list[Permission]) -> None:
        """
        Detach a list of permissions from the specified role.

        Parameters
        ----------
        role : Role
            The role entity to which permissions will be detached.
        permissions : list[Permission]
            A list of permission entities to be de-associated with the role.

        Raises
        ------
        DatabaseOperationError
            If there is an error during the database operation, an exception is raised detailing
            the issue.
        """
        with self.db_session as session:
            try:
                # Ensure the role entity is attached to the current session
                if role not in session:
                    role = session.merge(role)

                # Detach each permission from the role, merging if necessary
                for permission in permissions:
                    if permission in role.permissions:
                        if permission not in session:
                            permission = session.merge(permission)
                        role.permissions.remove(permission)

                # Commit the transaction to the database
                session.commit()
            except SQLAlchemyError as e:
                raise DatabaseOperationError(
                    f"Failed to detach permissions {self.model.__name__}: {str(e)}"
                )
