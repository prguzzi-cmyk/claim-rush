#!/usr/bin/env python

from typing import TYPE_CHECKING
from uuid import UUID

from app.core.auth.enums import RoleEnum
from app.core.celery_app import celery_app
from app.core.enum_definitions import LeadStatusEnum
from app.core.log import logger
from app.core.security import generate_random_password
from app.core.utils.string_utils import split_full_name
from app.models import Lead, User
from app.repositories import LeadRepository
from app.schemas import LeadCreate, LeadUpdate
from app.services import BaseService, PermissionService
from app.exceptions import (
    EntityNotFoundError,
    DatabaseOperationError,
    RepositoryError,
    ForbiddenError,
)

if TYPE_CHECKING:
    from app.service_locator import AppServiceLocator


class LeadService(BaseService[Lead, LeadRepository]):
    """Service layer for managing leads."""

    def __init__(
        self,
        lead_repository: LeadRepository,
        service_locator: "AppServiceLocator" = None,
    ):
        """
        Initializes the LeadService with a lead repository.

        Parameters
        ----------
        lead_repository : LeadRepository
            The repository instance to use for lead data operations.
        service_locator : AppServiceLocator
            The service locator for accessing other services.
        """
        super().__init__(lead_repository)
        self.service_locator = service_locator

    def get_lead_by_id(
        self,
        lead_id: UUID,
        user: User | UUID,
        even_removed: bool = False,
    ) -> Lead:
        """
        Retrieves a lead entity from the database by its unique ID.

        Parameters
        ----------
        lead_id : UUID
            The unique ID of the lead to retrieve.
        user : User | UUID
            The user entity or user ID trying to access the lead.
        even_removed : bool
            If True, retrieves the lead even if it has been marked as removed.
            If False, retrieves only non-removed leads.
            Default is False.

        Returns
        -------
        Lead
            The lead entity corresponding to the provided ID.

        Raises
        ------
        EntityNotFoundError
            When a lead entity is not found in the database.
        ForbiddenError
            If the user does not have permission to view the lead.
        RepositoryError
            If there is an issue retrieving the lead from the database.
        """
        try:
            # Fetch lead by ID
            lead_entity: Lead | None = self.repository.get(
                entity_id=lead_id, even_removed=even_removed
            )
            if lead_entity is None:
                raise EntityNotFoundError(f"Lead with `{lead_id}` ID doesn't exist.")

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

            # Check if the user is authorized to view lead
            if not self.is_user_authorized_to_view_lead(
                user_entity, lead_entity, subordinates
            ):
                raise ForbiddenError(
                    f"User `{user_entity.email}` is not authorized to view this lead."
                )

            return lead_entity
        except DatabaseOperationError:
            raise RepositoryError(
                "There was an issue getting a lead entity from the database."
            )

    def create_lead(self, lead_schema: LeadCreate, current_user: User) -> Lead:
        """
        Creates a new lead in the system after performing necessary validations.

        Parameters
        ----------
        lead_schema : LeadCreate
            The schema object containing the details to create a new lead.
        current_user : User
            The current logged-in user attempting to create the lead.

        Returns
        -------
        Lead
            The created Lead entity.

        Raises
        ------
        EntityNotFoundError
            If the source or assigned user is not found in the system.
        ForbiddenError
            If the current user does not have permission to assign the lead.
        RepositoryError
            If there is an issue saving the lead to the database.
        """
        # Validate lead assignment
        self._validate_lead_assignment(lead_schema, current_user)

        # Validate assigned user and source user, if provided
        self._validate_user_existence(lead_schema.source, "source user")
        self._validate_user_existence(lead_schema.assigned_to, "assigned user")

        # Persist a new lead data in the database
        try:
            lead_entity = self.repository.create(lead_schema)

            # Handle lead user creation
            user_entity = self._handle_user_creation(lead_entity)
            if user_entity:
                lead_entity = self._link_user_account_to_lead(
                    lead_entity, user_entity.id
                )

            # Basic state-based routing (assigns agent if none set)
            lead_entity = self._route_lead_by_state(lead_entity)

            # Auto-distribute and deliver (non-blocking)
            self._auto_distribute_lead(lead_entity)

            # Trigger skip trace for eligible perils
            self._auto_skip_trace(lead_entity)

            return lead_entity
        except DatabaseOperationError:
            raise RepositoryError("There was an issue saving the lead to the database.")

    def update_lead(
        self, lead_id: UUID, lead_schema: LeadUpdate, current_user: User
    ) -> Lead:
        """
        Update the lead with the provided schema.

        Parameters
        ----------
        lead_id : UUID
            The unique identifier of the lead to be updated.
        lead_schema : LeadUpdate
            The schema containing the updated lead information.
        current_user : User
            The user performing the update action.

        Returns
        -------
        Lead
            The updated Lead entity.

        Raises
        ------
        ForbiddenError
            If the user does not have permission to update the lead or if the lead is not editable.
        EntityNotFoundError
            If the assigned user or source user does not exist.
        DatabaseOperationError
            If there is an issue with database operations while updating the lead.
        """
        # Retrieve the lead entity by its ID
        lead_entity = self.get_lead_by_id(lead_id, current_user)

        # Check if the lead is editable
        if not self.can_edit_lead(lead_entity):
            raise ForbiddenError(
                "The lead cannot be modified because its status is set to 'Signed and Approved'."
            )

        # Ensure the user can change the lead status
        self._ensure_user_can_change_lead_status(lead_schema, current_user)

        # Check for assigned user before approving it
        self._validate_lead_assignment_for_approval(lead_schema, lead_entity)

        # Validate lead assignment
        self._validate_lead_assignment(lead_schema, current_user)

        # Validate assigned user and source user, if provided
        self._validate_user_existence(lead_schema.source, "source user")
        self._validate_user_existence(lead_schema.assigned_to, "assigned user")

        # Persist updated lead data in the database
        try:
            lead_entity_updated = self.repository.update(lead_entity, lead_schema)

            # Handle lead user creation
            user_entity = self._handle_user_creation(lead_entity_updated)
            if user_entity:
                lead_entity_updated = self._link_user_account_to_lead(
                    lead_entity_updated, user_entity.id
                )

            return lead_entity_updated
        except DatabaseOperationError:
            raise RepositoryError(
                "There was an issue updating the lead in the database."
            )

    @staticmethod
    def is_user_authorized_to_view_lead(
        user_entity: User, lead_entity: Lead, subordinates_ids: list[UUID]
    ) -> bool:
        """
        Check if the user is authorized to view the lead based on their role, assigned leads, and collaborations.

        Parameters
        ----------
        user_entity : User
            The user entity attempting to view the lead.
        lead_entity : Lead
            The lead entity to be viewed.
        subordinates_ids : list[UUID]
            List of user IDs representing subordinates of the user.

        Returns
        -------
        bool
            True if the user is authorized to view the lead, False otherwise.
        """

        # Check if the user has an Admin role or any special permissions
        if PermissionService.has_admin_privileges(user_entity):
            return True

        # Check if the user is directly assigned to the lead
        if lead_entity.assigned_to == user_entity.id:
            return True

        # Check if any of the subordinates are assigned to the lead
        if lead_entity.assigned_to in subordinates_ids:
            return True

        return False  # User is not authorized to view the lead

    def _can_assign_lead(self, assigned_to: UUID, current_user: User) -> bool:
        """
        Validates whether the current user has the necessary permissions to assign a lead.

        Parameters
        ----------
        assigned_to : UUID
            The UUID of the user to whom the lead is being assigned.
        current_user : User
            The user entity representing the current logged-in user.

        Returns
        -------
        bool
            True if the current user is allowed to assign the lead, False otherwise.
        """
        # Load required services
        role_service = self.service_locator.get_role_service()
        permission_service = self.service_locator.get_permission_service()

        # Check if the user has admin privileges
        if role_service.has_role_admin_privileges(current_user.role.name):
            return True

        # Check if the current user has the permission to assign leads
        if permission_service.has_user_lead_assign_permission(current_user):
            return True

        # Allow assignment to self if the user does not have explicit permissions for others
        if assigned_to == current_user.id:
            return True

        # If none of the above conditions are met, the user cannot assign leads
        return False

    def _ensure_user_can_change_lead_status(
        self, lead_schema: LeadUpdate, user_entity: User
    ):
        """
        Ensures the user has the necessary privileges to change the lead status.

        Parameters
        ----------
        lead_schema : LeadUpdate
            The schema containing the updated lead information.
        user_entity : User
            The user attempting to update the lead status.

        Raises
        ------
        ForbiddenError
            If the user doesn't have the necessary permissions to change the status.
        """
        # Load the Role Service
        role_service = self.service_locator.get_role_service()

        # Allow admin users to proceed without restriction
        if role_service.has_role_admin_privileges(user_entity.role.name):
            return

        # Check if the status is restricted for non-admin users
        restricted_statuses = [LeadStatusEnum.SIGNED_APPROVED]

        if lead_schema.status in restricted_statuses:
            raise ForbiddenError(
                f"You aren't authorized to change the status of the lead to `{lead_schema.status}`"
            )

    @staticmethod
    def can_edit_lead(lead_entity: Lead) -> bool:
        """
        Determine whether the lead is editable based on its current status.

        Parameters
        ----------
        lead_entity : Lead
            The lead model instance.

        Returns
        -------
        bool
            `True` if the lead is editable, otherwise `False`.
        """
        return lead_entity.status != LeadStatusEnum.SIGNED_APPROVED

    @staticmethod
    def _validate_lead_assignment_for_approval(
        lead_schema: LeadUpdate, lead_entity: Lead
    ):
        """
        Validate that the lead has an assigned user before marking it as approved.

        Parameters
        ----------
        lead_schema : LeadUpdate
            The schema containing the new status for the lead.
        lead_entity : Lead
            The existing Lead model instance.

        Raises
        ------
        ForbiddenError
            If the lead status is SIGNED_APPROVED and there is no assigned user.
        """
        if lead_schema.status == LeadStatusEnum.SIGNED_APPROVED and (
            lead_schema.assigned_to is None and lead_entity.assigned_to is None
        ):
            raise ForbiddenError(
                f"Lead must have an assigned user before marking it `{LeadStatusEnum.SIGNED_APPROVED}`."
            )

    def _validate_lead_assignment(
        self, lead_schema: LeadCreate | LeadUpdate, current_user: User
    ):
        """
        Validate lead assignment permission.

        Parameters
        ----------
        lead_schema : LeadCreate | LeadUpdate
            The schema containing the updated lead information.
        current_user : User
            The user performing the update action.

        Raises
        ------
        ForbiddenError
            If the user does not have permission to assign leads to other users.
        """
        if not self._can_assign_lead(lead_schema.assigned_to, current_user):
            raise ForbiddenError(
                "You do not have permission to assign leads to other users."
            )

    def _validate_user_existence(self, user_id: UUID, user_type: str):
        """
        Validate if a user exists by user ID.

        Parameters
        ----------
        user_id : UUID
            The unique identifier of the user to validate.
        user_type : str
            The type of user being validated.

        Raises
        ------
        EntityNotFoundError
            If the user with the specified ID does not exist.
        """
        if user_id:
            # Load user service
            user_service = self.service_locator.get_user_service()

            try:
                user_service.get_user_by_id(user_id)
            except EntityNotFoundError as e:
                raise EntityNotFoundError(
                    f"Lead update, {user_type} validation failed: {e}"
                ) from e

    def _handle_user_creation(self, lead_entity: Lead) -> User | None:
        """
        Handles user creation based on lead data if valid user data is provided.

        Parameters
        ----------
        lead_entity: Lead
            The lead entity containing potential user information.

        Returns
        -------
        User | None
            Returns the newly created user entity
        """
        # Check and return, if the lead has already created a user account
        if lead_entity.lead_user_id:
            return

        # Extract email and perform basic checks
        user_email = lead_entity.contact.email
        if not user_email:
            # No user creation if email is missing
            return

        # Load the user service
        user_service = self.service_locator.get_user_service()

        # Check if user already exists
        user_entity = user_service.get_user_by_email(user_email)
        if user_entity:
            return user_entity  # User already exists, no need to create again

        # Load the role service
        role_service = self.service_locator.get_role_service()

        # Extract name and role
        first_name, last_name = split_full_name(lead_entity.contact.full_name)
        password = generate_random_password()
        role_entity = role_service.get_role_by_name_or_create(RoleEnum.LEAD.value)

        # Prepare data for user creation
        data_dict = {
            "first_name": first_name,
            "last_name": last_name,
            "email": user_email,
            "password": password,
            "role_id": role_entity.id,
        }

        # Validate and create user if data is valid
        user_data = user_service.validate_create_user_fields(data_dict)
        if user_data:
            user_entity = user_service.create_user(user_data)

            # Sending an email for a newly created account
            self._send_user_creation_email(user_entity, password)

            return user_entity

    def _link_user_account_to_lead(self, lead_entity: Lead, lead_user_id: UUID) -> Lead:
        """
        Link a lead user account to a lead by updating the lead's user ID.

        Parameters
        ----------
        lead_entity : Lead
            The lead entity that needs to be updated with a user account.
        lead_user_id : UUID
            The UUID of the user that needs to be linked to the lead.

        Returns
        -------
        Lead
            The updated lead entity with the linked user account.
        """
        # Prepare the lead update schema with the provided lead user ID.
        lead_schema = LeadUpdate(lead_user_id=lead_user_id)

        # Update the lead entity using the repository and return the updated entity.
        return self.repository.update(lead_entity, lead_schema)

    def _route_lead_by_state(self, lead_entity: Lead) -> Lead:
        """
        Round-robin state-based lead routing.

        If the lead has no agent assigned yet, find ALL active agents whose
        user_meta.state matches the lead contact's loss-location state,
        pick the next one via a per-state rotation index stored in
        ``StateRotation``, assign the lead, and advance the pointer.
        """
        if lead_entity.assigned_to is not None:
            return lead_entity

        contact = lead_entity.contact
        if not contact:
            return lead_entity
        lead_state = contact.state_loss or contact.state
        if not lead_state:
            logger.info("Lead %s has no state — skipping state routing", lead_entity.id)
            return lead_entity

        lead_state_lower = lead_state.strip().lower()

        try:
            import uuid as _uuid
            from sqlalchemy import func, select
            from app.models import Role
            from app.models.user import User
            from app.models.user_meta import UserMeta
            from app.models.lead_distribution import StateRotation

            with self.repository.db_session as session:
                # 1. Fetch ALL eligible agents, ordered by id for stable ordering
                agents = list(
                    session.scalars(
                        select(User)
                        .join(UserMeta, User.id == UserMeta.user_id)
                        .join(Role, User.role_id == Role.id)
                        .where(
                            User.is_active.is_(True),
                            User.is_removed.is_(False),
                            Role.name == "agent",
                            func.lower(func.trim(UserMeta.state)) == lead_state_lower,
                        )
                        .order_by(User.id)
                    ).all()
                )

                if not agents:
                    logger.info(
                        "No active agent found in state '%s' for lead %s",
                        lead_state, lead_entity.id,
                    )
                    return lead_entity

                # 2. Get-or-create rotation state for this state
                rotation = session.scalar(
                    select(StateRotation).where(
                        StateRotation.state_code == lead_state_lower
                    )
                )
                if rotation is None:
                    rotation = StateRotation(
                        id=_uuid.uuid4(),
                        state_code=lead_state_lower,
                        rotation_index=0,
                    )
                    session.add(rotation)
                    session.flush()

                # 3. Pick next agent via round-robin
                idx = rotation.rotation_index % len(agents)
                chosen_agent = agents[idx]

                # 4. Assign lead and advance pointer
                lead_entity.assigned_to = chosen_agent.id
                rotation.rotation_index = idx + 1
                rotation.last_assigned_agent_id = chosen_agent.id

                session.add(lead_entity)
                session.add(rotation)
                session.commit()
                session.refresh(lead_entity)

                logger.info(
                    "Lead %s routed to agent %s [%d/%d] (state=%s)",
                    lead_entity.id, chosen_agent.id,
                    idx + 1, len(agents), lead_state,
                )
        except Exception:
            logger.exception(
                "State-based routing failed for lead %s — continuing",
                lead_entity.id,
            )

        return lead_entity

    def _auto_distribute_lead(self, lead_entity: Lead):
        """
        Attempt automatic territory matching, distribution, and delivery dispatch.
        Wrapped in try/except so lead creation never fails due to distribution errors.
        """
        if not self.service_locator:
            return
        try:
            delivery_service = self.service_locator.get_lead_delivery_service()
            delivery_service.auto_distribute_and_deliver(lead_entity.id, lead_entity)
        except Exception:
            logger.exception(
                "Auto-distribution failed for lead %s — lead creation still succeeded",
                lead_entity.id,
            )

    @staticmethod
    def _auto_skip_trace(lead_entity: Lead):
        """
        Trigger skip trace for leads with eligible perils.
        Wrapped in try/except so lead creation never fails due to skip trace errors.
        """
        SKIPTRACE_ELIGIBLE_PERILS = {
            "fire", "storm", "hail", "wind", "roof",
            "theft", "vandalism", "burglary",
        }
        if lead_entity.peril and lead_entity.peril.lower() in SKIPTRACE_ELIGIBLE_PERILS:
            try:
                from app.core.celery_app import celery_app
                celery_app.send_task(
                    "app.tasks.skip_trace.run_skiptrace_for_lead",
                    args=[str(lead_entity.id)],
                )
            except Exception:
                logger.warning(
                    "Failed to queue skip trace for lead %s", lead_entity.id,
                )

    @staticmethod
    def _send_user_creation_email(user_entity: User, password: str):
        """
        Asynchronously sends a user creation email to the lead using a Celery task.

        Parameters
        ----------
        user_entity : User
            The user entity containing the lead's information.
        password : str
            The password assigned to the lead's new account.
        """
        # Log the action
        logger.info(f"Scheduling email for new lead user account: {user_entity.email}")

        # Send the task to the Celery worker
        celery_app.send_task(
            "app.worker.new_lead_account_email", args=[user_entity, password]
        )
