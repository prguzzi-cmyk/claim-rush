#!/usr/bin/env python

from enum import Enum


class Operations(Enum):
    """Basic operations for RBAC"""

    READ = "read"
    CREATE = "create"
    UPDATE = "update"
    REMOVE = "remove"
    READ_REMOVED = "read_removed"
    RESTORE = "restore"


class MiscOperations(Enum):
    """Miscellaneous operations for RBAC"""

    RUN = "run"
    ASSIGN_PERMISSION = "assign_permission"


class Modules(Enum):
    """Modules name of the application"""

    UTIL = "util"
    PERMISSION = "permission"
    ROLE = "role"
    USER = "user"
    PROFILE = "profile"
    LEAD = "lead"

    @classmethod
    def get_with_operations(cls) -> dict[str, list]:
        """
        Assign permissions to the modules.

        Returns
        -------
        dict
            Returns a dictionary consists of modules with their permissions
        """
        return {
            cls.UTIL.value: [
                MiscOperations.RUN.value,
            ],
            cls.PERMISSION.value: [op.value for op in Operations],
            cls.ROLE.value: [op.value for op in Operations]
            + [
                MiscOperations.ASSIGN_PERMISSION.value,
            ],
            cls.USER.value: [op.value for op in Operations],
            cls.PROFILE.value: [
                Operations.READ.value,
                Operations.UPDATE.value,
            ],
            cls.LEAD.value: [op.value for op in Operations],
        }


class Roles(Enum):
    """Roles in the application"""

    SUPER_ADMIN = "Super Admin"
    ADMIN = "Admin"
    AGENT = "Agent"

    @classmethod
    def get_with_permissions(cls, permissions: dict[str, list]) -> dict[str, list]:
        """
        Combine permissions with roles.

        Parameters
        ----------
        permissions : dict
            A dictionary consists of module-wise permission objects

        Returns
        -------
        dict
            Returns a dictionary consists of permissions and roles.
        """
        return {
            # Super Admin permissions
            cls.SUPER_ADMIN.value: permissions[Modules.UTIL.value]
            + permissions[Modules.PERMISSION.value]
            + permissions[Modules.ROLE.value]
            + permissions[Modules.USER.value]
            + permissions[Modules.PROFILE.value]
            + permissions[Modules.LEAD.value],
            # Admin permissions
            cls.ADMIN.value: permissions[Modules.USER.value]
            + permissions[Modules.PROFILE.value]
            + permissions[Modules.LEAD.value],
            # Agent permissions
            cls.AGENT.value: permissions[Modules.PROFILE.value]
            + permissions[Modules.LEAD.value],
        }
