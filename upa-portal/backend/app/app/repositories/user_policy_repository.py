#!/usr/bin/env python

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.log import logger
from app.exceptions import DatabaseOperationError
from app.models import UserPolicy
from app.repositories import BaseRepository
from app.schemas import UserPolicyCreate, UserPolicyUpdate


class UserPolicyRepository(
    BaseRepository[UserPolicy, UserPolicyCreate, UserPolicyUpdate]
):
    """
    Repository for managing User Policy entities in the database.

    Attributes
    ----------
    db_session : Session
        The database session used for accessing user policy data.
    """

    def __init__(self, db_session: Session):
        """
        Initializes the UserPolicyRepository with the given database session.

        Parameters
        ----------
        db_session : Session
            The database session used for accessing user policy data.
        """
        super().__init__(db_session, UserPolicy)

    def get_by_user_id(self, user_id: UUID) -> UserPolicy:
        """
        Retrieve a UserPolicy entity based on the given user ID.

        Parameters
        ----------
        user_id : UUID
            The unique identifier of the user.

        Returns
        -------
        UserPolicy | None
            The UserPolicy entity if found, otherwise None.

        Raises
        ------
        DatabaseOperationError
            If there's a database error during retrieval.
        """
        with self.db_session as session:
            try:
                # Prepare the select statement
                stmt = select(UserPolicy)

                # Apply where clause
                stmt = stmt.where(UserPolicy.user_id == user_id)

                # Return the first match or None
                return session.scalar(stmt)
            except SQLAlchemyError as e:
                logger.exception(e)
                raise DatabaseOperationError(
                    f"Failed to retrieve {self.model.__name__} with User ID {user_id}: {str(e)}"
                )
