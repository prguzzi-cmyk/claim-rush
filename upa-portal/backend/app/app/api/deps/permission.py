#!/usr/bin/env python

"""Permission Dependencies"""

from typing import Annotated

from fastapi import Depends, HTTPException, status

from app import crud
from app.api.deps import get_current_user
from app.core.enums import PolicyEffect
from app.core.log import logger
from app.core.rbac import MiscOperations, Operations
from app.models import User
from app.utils.common import generate_permission


class PermissionChecker:
    """Permission checker class for dependency to confirm the user has
    the required permission/s to perform a task."""

    def __init__(self, required_permissions: list[str]) -> None:
        """
        Initialize Permission Checker class with required permissions.

        Parameters
        ----------
        required_permissions : list
            A list of required permissions to perform a task.
        """
        self.required_permissions = required_permissions

    def __call__(self, user: Annotated[User, Depends(get_current_user)]) -> None:
        """
        Checks if the user has the required permissions.

        Parameters
        ----------
        user : User
            A User model object
        """
        user_permissions = crud.permission.get_user_permissions(user=user)

        for permission in self.required_permissions:
            is_allowed = next(
                (
                    user_perm
                    for user_perm in user_permissions
                    if user_perm.name == permission
                    and user_perm.effect != PolicyEffect.DENY.value
                ),
                False,
            )
            if not is_allowed:
                logger.debug(
                    f"{user.email} with role {user.role.name} "
                    f"has no permission/s {self.required_permissions}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Operation not permitted",
                )


class Permissions:
    def __init__(self, module: str) -> None:
        """
        Module specific permission checker generator for different operations.

        Parameters
        ----------
        module : str
            Name of the module
        """
        self.module = module

    def get_permission_dependency(self, operation: str) -> PermissionChecker:
        """
        Generate permission dependency for a specific module and operation.

        Parameters
        ----------
        operation : str
            Operation name

        Returns
        -------
        PermissionChecker
            Permission checker callable.
        """
        return PermissionChecker([generate_permission(self.module, operation)])

    def read(self) -> PermissionChecker:
        """
        Permission checker for a read operation.

        Returns
        -------
        PermissionChecker
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.READ.value)

    def read_removed(self) -> PermissionChecker:
        """
        Permission checker for a read-removed operation.

        Returns
        -------
        PermissionChecker
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.READ_REMOVED.value)

    def create(self) -> PermissionChecker:
        """
        Permission checker for a create operation.

        Returns
        -------
        PermissionChecker
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.CREATE.value)

    def update(self) -> PermissionChecker:
        """
        Permission checker for an update operation.

        Returns
        -------
        PermissionChecker
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.UPDATE.value)

    def remove(self) -> PermissionChecker:
        """
        Permission checker for a remove operation.

        Returns
        -------
        PermissionChecker
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.REMOVE.value)

    def restore(self) -> PermissionChecker:
        """
        Permission checker for a restore operation.

        Returns
        -------
        PermissionChecker
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.RESTORE.value)

    def run(self) -> PermissionChecker:
        """
        Permission checker for a run operation.

        Returns
        -------
        PermissionChecker
            Permission checker callable
        """
        return self.get_permission_dependency(MiscOperations.RUN.value)

    def assign_permission(self) -> PermissionChecker:
        """
        Permission checker for an assign permission operation.

        Returns
        -------
        PermissionChecker
            Permission checker callable
        """
        return self.get_permission_dependency(MiscOperations.ASSIGN_PERMISSION.value)
