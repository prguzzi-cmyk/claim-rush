#!/usr/bin/env python

from sqlalchemy.orm import Session

from app import crud, schemas
from app.models import Role as RoleModel
from app.utils.common import slugify


class Role:
    """Helper to create required roles"""

    def __init__(self, roles: dict[str, list]):
        """
        Initialize Role helper class.

        Parameters
        ----------
        roles : dict
            The dictionary consists of roles with a list of permission/s.
        """
        self.roles = roles

    def create(self, db_session: Session) -> dict[str, RoleModel]:
        """
        Add roles to the database.

        Parameters
        ----------
        db_session : Session
            Database session

        Returns
        -------
        dict
            The dictionary consists of roles with a list of permission id/s.
        """
        roles = {}

        for role, permissions in self.roles.items():
            role_obj = crud.role.get_by_name(
                db_session,
                name=slugify(role),
            )
            if not role_obj:
                role_in = schemas.RoleCreate(
                    name=slugify(role),
                    display_name=role,
                    can_be_removed=False,
                )
                result = crud.role.create(db_session, obj_in=role_in)
                roles[role] = result

                crud.role.assign_permissions(
                    db_session, role_name=result.name, permissions=permissions
                )

        return roles
