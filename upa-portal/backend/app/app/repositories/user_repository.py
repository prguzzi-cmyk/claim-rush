#!/usr/bin/env python

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, aliased, selectinload

from app.core.security import get_password_hash
from app.exceptions import DatabaseOperationError
from app.models import User, UserMeta
from app.repositories import BaseRepository
from app.schemas import UserCreate, UserUpdate


class UserRepository(BaseRepository[User, UserCreate, UserUpdate]):
    """
    Repository for managing User entities in the database.

    Attributes
    ----------
    db_session : Session
        The database session used for accessing user data.
    """

    def __init__(self, db_session: Session):
        """
        Initializes the UserRepository with the given database session.

        Parameters
        ----------
        db_session : Session
            The database session used for accessing user data.
        """
        super().__init__(db_session, User)

    def get(
        self,
        user_id: UUID,
        even_removed: bool = False,
    ) -> User | None:
        """
        Retrieves a user entity by its ID.

        Parameters
        ----------
        user_id : UUID
            The ID of the user entity to retrieve.
        even_removed : bool
            If True, then also looks into the removed entities. If False, then looks into non-removed entities only.
            Default is False.

        Returns
        -------
        User | None
            The user entity if found, otherwise None.

        Raises
        ------
        DatabaseOperationError
            If there is an issue retrieving the user entity.
        """
        with self.db_session as session:
            try:
                # The select statement
                stmt = select(User).options(
                    selectinload(User.parent),
                    selectinload(User.manager),
                    selectinload(User.created_by),
                    selectinload(User.updated_by),
                )

                # Apply where clause
                stmt = stmt.where(User.id == user_id)

                # Apply filters
                if even_removed is False:
                    if hasattr(User, "is_removed"):
                        stmt = stmt.filter(getattr(User, "is_removed").is_(False))

                return session.scalar(stmt)
            except SQLAlchemyError as e:
                raise DatabaseOperationError(
                    f"Failed to retrieve {self.model.__name__} with ID {id}: {str(e)}"
                )

    def get_by_email(
        self,
        email: str,
        even_removed: bool = False,
    ) -> User | None:
        """
        Retrieves a User entity from the database by email.

        Parameters
        ----------
        email : str
            The email address to look for in the User table.
        even_removed : bool, optional
            Whether to include soft-deleted (removed) users in the search. Defaults to False, meaning only
            active (non-removed) users are retrieved.

        Returns
        -------
        User | None
            The User object matching the provided email, or None if no such user is found.

        Raises
        ------
        DatabaseOperationError
            If there is any issue executing the query or interacting with the database, this exception is raised
            with a detailed error message.
        """
        with self.db_session as session:
            try:
                # The select statement
                stmt = select(User).options(
                    selectinload(User.parent),
                    selectinload(User.manager),
                    selectinload(User.created_by),
                    selectinload(User.updated_by),
                )

                # Apply where clause
                stmt = stmt.where(User.email == email)

                # Apply filters
                if even_removed is False:
                    if hasattr(User, "is_removed"):
                        stmt = stmt.filter(
                            getattr(User, "is_removed").is_(even_removed)
                        )

                return session.scalar(stmt)
            except SQLAlchemyError as e:
                raise DatabaseOperationError(
                    f"Failed to retrieve {self.model.__name__} with email {email}: {str(e)}"
                )

    def create(self, entity: UserCreate) -> User:
        """
        Creates a new User entity in the database along with associated metadata.

        This method takes a `UserCreate` schema, constructs a new `User` object,
        hashes the provided password, assigns user metadata (if provided), and commits
        the new user and their metadata to the database. If any database error occurs,
        the session is rolled back, and a custom `DatabaseOperationError` is raised.

        Parameters
        ----------
        entity : UserCreate
            The schema containing user details (first name, last name, email, password,
            metadata, and relationships) to create a new user entity.

        Returns
        -------
        User
            The newly created User entity retrieved from the database.

        Raises
        ------
        DatabaseOperationError
            Raised if there is an issue during the creation process in the database.
        """
        with self.db_session as session:
            try:
                # Create User entity from UserCreate schema
                user_entity = User(
                    first_name=entity.first_name,
                    last_name=entity.last_name,
                    email=entity.email,
                    hashed_password=get_password_hash(entity.password),
                    is_active=entity.is_active,
                    can_be_removed=entity.can_be_removed,
                    parent_id=entity.parent_id,
                    manager_id=entity.manager_id,
                    role_id=entity.role_id,
                )

                # If user_meta information is provided, create the UserMeta entity
                if entity.user_meta:
                    user_meta_entity = UserMeta(
                        address=entity.user_meta.address,
                        city=entity.user_meta.city,
                        state=entity.user_meta.state,
                        zip_code=entity.user_meta.zip_code,
                        phone_number=entity.user_meta.phone_number,
                        phone_number_extension=entity.user_meta.phone_number_extension,
                    )
                else:
                    # If no metadata is provided, create an empty UserMeta entity
                    user_meta_entity = UserMeta()

                # Establish the relationship between user and metadata
                user_entity.user_meta = user_meta_entity
                user_meta_entity.user = user_entity

                # Add both user and user_meta to the session
                session.add(user_entity)
                session.add(user_meta_entity)
                session.commit()

                # Fetch and return the newly created user entity
                return self.get(user_entity.id)
            except SQLAlchemyError as e:
                # Rollback the session in case of any database error
                session.rollback()
                raise DatabaseOperationError(
                    f"Failed to create {self.model.__name__}: {str(e)}"
                )

    def get_subordinate_ids(self, manager_id: UUID):
        """
        Retrieves a list of IDs for all subordinates of a specified user, including indirect subordinates.

        This method uses a recursive Common Table Expression (CTE) to find all users who are directly
        or indirectly managed by the user with the given `manager_id`. The CTE starts with the specified
        user and recursively includes all users who report to them, effectively collecting all
        subordinate IDs.

        Parameters
        ----------
        manager_id : UUID
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
            .where(User.id == manager_id)
            .cte("subordinates", recursive=True)
        )

        # Define the recursive part of the CTE
        subordinates = subordinates.union_all(
            select(user_alias.id).where(user_alias.manager_id == subordinates.c.id)
        )

        # Use self.db_session directly — NOT `with self.db_session as session:`.
        # This method is called from claim_service.get_claim_by_id() which
        # already holds an active session from repository.get().  Re-entering
        # via `with` triggers SQLAlchemy's "session is provisioning a new
        # connection; concurrent operations are not permitted" error.
        try:
            stmt = select(subordinates.c.id)
            subordinate_ids = self.db_session.scalars(stmt).all()
            return subordinate_ids
        except SQLAlchemyError as e:
            raise DatabaseOperationError(
                f"Failed to get subordinates ids {self.model.__name__}: {str(e)}"
            )
