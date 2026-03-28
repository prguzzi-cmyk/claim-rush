#!/usr/bin/env python

"""CRUD operations for the user and user_meta model"""

from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud
from app.core.rbac import Roles
from app.core.security import get_password_hash, verify_password
from app.crud.base import CRUDBase
from app.models import UserMeta
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserUpdateMe
from app.utils.common import slugify


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    @staticmethod
    def get_by_email(db_session: Session, *, email: str) -> User | None:
        """
        Retrieve a user with an email.

        Parameters
        ----------
        db_session : Session
            Database session
        email : str
            Email address of the user

        Returns
        -------
        User
            Returns the User object or None.
        """
        with db_session as session:
            stmt = select(User).where(User.email == email)
            return session.scalars(stmt).first()

    def create(self, db_session: Session, *, obj_in: UserCreate) -> User:
        role_obj = crud.role.get(db_session, obj_id=obj_in.role_id)

        with db_session as session:
            user_obj = User(
                first_name=obj_in.first_name,
                last_name=obj_in.last_name,
                email=obj_in.email,
                hashed_password=get_password_hash(obj_in.password),
                can_be_removed=obj_in.can_be_removed,
                role=role_obj,
            )

            if obj_in.user_meta:
                meta_obj = UserMeta(
                    address=obj_in.user_meta.address,
                    city=obj_in.user_meta.city,
                    state=obj_in.user_meta.state,
                    zip_code=obj_in.user_meta.zip_code,
                    phone_number=obj_in.user_meta.phone_number,
                )
            else:
                meta_obj = UserMeta()

            user_obj.user_meta = meta_obj
            meta_obj.user = user_obj

            session.add(user_obj)
            session.add(meta_obj)
            session.commit()
            session.refresh(user_obj)

            return user_obj

    def update(
        self,
        db_session: Session,
        *,
        db_obj: User,
        obj_in: UserUpdate | UserUpdateMe | dict[str, Any]
    ) -> User:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        if "password" in update_data.keys() and update_data["password"]:
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"]

            update_data["hashed_password"] = hashed_password

        with db_session as session:
            obj_data = jsonable_encoder(db_obj)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data and field != "user_meta":
                    setattr(db_obj, field, update_data[field])

            if update_data.get("user_meta"):
                for field in obj_data["user_meta"]:
                    if field in update_data["user_meta"]:
                        setattr(
                            db_obj.user_meta, field, update_data["user_meta"][field]
                        )

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

        return db_obj

    @staticmethod
    def update_avatar(db_session: Session, *, db_obj: User, avatar: str) -> User:
        """
        Update the user avatar.

        Parameters
        ----------
        db_session : Session
            Database session
        db_obj : User
            The user model object
        avatar : str
            Avatar path

        Returns
        -------
        User
            User model updated object
        """
        with db_session as session:
            setattr(db_obj.user_meta, "avatar", avatar)

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

        return db_obj

    def authenticate(
        self, db_session: Session, *, email: str, password: str
    ) -> User | None:
        """
        Authenticate the user with the provided details.

        Parameters
        ----------
        db_session : Session
            Database session
        email : str
            User email address
        password : str
            User password

        Returns
        -------
        User
            Returns the User object or None.
        """
        user_obj = self.get_by_email(db_session, email=email)
        if not user_obj:
            return None

        if not verify_password(password, user_obj.hashed_password):
            return None

        return user_obj

    @staticmethod
    def is_active(user_obj: User) -> bool:
        """
        Check if the user status is active or not.

        Parameters
        ----------
        user_obj : User
            Database model object of user

        Returns
        -------
        bool
            Returns True if active otherwise False
        """
        return user_obj.is_active

    @staticmethod
    def is_superuser(user_obj: User) -> bool:
        """
        Check if the user is superuser or not.

        Parameters
        ----------
        user_obj : User
            Database model object of user

        Returns
        -------
        bool
            Returns True if user is superuser otherwise False
        """
        return user_obj.role.name == slugify(Roles.SUPER_ADMIN.value)

    @staticmethod
    def is_admin_user(user_obj: User) -> bool:
        """
        Check if the user is admin user or not.

        Parameters
        ----------
        user_obj : User
            Database model object of user

        Returns
        -------
        bool
            Returns True if user is admin user otherwise False
        """
        return user_obj.role.name == slugify(Roles.SUPER_ADMIN.value)


user = CRUDUser(User)
