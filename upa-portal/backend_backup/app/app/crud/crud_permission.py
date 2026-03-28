#!/usr/bin/env python

"""CRUD operations for the permission model"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models import User
from app.models.permission import Permission
from app.schemas.permission import PermissionCreate, PermissionUpdate
from app.utils.common import generate_permission


class CRUDPermission(CRUDBase[Permission, PermissionCreate, PermissionUpdate]):
    @staticmethod
    def get_by_name(db_session: Session, *, name: str) -> Permission | None:
        """
        Retrieve a permission with a name.

        Parameters
        ----------
        db_session : Session
            Database session
        name : str
            Name of the permission

        Returns
        -------
        Permission
            Returns the Permission object or None.
        """
        with db_session as session:
            stmt = select(Permission).where(Permission.name == name)
            return session.scalars(stmt).first()

    def create(self, db_session: Session, *, obj_in: PermissionCreate) -> Permission:
        with db_session as session:
            db_obj = Permission(
                name=generate_permission(
                    module=obj_in.module, operation=obj_in.operation
                ),
                module=obj_in.module,
                operation=obj_in.operation,
            )

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

            return db_obj

    def update(
        self,
        db_session: Session,
        *,
        db_obj: Permission,
        obj_in: PermissionUpdate | dict[str, Any],
    ) -> Permission:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        update_data["name"] = generate_permission(
            module=update_data["module"], operation=update_data["operation"]
        )

        return super().update(db_session, db_obj=db_obj, obj_in=update_data)

    @staticmethod
    def get_user_permissions(user: User) -> list[str]:
        """
        Fetch assigned permissions to the user from the database.

        Parameters
        ----------
        user : User
            User model object

        Returns
        -------
        list
            A list consists of permissions names.
        """
        permissions = []

        permissions_objs: list[Permission] = user.role.permissions
        for perm_obj in permissions_objs:
            permissions.append(perm_obj.name)

        return permissions


permission = CRUDPermission(Permission)
