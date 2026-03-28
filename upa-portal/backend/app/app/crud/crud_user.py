#!/usr/bin/env python

"""CRUD operations for the user and user_meta model"""

from typing import Any, Sequence
from uuid import UUID

from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload, aliased

from app import crud
from app.core.rbac import Roles
from app.core.security import get_password_hash, verify_password
from app.crud.base import CRUDBase
from app.models import Role, UserMeta
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserUpdateMe
from app.utils.common import slugify, custom_jsonable_encoder


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    def get_active_users(self, db_session: Session) -> Sequence[User]:
        """
        Retrieve a list of active users.

        Parameters
        ----------
        db_session : Session
            Database session

        Returns
        -------
        list[User]
            A list of User objects.
        """
        stmt_filters = [
            User.is_active.is_(True),
        ]

        return self.get_multi(db_session, filters=stmt_filters)

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

    @staticmethod
    def get_multi_by_role(
        db_session: Session, *, role_id: UUID
    ) -> Sequence[User] | None:
        """
        Retrieve a list of users of a specific role.

        Parameters
        ----------
        db_session : Session
            Database session
        role_id : UUID
            Role id

        Returns
        -------
        User
            Returns a list of users.
        """
        with db_session as session:
            stmt = select(User).where(
                and_(User.role_id == role_id, User.is_removed.is_(False))
            )
            return paginate(session, stmt)

    @staticmethod
    def group_by_user_role(
        db_session: Session,
        filters: list = None,
    ) -> Sequence[Any]:
        """
        Get a list of users count group by user role.

        Parameters
        ----------
        db_session : Session
            Database session
        filters : list
            A list consists of filters

        Returns
        -------
        Sequence[Any]
            Returns a list of users count group by user role.
        """
        with db_session as session:
            stmt = select(
                Role.name, Role.display_name, func.count(User.id).label("users_count")
            ).join(Role, User.role_id == Role.id)

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply grouping
            stmt = stmt.group_by(Role.name, Role.display_name)

            # Apply ordering
            stmt = stmt.order_by(Role.name)

            return session.execute(stmt).all()

    def get(
        self, db_session: Session, *, obj_id: UUID, even_removed: bool = False
    ) -> User | None:
        with db_session as session:
            stmt = select(User).options(
                selectinload(User.parent),
                selectinload(User.manager),
                selectinload(User.created_by),
                selectinload(User.updated_by),
            )
            if even_removed:
                stmt = stmt.where(self.model.id == obj_id)
            else:
                if hasattr(self.model, "is_removed"):
                    stmt = stmt.where(
                        and_(
                            self.model.id == obj_id,
                            getattr(self.model, "is_removed").is_(False),
                        )
                    )
                else:
                    stmt = stmt.where(self.model.id == obj_id)

            return session.scalar(stmt)

    def get_objects_by_ids(
        self,
        db_session: Session,
        *,
        user_ids: list[UUID],
    ) -> list[User] | None:
        """
        Retrieve users via ID's.

        Parameters
        ----------
        db_session : Session
            Database session
        user_ids: list[UUID]
            A list of users IDs

        Returns
        -------
        list[User] | None
            Returns a list of User objects.
        """
        final_list = []

        for user_id in user_ids:
            final_list.append(self.get(db_session, obj_id=user_id))

        return final_list

    def create(self, db_session: Session, *, obj_in: UserCreate) -> User:
        role_obj = crud.role.get(db_session, obj_id=obj_in.role_id)

        with db_session as session:
            user_obj = User(
                first_name=obj_in.first_name,
                last_name=obj_in.last_name,
                email=obj_in.email,
                hashed_password=get_password_hash(obj_in.password),
                is_active=obj_in.is_active,
                can_be_removed=obj_in.can_be_removed,
                parent_id=obj_in.parent_id,
                manager_id=obj_in.manager_id,
                role=role_obj,
            )

            if obj_in.user_meta:
                meta_obj = UserMeta(
                    address=obj_in.user_meta.address,
                    city=obj_in.user_meta.city,
                    state=obj_in.user_meta.state,
                    zip_code=obj_in.user_meta.zip_code,
                    phone_number=obj_in.user_meta.phone_number,
                    phone_number_extension=obj_in.user_meta.phone_number_extension,
                )
            else:
                meta_obj = UserMeta()

            user_obj.user_meta = meta_obj
            meta_obj.user = user_obj

            session.add(user_obj)
            session.flush()
            session.add(meta_obj)
            session.commit()

            db_obj: User = session.scalar(
                select(User)
                .options(
                    selectinload(User.parent),
                    selectinload(User.manager),
                    selectinload(User.created_by),
                    selectinload(User.updated_by),
                )
                .where(User.id == user_obj.id)
            )

            return db_obj

    def update(
        self,
        db_session: Session,
        *,
        obj_id: UUID,
        obj_in: UserUpdate | UserUpdateMe | dict[str, Any],
    ) -> User:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        # Strip empty password so we never overwrite the hash with a blank
        if "password" in update_data:
            if update_data["password"]:
                hashed_password = get_password_hash(update_data["password"])
                update_data["hashed_password"] = hashed_password
            del update_data["password"]

        with db_session as session:
            db_obj: User = session.scalar(
                select(User)
                .options(
                    selectinload(User.parent),
                    selectinload(User.manager),
                    selectinload(User.created_by),
                    selectinload(User.updated_by),
                )
                .where(User.id == obj_id)
            )
            obj_data = custom_jsonable_encoder(db_obj)

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

            try:
                session.commit()
            except IntegrityError as exc:
                session.rollback()
                from app.utils.exceptions import raise_if_unique_violation
                raise_if_unique_violation(exc, "A user with this email already exists.")
                raise

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
            The User model updated object
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
        user_obj = self.get_by_email(db_session, email=email.lower())
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
        return user_obj.role.name == slugify(Roles.ADMIN.value)

    @staticmethod
    def has_admin_privileges(user_obj: User) -> bool:
        """
        Check if the user has administrator privileges.

        Parameters
        ----------
        user_obj : User
            Database model object of user

        Returns
        -------
        bool
            Returns True if user has admin privileges user otherwise False
        """
        return user_obj.role.name == slugify(
            Roles.ADMIN.value
        ) or user_obj.role.name == slugify(Roles.SUPER_ADMIN.value)

    @staticmethod
    def get_subordinate_ids(db_session: Session, user_id: UUID):
        """
        Retrieves a list of IDs for all subordinates of a specified user, including indirect subordinates.

        This method uses a recursive Common Table Expression (CTE) to find all users who are directly
        or indirectly managed by the user with the given `user_id`. The CTE starts with the specified
        user and recursively includes all users who report to them, effectively collecting all
        subordinate IDs.

        Parameters
        ----------
        db_session : Session
            The SQLAlchemy database session used for querying the database.
        user_id : UUID
            The unique identifier of the user whose subordinates are to be retrieved.

        Returns
        -------
        list[UUID]
            A list of unique identifiers representing all subordinates of the specified user.

        Raises
        ------
        SQLAlchemyError
            If there is an error executing the database query, an exception is raised detailing
            the issue.
        """
        user_alias = aliased(User)

        # Define the CTE
        subordinates = (
            select(User.id)
            .where(User.id == user_id)
            .cte("subordinates", recursive=True)
        )

        # Define the recursive part of the CTE
        subordinates = subordinates.union_all(
            select(user_alias.id).where(user_alias.manager_id == subordinates.c.id)
        )

        # Fetch all subordinate IDs
        with db_session as session:
            stmt = select(subordinates.c.id)
            subordinate_ids = session.scalars(stmt).all()

            return subordinate_ids


user = CRUDUser(User)
