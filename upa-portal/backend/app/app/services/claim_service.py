#!/usr/bin/env python

from typing import TYPE_CHECKING
from uuid import UUID


from app.models import Claim, User
from app.repositories import ClaimRepository
from app.services import BaseService, PermissionService
from app.exceptions import (
    EntityNotFoundError,
    DatabaseOperationError,
    RepositoryError,
    ForbiddenError,
)

if TYPE_CHECKING:
    from app.service_locator import AppServiceLocator


class ClaimService(BaseService[Claim, ClaimRepository]):
    """Service layer for managing claims."""

    def __init__(
        self,
        claim_repository: ClaimRepository,
        service_locator: "AppServiceLocator" = None,
    ):
        """
        Initializes the ClaimService with a claim repository.

        Parameters
        ----------
        claim_repository : ClaimRepository
            The repository instance to use for claim data operations.
        service_locator : AppServiceLocator
            The service locator for accessing other services.
        """
        super().__init__(claim_repository)
        self.service_locator = service_locator

    @staticmethod
    def is_user_authorized_to_view_claim(
        user_entity: User, claim_entity: Claim, subordinates_ids: list[UUID]
    ) -> bool:
        """
        Check if the user is authorized to view the claim based on their role, assigned claims, and collaborations.

        Parameters
        ----------
        user_entity : User
            The user entity attempting to view the claim.
        claim_entity : Claim
            The claim entity to be viewed.
        subordinates_ids : list[UUID]
            List of user IDs representing subordinates of the user.

        Returns
        -------
        bool
            True if the user is authorized to view the claim, False otherwise.
        """

        # Check if the user has an Admin role or any special permissions
        if PermissionService.has_admin_privileges(user_entity):
            return True

        # Check if the user is directly assigned to the claim
        if claim_entity.assigned_to == user_entity.id:
            return True

        # Check if any of the subordinates are assigned to the claim
        if claim_entity.assigned_to in subordinates_ids:
            return True

        # Check if the user is a collaborator on the claim
        if user_entity.id in [
            collaborator.id for collaborator in claim_entity.collaborators
        ]:
            return True

        # Check if any subordinate is a collaborator on the claim
        if any(
            subordinate_id
            in [collaborator.id for collaborator in claim_entity.collaborators]
            for subordinate_id in subordinates_ids
        ):
            return True

        return False  # User is not authorized to view the claim

    def get_claim_by_id(
        self,
        claim_id: UUID,
        user: User | UUID,
        even_removed: bool = False,
    ) -> Claim:
        """
        Retrieves a claim entity from the database by its unique ID.

        Parameters
        ----------
        claim_id : UUID
            The unique ID of the claim to retrieve.
        user : User | UUID
            The user entity or user ID trying to access the claim.
        even_removed : bool
            If True, retrieves the claim even if it has been marked as removed.
            If False, retrieves only non-removed claims.
            Default is False.

        Returns
        -------
        Claim
            The claim entity corresponding to the provided ID.

        Raises
        ------
        EntityNotFoundError
            When a claim entity is not found in the database.
        ForbiddenError
            If the user does not have permission to view the claim.
        RepositoryError
            If there is an issue retrieving the claim from the database.
        """
        try:
            # Fetch claim by ID
            claim_entity: Claim | None = self.repository.get(
                entity_id=claim_id, even_removed=even_removed
            )
            if claim_entity is None:
                raise EntityNotFoundError(f"Claim with `{claim_id}` ID doesn't exist.")

            # Get user service instance
            user_service = self.service_locator.get_user_service()

            # Check user existence
            user_entity = (
                user if isinstance(user, User) else user_service.get_user_by_id(user)
            )
            if user_entity is None:
                raise EntityNotFoundError(
                    f"The user with `{user}` ID doesn't exist in the system."
                )

            # Fetch subordinates of a manager or user
            subordinates = user_service.get_subordinates(user_entity.id)

            # Check if the user is authorized to view claim
            if not self.is_user_authorized_to_view_claim(
                user_entity, claim_entity, subordinates
            ):
                raise ForbiddenError(
                    f"User `{user_entity.email}` is not authorized to view this claim."
                )

            return claim_entity
        except DatabaseOperationError:
            raise RepositoryError(
                "There was an issue getting a claim entity from the database."
            )
