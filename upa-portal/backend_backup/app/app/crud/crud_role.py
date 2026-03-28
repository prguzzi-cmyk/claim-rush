#!/usr/bin/env python

"""CRUD operations for the role model"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models import Permission, Role
from app.schemas.role import RoleCreate, RoleUpdate
from app.utils.common import slugify


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
            return session.scalars(stmt).first()

    @staticmethod
    def assign_permissions(
        db_session: Session, *, role_name: str, permissions: list[Permission]
    ) -> Role | None:
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
            role_obj = session.scalars(stmt).first()
            if role_obj:
                for permission in permissions:
                    role_obj.permissions.append(permission)
                session.commit()
                session.refresh(role_obj)

            return role_obj

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
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        if update_data.get("display_name"):
            update_data["name"] = slugify(string=update_data["display_name"])

        return super().update(db_session, db_obj=db_obj, obj_in=update_data)


role = CRUDRole(Role)
