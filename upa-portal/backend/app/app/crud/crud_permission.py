#!/usr/bin/env python

"""CRUD operations for the permission model"""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud, schemas
from app.crud.base import CRUDBase
from app.db.session import SessionLocal
from app.models import PolicyPermission, User
from app.models.permission import Permission
from app.schemas.permission import PermissionCreate, PermissionMinimal, PermissionUpdate
from app.utils.common import degenerate_permission, generate_permission


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

    def get_objects_by_ids(
        self,
        db_session: Session,
        *,
        permissions: list[UUID],
    ) -> list[Permission]:
        """
        Retrieve permissions via IDs.

        Parameters
        ----------
        db_session : Session
            Database session
        permissions: list[UUID]
            A list of permission ID's

        Returns
        -------
        list[Permission]
            Returns a list of Permission objects.
        """
        final_list = []

        for perm_id in permissions:
            final_list.append(self.get(db_session, obj_id=perm_id))

        return final_list

    def get_by_name_or_create(self, db_session: Session, *, name: str) -> Permission:
        """
        Retrieve a permission with a name or create a new permission.

        Parameters
        ----------
        db_session : Session
            Database session
        name : str
            Name of the permission

        Returns
        -------
        Permission
            Returns the Permission object.
        """
        with db_session as session:
            stmt = select(Permission).where(Permission.name == name)
            permission_obj = session.scalars(stmt).first()

            if not permission_obj:
                data = degenerate_permission(name)

                permission_obj = self.create(
                    session,
                    obj_in=PermissionCreate(
                        module=data["module"], operation=data["operation"]
                    ),
                )

            return permission_obj

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
    def get_user_permissions(user: User) -> list[PermissionMinimal]:
        """
        Fetch assigned permissions to the user from the database.

        Parameters
        ----------
        user : User
            The User model object

        Returns
        -------
        list[PermissionMinimal]
            A list consists of permissions.
        """
        session = SessionLocal()
        final_list: list[PermissionMinimal] = []

        # Get associated user role permissions
        permissions_objs: list[Permission] = user.role.permissions
        for perm_obj in permissions_objs:
            final_list.append(schemas.PermissionMinimal(**perm_obj.__dict__))

        # Get associated user policy permissions
        user_policy_permissions: list[PolicyPermission] = crud.user_policy.get_by_user(
            session, user_id=user.id
        )
        if hasattr(user_policy_permissions, "permissions"):
            for policy_permission in user_policy_permissions.permissions:
                found_permission = next(
                    (
                        x
                        for x in final_list
                        if x.name == policy_permission.permission.name
                    ),
                    False,
                )
                if found_permission:
                    found_permission.effect = policy_permission.effect
                else:
                    final_list.append(
                        schemas.PermissionMinimal(
                            **policy_permission.permission.__dict__,
                            effect=policy_permission.effect,
                        )
                    )

        return final_list


permission = CRUDPermission(Permission)
