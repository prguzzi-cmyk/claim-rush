#!/usr/bin/env python

"""CRUD operations for the role model"""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud
from app.core.rbac import Modules, Roles
from app.core.security import validate_lock
from app.crud.base import CRUDBase
from app.models import Permission, Role
from app.schemas.role import RoleCreate, RoleUpdate
from app.utils.common import slugify
from app.utils.exceptions import exc_forbidden


class CRUDRole(CRUDBase[Role, RoleCreate, RoleUpdate]):
    @staticmethod
    def get_by_name(db_session: Session, *, name: str) -> Role | None:
        """
        Retrieve a role with a name.

        Parameters
        ----------
        db_session : Session
            Database session
        name : str
            Name of the role

        Returns
        -------
        Role
            Returns the Role object or None.
        """
        with db_session as session:
            stmt = select(Role).where(Role.name == name)
            return session.scalar(stmt)

    @staticmethod
    def assign_permissions(
        db_session: Session, *, role_name: str, permissions: list[Permission]
    ) -> dict[str, str]:
        """
        Assigns permissions to a specific role.

        Parameters
        ----------
        db_session : Session
            Database session
        role_name : str
            Name of the role
        permissions : list
            A list of permissions

        Returns
        -------
        Role
            Returns the Role object or None.
        """
        with db_session as session:
            stmt = select(Role).where(Role.name == role_name)
            role_obj = session.scalar(stmt)
            if role_obj:
                if len(role_obj.permissions) > 0:
                    # Clear existing role permissions
                    role_obj.permissions.clear()
                    session.commit()

                    # Detach the role object from the session to avoid conflicts
                    session.expunge(role_obj)

                    # Re-fetch the role object to ensure it's properly attached
                    role_obj = session.scalar(stmt)

                for permission in permissions:
                    # Ensure permission is not detached
                    if permission not in session:
                        permission = session.merge(permission)
                    role_obj.permissions.append(permission)

                session.commit()

        return {"msg": "Successfully assigned permissions to the role."}

    @staticmethod
    def detach_permissions(
        db_session: Session, *, role_name: str, permissions: list[Permission]
    ) -> dict[str, str]:
        """
        Detach permissions from a specific role.

        Parameters
        ----------
        db_session : Session
            Database session
        role_name : str
            Name of the role
        permissions : list
            A list of permissions

        Returns
        -------
        Role
            Returns the Role object or None.
        """
        with db_session as session:
            stmt = select(Role).where(Role.name == role_name)
            role_obj = session.scalar(stmt)
            if role_obj:
                for permission in permissions:
                    if permission in role_obj.permissions:
                        # Ensure permission is not detached
                        if permission not in session:
                            permission = session.merge(permission)
                        role_obj.permissions.remove(permission)

                session.commit()

        return {"msg": "Successfully detached permissions from the role."}

    def create(self, db_session: Session, *, obj_in: RoleCreate) -> Role:
        with db_session as session:
            db_obj = Role(
                name=slugify(string=obj_in.display_name),
                display_name=obj_in.display_name,
                can_be_removed=obj_in.can_be_removed,
            )

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

            return db_obj

    def update(
        self,
        db_session: Session,
        *,
        db_obj: Role,
        obj_in: RoleUpdate | dict[str, Any],
    ) -> Role:
        if self.is_system_role(db_obj.display_name):
            exc_forbidden("You can't update the default application role.")

        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        if update_data.get("display_name"):
            update_data["name"] = slugify(string=update_data["display_name"])

        return super().update(db_session, db_obj=db_obj, obj_in=update_data)

    @staticmethod
    def append_module_permissions(
        db_session: Session,
        *,
        role_obj: Role,
        module_name: str,
        read_only: bool,
        additional_permissions: list[str] | None = None,
    ) -> dict[str, str]:
        """
        Assigns permissions to a specific role.

        Parameters
        ----------
        db_session : Session
            Database session
        role_obj : Role
            Model object of Role
        module_name : str
            Module name
        read_only : bool
             Append read-only permissions
        additional_permissions : list or None
            A list of additional permissions

        Returns
        -------
        dict
            Return response message.
        """
        permission_objs = []

        with db_session as session:
            permissions = Modules.generate_module_permissions(
                module=module_name,
                read_only=read_only,
                additional_operations=additional_permissions,
            )

            for permission in permissions:
                permission_obj = crud.permission.get_by_name_or_create(
                    session, name=permission
                )
                permission_objs.append(permission_obj)

        with db_session as session:
            bound_role_obj = session.scalars(
                select(Role).where(Role.id == role_obj.id)
            ).first()
            for permission_obj in permission_objs:
                if permission_obj not in role_obj.permissions:
                    bound_role_obj.permissions.append(permission_obj)
                    session.commit()

        return {"msg": "Successfully appended module permissions to the role."}

    def remove(self, db_session: Session, *, obj_id: UUID) -> Role | None:
        with db_session as session:
            obj = self.get(db_session, obj_id=obj_id)
            if obj:
                if self.is_system_role(obj.display_name):
                    exc_forbidden("You can't delete the default application role.")

                validate_lock(obj)

                obj.is_removed = True

                session.add(obj)
                session.commit()
                session.refresh(obj)

        return obj

    @staticmethod
    def is_system_role(display_name: str) -> bool:
        """
        Check if it is an application default role.

        Parameters
        ----------
        display_name : str
         Display name of the role.

        Returns
        -------
        bool
            `True` if found, otherwise `False`
        """
        if display_name in [r.value for r in Roles]:
            return True

        return False


role = CRUDRole(Role)
