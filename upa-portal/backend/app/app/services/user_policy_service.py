#!/usr/bin/env python

from typing import TYPE_CHECKING
from uuid import UUID


from app.exceptions import (
    DatabaseOperationError,
    RepositoryError,
)
from app.models import UserPolicy
from app.repositories import UserPolicyRepository
from app.services import BaseService

if TYPE_CHECKING:
    from app.service_locator import AppServiceLocator


class UserPolicyService(BaseService[UserPolicy, UserPolicyRepository]):
    """Service layer for managing user policies."""

    def __init__(
        self,
        user_policy_repository: UserPolicyRepository,
        service_locator: "AppServiceLocator" = None,
    ):
        """
        Initializes the UserPolicyService with a user policy repository.

        Parameters
        ----------
        user_policy_repository : UserPolicyRepository
            The repository instance to use for user policy data operations.
        service_locator : AppServiceLocator
            The service locator for accessing other services.
        """
        super().__init__(user_policy_repository)
        self.service_locator = service_locator

    def get_by_user_id(
        self,
        user_id: UUID,
    ) -> UserPolicy | None:
        """
        Retrieve a UserPolicy entity by the specified user ID.

        Parameters
        ----------
        user_id : UUID
            The unique identifier of the user.

        Returns
        -------
        UserPolicy | None
            The UserPolicy entity associated with the given user ID, or None if not found.

        Raises
        ------
        RepositoryError
            If there is an issue accessing the database.
        """
        try:
            user_policy_entity: UserPolicy | None = self.repository.get_by_user_id(
                user_id
            )

            return user_policy_entity
        except DatabaseOperationError:
            raise RepositoryError(
                "There was an issue getting a user policy entity from the database."
            )
