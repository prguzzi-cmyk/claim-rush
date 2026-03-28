#!/usr/bin/env python

"""Utility functions for the application user"""

from app.core.config import settings
from app.core.rbac import Roles


def get_sys_users() -> dict[str, dict]:
    """
    Generate system default users with the help of environment variables.

    Returns
    -------
    dict
        A dictionary consists of system default users by their roles.
    """
    return {
        Roles.SUPER_ADMIN.value: {
            "first_name": settings.SYS_SU_FIRST_NAME,
            "last_name": settings.SYS_SU_LAST_NAME,
            "email": settings.SYS_SU_EMAIL,
            "password": settings.SYS_SU_PASSWORD,
            "role_id": "",
        },
        Roles.ADMIN.value: {
            "first_name": settings.SYS_AD_FIRST_NAME,
            "last_name": settings.SYS_AD_LAST_NAME,
            "email": settings.SYS_AD_EMAIL,
            "password": settings.SYS_AD_PASSWORD,
            "role_id": "",
        },
        Roles.AGENT.value: {
            "first_name": settings.SYS_AG_FIRST_NAME,
            "last_name": settings.SYS_AG_LAST_NAME,
            "email": settings.SYS_AG_EMAIL,
            "password": settings.SYS_AG_PASSWORD,
            "role_id": "",
        },
    }
