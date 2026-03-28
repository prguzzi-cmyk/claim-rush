#!/usr/bin/env python

"""Role Dependencies"""

from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.log import logger
from app.core.rbac import Roles
from app.models import User
from app.utils.common import slugify


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
            User model object
        """
        if user.role.name not in self.allowed_roles:
            logger.debug(
                f"{user.email} with role {user.role.name} not in {self.allowed_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Operation not permitted"
            )


def at_least_admin_user() -> RoleChecker:
    """
    Super Admin or Admin role is required.

    Returns
    -------
    RoleChecker
        RoleChecker callable
    """
    return RoleChecker([slugify(Roles.SUPER_ADMIN.value), slugify(Roles.ADMIN.value)])


def must_be_superuser() -> RoleChecker:
    """
    Super Admin role is required.

    Returns
    -------
    RoleChecker
        RoleChecker callable
    """
    return RoleChecker(
        [
            slugify(Roles.SUPER_ADMIN.value),
        ]
    )


def must_be_admin_user() -> RoleChecker:
    """
    Admin role is required.

    Returns
    -------
    RoleChecker
        RoleChecker callable
    """
    return RoleChecker(
        [
            slugify(Roles.SUPER_ADMIN.value),
        ]
    )
