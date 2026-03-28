#!/usr/bin/env python

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi_pagination import Page

from app.core.auth.enums import (
    RoleEnum,
    ModuleEnum,
    MiscOperationEnum,
    PolicyEffectEnum,
)
from app.core.log import logger
from app.models import Permission, User, UserPolicy
from app.repositories import PermissionRepository
from app.schemas import (
    PermissionCreate,
    PermissionCreateRepository,
    PermissionMinimal,
)
from app.services import BaseService
from app.utils.common import generate_permission, degenerate_permission
from app.utils.exceptions import (
    EntityAlreadyExistsError,
    DatabaseOperationError,
    RepositoryError,
    ProtectedEntityError,
    EntityNotFoundError,
)

if TYPE_CHECKING:
    from app.service_locator import AppServiceLocator


class PermissionService(BaseService[Permission, PermissionRepository]):
    """Service layer for managing permissions."""

    def __init__(
        self,
        permission_repository: PermissionRepository,
        service_locator: "AppServiceLocator" = None,
    ):
        """
        Initializes the PermissionService with a permission repository.

        Parameters
        ----------
        permission_repository : PermissionRepository
            The repository instance to use for permission data operations.
        service_locator : AppServiceLocator
            The service locator for accessing other services.
        """
        super().__init__(permission_repository)
        self.service_locator = service_locator

    # @staticmethod
    # def is_protected_permission(display_name: str) -> bool:
    #     """
    #     Determines if the provided display name corresponds to a system-defined permission.
    #
    #     Parameters
    #     ----------
    #     display_name : str
    #         The display name of the permission to be checked.
    #
    #     Returns
    #     -------
    #     bool
    #         True if the display name matches a system-defined permission, otherwise False.
    #     """
    #     return (
    #         True
    #         if display_name in [permission.value for permission in Permissions]
    #         else False
    #     )

    def get_all_permissions(self) -> Page:
        """
        Retrieves all permission entities from the database.

        Returns
        -------
        Page
            A paginated list of all permissions available in the system.

        Raises
        ------
        RepositoryError
            If there is an issue retrieving the permissions from the database.
        """
        try:
            return self.repository.get_all()
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue getting all permission entities from the database."
            )

    def get_permission_by_id(
        self,
        permission_id: UUID,
        even_removed: bool | None = None,
    ) -> Permission:
        """
        Retrieves a permission entity from the database by its unique ID.

        Parameters
        ----------
        permission_id : UUID
            The unique ID of the permission to retrieve.
        even_removed :
            If True, retrieves the permission even if it has been marked as removed.
            If False, retrieves only non-removed permissions.

        Returns
        -------
        Permission
            The permission entity corresponding to the provided ID.

        Raises
        ------
        EntityNotFoundError
            When a permission entity is not found in the database.
        RepositoryError
            If there is an issue retrieving the permission from the database.
        """
        try:
            permission_entity: Permission | None = self.repository.get(
                entity_id=permission_id, even_removed=even_removed
            )

            if permission_entity is None:
                raise EntityNotFoundError(
                    f"Permission with `{permission_id}` ID doesn't exist."
                )

            return permission_entity
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue getting a permission entity from the database."
            )

    def retrieve_permissions_by_ids(self, permissions: list[UUID]) -> list[Permission]:
        """
        Retrieves a list of permission entities by their unique IDs.

        Parameters
        ----------
        permissions: list[UUID]
            A list of unique IDs representing the permissions to retrieve.

        Returns
        -------
        list[Permission]
            A list of permission entities that match the provided IDs.
        """
        permission_entities = []

        for permission_id in permissions:
            permission_entities.append(
                self.get_permission_by_id(permission_id=permission_id)
            )

        return permission_entities

    def get_permission_by_name_or_create(self, name: str) -> Permission:
        """
        Retrieves a permission by its name, or creates it if it does not exist.

        Parameters
        ----------
        name : str
            The name of the permission which is being retrieved or created.

        Returns
        -------
        Permission
            The permission entity that was retrieved or created.

        Raises
        ------
        RepositoryError
            If there is an issue retrieving or creating the permission entity.
        """
        try:
            module, operation = degenerate_permission(name)

            # Attempt to retrieve the permission by name
            permission_entity = self.repository.get_permission_by_name(name)

            # If the permission does not exist, create it
            if not permission_entity:
                permission_schema = PermissionCreateRepository(
                    module=module, operation=operation, name=name
                )
                permission_entity = self.repository.create(permission_schema)

            return permission_entity

        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue getting or creating a permission entity."
            )

    def create_permission(self, permission_schema: PermissionCreate) -> Permission:
        """
        Creates a new permission entity in the database.

        Parameters
        ----------
        permission_schema : PermissionCreate
            The schema of the permission to create.

        Returns
        -------
        Permission
            The created permission entity.

        Raises
        ------
        EntityAlreadyExistsError
            If the permission entity already exists.
        RepositoryError
            If there is an issue creating the permission entity.
        """
        permission_schema_repository = PermissionCreateRepository(
            **permission_schema.dict(),
            name=generate_permission(
                permission_schema.module, permission_schema.operation
            ),
        )

        if self.repository.get_permission_by_name(permission_schema_repository.name):
            raise EntityAlreadyExistsError(
                f"Permission {permission_schema_repository.name} already exists."
            )

        try:
            return self.repository.create(permission_schema_repository)
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue saving the permission to the database."
            )

    # def update_permission(
    #     self,
    #     permission_id: UUID,
    #     permission_schema: PermissionUpdate,
    # ) -> Permission:
    #     """
    #     Updates an existing permission entity in the database.
    #
    #     Parameters
    #     ----------
    #     permission_id : UUID
    #         The unique ID of the permission to update.
    #     permission_schema : PermissionUpdate
    #         The schema of the permission to update.
    #
    #     Returns
    #     -------
    #     Permission
    #         The updated permission entity.
    #
    #     Raises
    #     ------
    #     EntityNotFoundError
    #         When a permission entity is not found in the database.
    #     ProtectedEntityError
    #         When attempting to edit a permission entity that is system-defined.
    #     RepositoryError
    #         If there is an issue saving the permission entity.
    #     """
    #     permission_entity: Permission | None = self.repository.get(
    #         entity_id=permission_id
    #     )
    #
    #     if permission_entity is None:
    #         raise EntityNotFoundError(
    #             f"Permission with `{permission_id}` ID doesn't exist.")
    #

    # if self.is_protected_permission(permission_entity.display_name):
    #     raise ProtectedEntityError(
    #         "You can't update the default application permission."
    #     )

    # permission_schema_dict = permission_schema.dict(exclude_none=True)
    # if permission_schema.display_name:
    #     permission_schema_dict["name"] = slugify(permission_schema.display_name)

    # permission_schema_repository = PermissionUpdateRepository(
    #     **permission_schema_dict
    # )
    #
    # try:
    #     return self.repository.update(
    #         db_entity=permission_entity,
    #         entity=permission_schema_repository,
    #     )
    # except DatabaseOperationError as e:
    #     logger.error(str(e))
    #     raise RepositoryError(
    #         "There was an issue saving the permission to the database."
    #     )

    def soft_remove_permission(self, permission_id: UUID) -> None:
        """
        Softly removes a permission entity by marking it as removed in the database.

        Parameters
        ----------
        permission_id : UUID
            The unique ID of the permission to soft remove.

        Raises
        ------
        EntityNotFoundError
            When a permission entity is not found in the database.
        ProtectedEntityError
            When attempting to soft remove a permission entity that is system-defined or locked.
        RepositoryError
            If there is an issue soft removing the permission entity.
        """
        permission_entity: Permission | None = self.repository.get(
            entity_id=permission_id
        )
        if permission_entity is None:
            raise EntityNotFoundError(
                f"Permission with `{permission_id}` ID doesn't exist."
            )

        # if self.is_protected_permission(permission_entity.name):
        #     raise ProtectedEntityError(
        #         "You can't softly remove the default application permission."
        #     )

        if not self.is_removable_entity(permission_entity):
            raise ProtectedEntityError("You can't softly remove the locked permission.")

        try:
            return self.repository.soft_remove(permission_entity)
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue softly removing the permission from the database."
            )

    @staticmethod
    def has_admin_privileges(user_entity: User) -> bool:
        """
        Checks whether a user has administrator privileges.

        This method evaluates the roles assigned to the user and determines
        if they have administrative-level permissions (i.e., Admin or Super Admin).

        Parameters
        ----------
        user_entity : User
            A User model instance.

        Returns
        -------
        bool
            True if the user has administrative privileges, False otherwise.
        """
        # Ensure the user has a role assigned before checking
        if not user_entity.role:
            return False

        # List of roles considered to have admin privileges
        admin_roles = {RoleEnum.ADMIN.value, RoleEnum.SUPER_ADMIN.value}

        # Check if the user's role is one of the administrative roles
        return user_entity.role.name in admin_roles

    def get_user_permissions(self, user_entity: User) -> dict[str, PermissionMinimal]:
        """
        Fetch assigned permissions for the user from the role and policies.

        Parameters
        ----------
        user_entity : User
            A User model instance.

        Returns
        -------
        dict[str, PermissionMinimal]
            A dictionary of the user's permissions with possible overrides from policies.
        """
        user_policy_service = self.service_locator.get_user_policy_service()
        final_permissions = {}

        # Get associated permissions from the user's role
        for perm_obj in user_entity.role.permissions:
            final_permissions[perm_obj.name] = PermissionMinimal(**perm_obj.__dict__)

        # Get associated permissions from the user's policy (if any)
        user_policy_entity: UserPolicy = user_policy_service.get_by_user_id(
            user_entity.id
        )

        if user_policy_entity and user_policy_entity.permissions:
            for policy_permission in user_policy_entity.permissions:
                permission_name = policy_permission.permission.name
                permission_effect = policy_permission.effect

                # If permission exists, update its effect; otherwise, add it.
                if permission_name in final_permissions:
                    final_permissions[permission_name].effect = permission_effect
                else:
                    final_permissions[permission_name] = PermissionMinimal(
                        **policy_permission.permission.__dict__,
                        effect=permission_effect,
                    )

        # Return the permissions
        return final_permissions

    def has_user_lead_assign_permission(self, user_entity: User) -> bool:
        """
        Checks if the user has permission to assign leads.

        Parameters
        ----------
        user_entity : User
            The user entity object.

        Returns
        -------
        bool
            True if the user has the lead assign permission, and it's not denied, False otherwise.
        """
        # Generate a permission name for assign a lead
        lead_assign_permission = generate_permission(
            ModuleEnum.LEAD.value, MiscOperationEnum.ASSIGN_LEAD.value
        )

        # Fetch the specific permission for lead assignment
        user_permissions = self.get_user_permissions(user_entity)
        assigned_lead_assign_permission = user_permissions.get(lead_assign_permission)

        # Return true if the permission is found and it is not denied
        return (
            assigned_lead_assign_permission
            and assigned_lead_assign_permission.effect != PolicyEffectEnum.DENY
        )
