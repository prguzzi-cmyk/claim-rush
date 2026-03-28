#!/usr/bin/env python

"""Role Dependencies"""

from typing import Annotated

from fastapi import Depends

from app.api.deps import get_current_user
from app.core.auth.enums import RoleEnum
from app.core.log import logger
from app.core.rbac import Roles
from app.exceptions import ForbiddenError
from app.models import User


class RoleChecker:
    """Role checker class for dependency to confirm the user has
    the required role to perform a task."""

    def __init__(self, allowed_roles: list[str]):
        """
        Initialize Role Checker class with allowed roles.

        Parameters
        ----------
        allowed_roles : list
            A list of allowed roles to perform a task.
        """
        self.allowed_roles = allowed_roles

    def __call__(self, user: Annotated[User, Depends(get_current_user)]) -> None:
        """
        Checks if the user has the required role.

        Parameters
        ----------
        user : User
            An User model object
        """
        if user.role.name not in self.allowed_roles:
            logger.error(
                f"{user.email} with role {user.role.name} not in {self.allowed_roles}"
            )

            raise ForbiddenError(message="You are not allowed to access this resource.")


def at_least_admin_user() -> RoleChecker:
    """
    Super Admin or Admin role is required.

    Returns
    -------
    RoleChecker
        A RoleChecker callable
    """
    return RoleChecker([RoleEnum.SUPER_ADMIN.value, Roles.ADMIN.value])


def must_be_superuser() -> RoleChecker:
    """
    Super Admin role is required.

    Returns
    -------
    RoleChecker
        A RoleChecker callable
    """
    return RoleChecker([RoleEnum.SUPER_ADMIN.value])


def must_be_admin_user() -> RoleChecker:
    """
    Admin role is required.

    Returns
    -------
    RoleChecker
        A RoleChecker callable
    """
    return RoleChecker([RoleEnum.ADMIN.value])
