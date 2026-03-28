#!/usr/bin/env python

from app.core.auth import RolePermissions
from app.core.auth.enums import RoleEnum
from app.core.log import logger
from app.schemas import AppendPermissions
from app.services import BaseSyncService, RoleService, PermissionService
from app.utils.common import generate_permission
from app.utils.exceptions import RepositoryError, EntityNotFoundError


class RoleAndPermissionSyncService(BaseSyncService):
    """
    Service for synchronizing roles and permission with the database.

    This service ensures that roles and their associated permissions, as defined in the code,
    are consistent with what is stored in the database.

    Attributes
    ----------
    role_service : RoleService
            The service for handling role-related operations.
    permission_service : PermissionService
        The service for handling permission-related operations.

    Methods
    -------
    sync()
        Synchronize roles and permission with the database.
    """

    def __init__(
        self, role_service: RoleService, permission_service: PermissionService
    ):
        """
        Initializes the RoleAndPermissionSyncService with their services.

        Parameters
        ----------
        role_service : RoleService
            The service for handling role-related operations.
        permission_service : PermissionService
            The service for handling permission-related operations.
        """
        self.role_service = role_service
        self.permission_service = permission_service

    def synchronize_roles_and_permissions(
        self, role: RoleEnum | None = None, overwrite: bool = False
    ):
        """
        Synchronizes predefined roles and their associated permissions with the database.

        This method checks if predefined roles and their respective permissions exist in the database.
        If any role or permission is missing, it is created and associated accordingly. The method
        ensures that all expected roles and permissions are present.

        Notes
        -----
        - By default, this method does not assign any new module permissions to roles that already
          have permissions assigned unless the `overwrite` parameter is set to `True`.
        - If a specific `role` is provided, only that role's permissions are synchronized.
        - If `overwrite` is `True`, it will replace existing permissions with the predefined ones for
          the specified role or all roles if no specific role is provided.

        Parameters
        ----------
        role : RoleEnum | None
            The specific role to synchronize. If `None`, all roles are synchronized. Default is `None`.
        overwrite : bool, optional
            If `True`, the method will replace existing role permissions with the predefined ones.
            If `False`, the method will only add permissions to roles that currently have None.
            Default is `False`.

        Raises
        ------
        RepositoryError
            If there is an issue with retrieving or creating roles or permissions in the database.
        """
        expected_roles_permissions = RolePermissions.role_permissions

        # Determine which roles to synchronize
        roles_to_sync = [role] if role else expected_roles_permissions.keys()

        for role in roles_to_sync:
            try:
                role_entity = self.role_service.get_role_by_name_or_create(
                    name=role.value
                )

                permission_ids = []
                for module, operations in expected_roles_permissions[role].items():
                    for operation in operations:
                        # Generate permission name and retrieve or create the permission entity
                        permission_name = generate_permission(
                            module.value, operation.value
                        )
                        permission_entity = (
                            self.permission_service.get_permission_by_name_or_create(
                                permission_name
                            )
                        )
                        permission_ids.append(permission_entity.id)

                # Append permissions if the role has None, or overwrite them if `overwrite` is True
                if overwrite or len(role_entity.permissions) == 0:
                    permissions = AppendPermissions(permissions=permission_ids)
                    self.role_service.append_permissions(role_entity.id, permissions)
            except (RepositoryError, EntityNotFoundError) as e:
                logger.error(f"Error syncing role '{role.value}': {str(e)}")
                raise RepositoryError(
                    "There was issue synchronizing system roles and permissions."
                )

    def sync(self):
        """
        Synchronize roles and permissions with the database.

        This method checks for the existence of predefined roles and their respective permissions in the database.
        If any role or associated permissions does not exist, it is created and associated accordingly.
        """

        # Synchronize All Roles without overwriting
        self.synchronize_roles_and_permissions()
