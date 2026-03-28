#!/usr/bin/env python

from abc import ABC, abstractmethod
from typing import Annotated, TypeVar, Generic

from fastapi import Depends

from app.api.deps import get_current_user
from app.core.rbac import MiscOperations, Operations
from app.models import User
from app.utils.common import generate_permission


class AbstractPermissionChecker(ABC):
    """Abstract Base class for Permission Checker."""

    def __init__(self, required_permissions: list[str]) -> None:
        self._required_permissions = required_permissions

    @abstractmethod
    def __call__(self, user: Annotated[User, Depends(get_current_user)]) -> None:
        pass


# Define Base checker type var
PermissionCheckerType = TypeVar(
    "PermissionCheckerType", bound=AbstractPermissionChecker
)


class BasePermissions(Generic[PermissionCheckerType]):
    """Abstract Base class for Permissions."""

    def __init__(self, module: str) -> None:
        """
        Module specific permission checker generator for different operations.

        Parameters
        ----------
        module : str
            Name of the module
        """
        self.module = module

    def get_permission_dependency(self, operation: str) -> PermissionCheckerType:
        """
        Generate permission dependency for a specific module and operation.

        Parameters
        ----------
        operation : str
            Operation name

        Returns
        -------
        PermissionCheckerType
            Permission checker callable.
        """
        return PermissionCheckerType([generate_permission(self.module, operation)])

    def read(self) -> PermissionCheckerType:
        """
        Permission checker for a read operation.

        Returns
        -------
        PermissionCheckerType
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.READ.value)

    def read_removed(self) -> PermissionCheckerType:
        """
        Permission checker for a read-removed operation.

        Returns
        -------
        PermissionCheckerType
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.READ_REMOVED.value)

    def create(self) -> PermissionCheckerType:
        """
        Permission checker for a create operation.

        Returns
        -------
        PermissionCheckerType
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.CREATE.value)

    def update(self) -> PermissionCheckerType:
        """
        Permission checker for an update operation.

        Returns
        -------
        PermissionCheckerType
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.UPDATE.value)

    def remove(self) -> PermissionCheckerType:
        """
        Permission checker for a remove operation.

        Returns
        -------
        PermissionCheckerType
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.REMOVE.value)

    def restore(self) -> PermissionCheckerType:
        """
        Permission checker for a restore operation.

        Returns
        -------
        PermissionCheckerType
            Permission checker callable
        """
        return self.get_permission_dependency(Operations.RESTORE.value)

    def run(self) -> PermissionCheckerType:
        """
        Permission checker for a run operation.

        Returns
        -------
        PermissionCheckerType
            Permission checker callable
        """
        return self.get_permission_dependency(MiscOperations.RUN.value)

    def assign_permission(self) -> PermissionCheckerType:
        """
        Permission checker for an assign permission operation.

        Returns
        -------
        PermissionCheckerType
            Permission checker callable
        """
        return self.get_permission_dependency(MiscOperations.ASSIGN_PERMISSION.value)
