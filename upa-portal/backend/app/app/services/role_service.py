#!/usr/bin/env python

from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi_pagination import Page

from app.core.auth.enums import RoleEnum
from app.core.log import logger
from app.core.rbac import Roles
from app.exceptions.service_exceptions import InvalidRestoreOperationError
from app.models import Role
from app.repositories import RoleRepository
from app.schemas import (
    RoleCreate,
    RoleCreateRepository,
    RoleUpdate,
    RoleUpdateRepository,
    AppendPermissions,
    DetachPermissions,
)
from app.services import BaseService
from app.utils.common import slugify, slug_to_capital_case
from app.exceptions import (
    EntityNotFoundError,
    DatabaseOperationError,
    RepositoryError,
    EntityAlreadyExistsError,
    ProtectedEntityError,
)

if TYPE_CHECKING:
    from app.service_locator import AppServiceLocator


class RoleService(BaseService[Role, RoleRepository]):
    """Service layer for managing roles."""

    def __init__(
        self,
        role_repository: RoleRepository,
        service_locator: "AppServiceLocator" = None,
    ):
        """
        Initializes the RoleService with a role repository.

        Parameters
        ----------
        role_repository : RoleRepository
            The repository instance to use for role data operations.
        service_locator : AppServiceLocator
            The service locator for accessing other services.
        """
        super().__init__(role_repository)
        self.service_locator = service_locator

    @staticmethod
    def is_protected_role(display_name: str) -> bool:
        """
        Determines if the provided display name corresponds to a system-defined role.

        Parameters
        ----------
        display_name : str
            The display name of the role to be checked.

        Returns
        -------
        bool
            True if the display name matches a system-defined role, otherwise False.
        """
        return True if display_name in [role.value for role in Roles] else False

    def get_all_roles(
        self,
        filters: dict[str, Any] | None,
        sort_by: dict | None,
        only_removed: bool | None,
    ) -> Page:
        """
        Retrieves a paginated list of role entities from the database based on the provided filters, sorting options,
        and whether to include only removed roles (soft-deleted).

        Parameters
        ----------
        filters : dict[str, Any] | None
            A dictionary of filters to apply to the roles. The keys should correspond to the field names, and the values
            represent the filtering criteria. For example, filtering by `name` or `created_by`.
        sort_by : dict
            A dictionary specifying the sorting field and order. The keys should be the field name to sort by, and the
            values should be the sorting order (e.g., `asc` or `desc`).
        only_removed : bool
            A boolean indicating whether to return only soft-deleted roles. If True, only soft-deleted roles will be
            included.
            If False, only active (non-deleted) roles will be included.

        Returns
        -------
        Page
            A paginated list of role entities based on the provided filters and sorting options.

        Raises
        ------
        RepositoryError
            If there is an issue retrieving the roles from the database.
        """
        try:
            return self.repository.get_all(
                only_removed=only_removed,
                filters=filters,
                sort_field=sort_by["sort_field"],
                sort_order=sort_by["sort_order"],
            )
        except DatabaseOperationError as e:
            logger.exception(
                f"Failed to retrieve {self.repository.model.__name__} records: {str(e)}"
            )
            raise RepositoryError(
                "There was an issue getting all role entities from the database."
            )

    def get_role_by_id(
        self,
        role_id: UUID,
        even_removed: bool | None,
    ) -> Role:
        """
        Retrieves a role entity from the database by its unique ID.

        Parameters
        ----------
        role_id : UUID
            The unique ID of the role to retrieve.
        even_removed :
            If True, retrieves the role even if it has been marked as removed.
            If False, retrieves only non-removed roles.

        Returns
        -------
        Role
            The role entity corresponding to the provided ID.

        Raises
        ------
        EntityNotFoundError
            When a role entity is not found in the database.
        RepositoryError
            If there is an issue retrieving the role from the database.
        """
        try:
            role_entity: Role | None = self.repository.get(
                entity_id=role_id, even_removed=even_removed
            )

            if role_entity is None:
                raise EntityNotFoundError(f"Role with `{role_id}` ID doesn't exist.")

            return role_entity
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue getting a role entity from the database."
            )

    def get_role_by_name_or_create(self, name: str) -> Role:
        """
        Retrieves a role by its name, or creates it if it does not exist.

        Parameters
        ----------
        name: str
            The name of the role to retrieve or create.

        Returns
        -------
        Role
            The role entity that was retrieved or created.

        Raises
        ------
        RepositoryError
            If there is an issue retrieving or creating the role entity.
        """
        try:
            # Attempt to retrieve the role by name
            role_entity = self.repository.get_role_by_name(name)

            # If the role does not exist, create it
            if not role_entity:
                role_schema = RoleCreateRepository(
                    display_name=slug_to_capital_case(name), name=name
                )
                role_entity = self.repository.create(role_schema)

            return role_entity

        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue getting or creating a role entity."
            )

    def create_role(self, role_schema: RoleCreate) -> Role:
        """
        Creates a new role entity in the database.

        Parameters
        ----------
        role_schema : RoleCreate
            The schema of the role to create.

        Returns
        -------
        Role
            The created role entity.

        Raises
        ------
        EntityAlreadyExistsError
            If the role entity already exists.
        RepositoryError
            If there is an issue creating the role entity.
        """
        role_schema_repository = RoleCreateRepository(
            **role_schema.dict(), name=slugify(role_schema.display_name)
        )

        if self.repository.get_role_by_name(role_schema_repository.name):
            raise EntityAlreadyExistsError(
                f"Role {role_schema_repository.name} already exists."
            )

        try:
            return self.repository.create(role_schema_repository)
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError("There was an issue saving the role to the database.")

    def update_role(
        self,
        role_id: UUID,
        role_schema: RoleUpdate,
    ) -> Role:
        """
        Updates an existing role entity in the database.

        Parameters
        ----------
        role_id : UUID
            The unique ID of the role to update.
        role_schema : RoleUpdate
            The schema of the role to update.

        Returns
        -------
        Role
            The updated role entity.

        Raises
        ------
        EntityNotFoundError
            When a role entity is not found in the database.
        ProtectedEntityError
            When attempting to edit a role entity that is system-defined.
        RepositoryError
            If there is an issue saving the role entity.
        """
        role_entity: Role | None = self.repository.get(entity_id=role_id)

        if role_entity is None:
            raise EntityNotFoundError(f"Role with `{role_id}` ID doesn't exist.")

        if self.is_protected_role(role_entity.display_name):
            raise ProtectedEntityError("You can't update the default application role.")

        role_schema_dict = role_schema.dict(exclude_none=True)
        if role_schema.display_name:
            role_schema_dict["name"] = slugify(role_schema.display_name)

        role_schema_repository = RoleUpdateRepository(**role_schema_dict)

        try:
            return self.repository.update(
                db_entity=role_entity,
                entity=role_schema_repository,
            )
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError("There was an issue saving the role to the database.")

    def get_permissions_for_role_paginated(
        self,
        role_id: UUID,
    ) -> Page | None:
        """
        Retrieves a paginated list of permissions associated with a given role.

        Parameters
        ----------
        role_id : UUID
            The unique ID of the role to fetch permissions.

        Returns
        -------
        Page | None
            If found, a paginated list of permissions for the specified role, otherwise None.

        Raises
        ------
        EntityNotFoundError
            When a role entity is not found in the database.
        RepositoryError
            If there is an issue getting permissions of the role entity.
        """
        role: Role = self.repository.get(entity_id=role_id)
        if not role:
            raise EntityNotFoundError(f"Role with `{role_id}` ID doesn't exist.")

        try:
            return self.repository.get_permissions_for_role(role_obj=role)
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue retrieving the role permissions from the database."
            )

    def soft_remove_role(self, role_id: UUID) -> None:
        """
        Softly removes a role entity by marking it as removed in the database.

        Parameters
        ----------
        role_id : UUID
            The unique ID of the role to soft remove.

        Raises
        ------
        EntityNotFoundError
            When a role entity is not found in the database.
        ProtectedEntityError
            When attempting to soft remove a role entity that is system-defined or locked.
        RepositoryError
            If there is an issue soft removing the role entity.
        """
        role_entity: Role | None = self.repository.get(entity_id=role_id)
        if role_entity is None:
            raise EntityNotFoundError(f"Role with `{role_id}` ID doesn't exist.")

        if self.is_protected_role(role_entity.display_name):
            raise ProtectedEntityError(
                "You can't softly remove the default application role."
            )

        if not self.is_removable_entity(role_entity):
            raise ProtectedEntityError("You can't softly remove the locked role.")

        try:
            self.repository.soft_remove(role_entity)
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue softly removing the role from the database."
            )

    def restore_role(self, role_id: UUID) -> None:
        """
        Restores a soft-removed role entity by marking it as active in the database.

        Parameters
        ----------
        role_id : UUID
            The unique ID of the role to restore.

        Raises
        ------
        EntityNotFoundError
            When a role entity is not found in the database.
        InvalidRestoreOperationError
            If the role is not soft removed and therefore cannot be restored.
        RepositoryError
            If there is an issue restoring the role entity.
        """
        role_entity: Role | None = self.repository.get(
            entity_id=role_id, even_removed=True
        )
        if role_entity is None:
            raise EntityNotFoundError(f"Role with `{role_id}` ID doesn't exist.")

        if not self.is_removed_entity(role_entity):
            raise InvalidRestoreOperationError(
                f"Role with `{role_id}` cannot be restored as it has not been softly removed."
            )

        try:
            self.repository.restore(role_entity)
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue restoring the role from the database."
            )

    def append_permissions(
        self, role_id: UUID, permissions_ids: AppendPermissions
    ) -> None:
        """
        Appends a list of permissions to the specified role by their IDs.

        Parameters
        ----------
        role_id : UUID
            The unique identifier of the role to which permissions will be appended.
        permissions_ids : AppendPermissions
            A list of unique identifiers corresponding to the permissions that should be associated
            with the role.

        Raises
        ------
        EntityNotFoundError
            If the role with the given `role_id` does not exist in the database.
        RepositoryError
            If there is an issue appending the permissions to the role in the repository.
        """
        # Retrieve the role entity from the repository by ID
        role_entity: Role | None = self.repository.get(entity_id=role_id)
        if role_entity is None:
            raise EntityNotFoundError(f"Role with `{role_id}` ID doesn't exist.")

        try:
            # Retrieve the permission service from the service locator and permission entities by their IDs
            permission_service = self.service_locator.get_permission_service()
            permission_entities = permission_service.retrieve_permissions_by_ids(
                permissions_ids.permissions
            )

            # Append the retrieved permissions to the role entity
            self.repository.append_permissions(role_entity, permission_entities)
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue appending permissions to the role."
            )

    def detach_permissions(
        self, role_id: UUID, permissions_ids: DetachPermissions
    ) -> None:
        """
        Detaches a list of permissions to the specified role by their IDs.

        Parameters
        ----------
        role_id : UUID
            The unique identifier of the role from which permissions will be detached.
        permissions_ids : DetachPermissions
            A list of unique identifiers corresponding to the permissions that should be de-associated
            from the role.

        Raises
        ------
        EntityNotFoundError
            If the role with the given `role_id` does not exist in the database.
        RepositoryError
            If there is an issue detaching the permissions from the role in the repository.
        """
        # Retrieve the role entity from the repository by ID
        role_entity: Role | None = self.repository.get(entity_id=role_id)
        if role_entity is None:
            raise EntityNotFoundError(f"Role with `{role_id}` ID doesn't exist.")

        try:
            # Retrieve the permission service from the service locator and permission entities by their IDs
            permission_service = self.service_locator.get_permission_service()
            permission_entities = permission_service.retrieve_permissions_by_ids(
                permissions_ids.permissions
            )

            # Detach the retrieved permissions from the role entity
            self.repository.detach_permissions(role_entity, permission_entities)
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue detaching permissions from the role."
            )

    @staticmethod
    def has_role_admin_privileges(role_name: str) -> bool:
        """
        Check if the role has admin privileges (either Super Admin or Admin)

        Parameters
        ----------
        role_name : str
            The role to check for admin privileges.

        Returns
        -------
        bool
            True if the role has admin privileges, False otherwise.
        """
        return role_name in [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN]
