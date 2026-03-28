#!/usr/bin/env python

from typing import TYPE_CHECKING
from uuid import UUID

from pydantic import ValidationError

from app.core.log import logger
from app.exceptions import (
    DatabaseOperationError,
    RepositoryError,
    EntityNotFoundError,
    EntityAlreadyExistsError,
)
from app.models import User
from app.repositories import UserRepository
from app.schemas import UserCreate
from app.services import BaseService

if TYPE_CHECKING:
    from app.service_locator import AppServiceLocator


class UserService(BaseService[User, UserRepository]):
    """Service layer for managing users."""

    def __init__(
        self,
        user_repository: UserRepository,
        service_locator: "AppServiceLocator" = None,
    ):
        """
        Initializes the UserService with a user repository.

        Parameters
        ----------
        user_repository : UserRepository
            The repository instance to use for user data operations.
        service_locator : AppServiceLocator
            The service locator for accessing other services.
        """
        super().__init__(user_repository)
        self.service_locator = service_locator

    def get_user_by_id(
        self,
        user_id: UUID,
        even_removed: bool | None = False,
    ) -> User | None:
        """
        Retrieves a user entity from the database by its unique ID.

        Parameters
        ----------
        user_id : UUID
            The unique ID of the user to retrieve.
        even_removed :
            If True, retrieves the user even if it has been marked as removed.
            If False, retrieves only non-removed users.
            Default is False.

        Returns
        -------
        User | None
            If found, the user entity corresponding to the provided ID, otherwise None.

        Raises
        ------
        EntityNotFoundError
            When a user entity is not found in the database.
        RepositoryError
            If there is an issue retrieving the user from the database.
        """
        try:
            user_entity: User | None = self.repository.get(user_id, even_removed)
            if user_entity is None:
                raise EntityNotFoundError(f"User with `{user_id}` ID doesn't exist.")

            return user_entity
        except DatabaseOperationError as e:
            logger.exception(e)
            raise RepositoryError(
                "There was an issue getting a user entity from the database."
            )

    def get_user_by_email(self, email: str) -> User | None:
        """
        Retrieve a user entity by email address.

        This method attempts to retrieve a user from the database using the provided
        email address. It fetches both active and removed users by setting `even_removed=True`.

        Parameters
        ----------
        email : str
            The email address used to find the user.

        Returns
        -------
        User | None
            The user entity if found, or `None` if no user matches the provided email.

        Raises
        ------
        RepositoryError
            If there is an issue during the database operation, such as a failure to fetch the user entity.
        """
        try:
            return self.repository.get_by_email(email, even_removed=True)
        except DatabaseOperationError as e:
            logger.exception(e)
            raise RepositoryError(
                "There was an issue getting a user entity from the database via provided email."
            )

    def create_user(self, user_schema: UserCreate) -> User:
        """
        Creates a new user in the system.

        Once all validations pass, the method proceeds to save the user entity in the repository.

        Parameters
        ----------
        user_schema : UserCreate
            The schema containing the user's creation details, including attributes like email, role ID,
            parent ID, and manager ID.

        Returns
        -------
        User
            The newly created user entity.

        Raises
        ------
        EntityAlreadyExistsError
            If a user with the provided email address already exists in the system.

        EntityNotFoundError
            If the provided `parent_id`, `manager_id`, or `role_id` does not correspond to existing entities.

        RepositoryError
            If there is an issue during database operations, such as a failure to save the user entity.
        """

        # Ensures the user does not already exist by checking for the provided email.
        try:
            user_entity = self.get_user_by_email(user_schema.email)
            if user_entity:
                raise EntityAlreadyExistsError(
                    f"The user with this email address `{user_schema.email}` already exists in the system."
                )
        except DatabaseOperationError as e:
            raise RepositoryError(
                f"Check for the existence of a user validation failed: {e}"
            ) from e

        # Validates the parent user if a `parent_id` is provided.
        if user_schema.parent_id:
            try:
                self.get_user_by_id(user_id=user_schema.parent_id, even_removed=True)
            except EntityNotFoundError as e:
                raise EntityNotFoundError(f"Parent user validation failed: {e}") from e

        # Validates the manager user if a `manager_id` is provided.
        if user_schema.manager_id:
            try:
                self.get_user_by_id(user_id=user_schema.manager_id, even_removed=True)
            except EntityNotFoundError as e:
                raise EntityNotFoundError(f"Manager user validation failed: {e}") from e

        # Verifies the associated role by its `role_id`.
        try:
            role_service = self.service_locator.get_role_service()
            role_service.get_role_by_id(role_id=user_schema.role_id, even_removed=True)
        except EntityNotFoundError as e:
            logger.error(e)
            raise EntityNotFoundError(f"Role validation failed: {e}") from e

        # Persist a new user data in the database
        try:
            return self.repository.create(user_schema)
        except DatabaseOperationError as e:
            logger.exception(e)
            raise RepositoryError("There was an issue saving the user to the database.")

    @staticmethod
    def validate_create_user_fields(data: dict) -> UserCreate | None:
        """
        Extract and validates user-related fields from the given data.

        Parameters
        ----------
        data : dict
            Data containing potential user information.

        Returns
        -------
        UserCreate | None
            Returns a validated UserCreate schema if data is valid, otherwise None.
        """
        try:
            # Attempt to create a UserCreate schema, if fields are present and valid
            user_data = UserCreate(
                first_name=data.get("first_name"),
                last_name=data.get("last_name"),
                email=data.get("email"),
                password=data.get("password"),
                role_id=data.get("role_id"),
            )

            return user_data
        except ValidationError as e:
            # If validation fails, return None
            logger.log(f"Validation error validate_create_user_fields: {e}")

        return None

    def get_subordinates(self, manager_id: UUID):
        """
        Fetches the IDs of all users who are subordinates to a given manager.

        Parameters
        ----------
        manager_id : UUID
            The ID of the user (manager) whose subordinates need to be fetched.

        Returns
        -------
        list[UUID]
            A list of subordinate user IDs.

        Raises
        ------
        RepositoryError
            If there is an issue fetching subordinate users from the database.
        """
        try:
            return self.repository.get_subordinate_ids(manager_id)
        except DatabaseOperationError as e:
            logger.error(str(e))
            raise RepositoryError(
                "There was an issue getting subordinates ID's from the database."
            )
