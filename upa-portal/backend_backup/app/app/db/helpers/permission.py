#!/usr/bin/env python

from sqlalchemy.orm import Session

from app import crud, schemas
from app.utils.common import generate_permission


class Permission:
    """Helper to create required permissions"""

    def __init__(self, modules: dict[str, list]):
        """
        Initialize Permission helper class.

        Parameters
        ----------
        modules : dict
            The dictionary consists of module/s with a list of operation/s.
        """
        self.modules = modules

    def create(self, db_session: Session) -> dict[str, list]:
        """
        Add permissions to the database.

        Parameters
        ----------
        db_session : Session
            Database session

        Returns
        -------
        dict
            The dictionary consists of module/s with a list of permission id/s.
        """
        module_permissions = {}

        for module, operations in self.modules.items():
            permissions = []

            for operation in operations:
                permission_obj = crud.permission.get_by_name(
                    db_session,
                    name=generate_permission(module=module, operation=operation),
                )
                if not permission_obj:
                    permission_in = schemas.PermissionCreate(
                        module=module, operation=operation
                    )
                    result = crud.permission.create(db_session, obj_in=permission_in)
                    permissions.append(result)

            module_permissions[module] = permissions

        return module_permissions
