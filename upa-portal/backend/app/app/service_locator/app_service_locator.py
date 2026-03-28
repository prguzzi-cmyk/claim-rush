#!/usr/bin/env python

from app.repositories import (
    RoleRepository,
    PermissionRepository,
    UserRepository,
    ClaimRepository,
    LeadRepository,
    UserPolicyRepository,
)

from app.service_locator import ServiceLocator

from app.services import (
    RoleService,
    PermissionService,
    UserService,
    ClaimService,
    LeadService,
    UserPolicyService,
)
from app.services.lead_delivery_service import LeadDeliveryService
from app.services.lead_outcome_service import LeadOutcomeService
from app.services.communication_service import CommunicationService


class AppServiceLocator(ServiceLocator):
    """
    Service locator specific to the application, automatically handling service creation.
    """

    def get_permission_service(self) -> PermissionService:
        """
        Retrieves the PermissionService instance.

        Returns
        -------
        PermissionService
            The service instance for managing permissions.
        """
        return self.register_service(self, PermissionService, PermissionRepository)

    def get_role_service(self) -> RoleService:
        """
        Retrieves the RoleService instance.

        Returns
        -------
        RoleService
            The service instance for managing roles.
        """
        return self.register_service(self, RoleService, RoleRepository)

    def get_user_service(self) -> UserService:
        """
        Retrieves the UserService instance.

        Returns
        -------
        UserService
            The service instance for managing users.
        """
        return self.register_service(self, UserService, UserRepository)

    def get_user_policy_service(self) -> UserPolicyService:
        """
        Retrieves the UserPolicyService instance.

        Returns
        -------
        UserPolicyService
            The service instance for managing user policies.
        """
        return self.register_service(self, UserPolicyService, UserPolicyRepository)

    def get_lead_service(self) -> LeadService:
        """
        Retrieves the LeadService instance.

        Returns
        -------
        LeadService
            The service instance for managing leads.
        """
        return self.register_service(self, LeadService, LeadRepository)

    def get_claim_service(self) -> ClaimService:
        """
        Retrieves the ClaimService instance.

        Returns
        -------
        ClaimService
            The service instance for managing claims.
        """
        return self.register_service(self, ClaimService, ClaimRepository)

    def get_lead_delivery_service(self) -> LeadDeliveryService:
        """
        Retrieves the LeadDeliveryService instance.

        Returns
        -------
        LeadDeliveryService
            The service instance for auto-distributing and delivering leads.
        """
        service_name = LeadDeliveryService.__name__
        if service_name not in self._services:
            self._services[service_name] = LeadDeliveryService(self.db_session)
        return self._services[service_name]

    def get_lead_outcome_service(self) -> LeadOutcomeService:
        """
        Retrieves the LeadOutcomeService instance.

        Returns
        -------
        LeadOutcomeService
            The service instance for recording lead outcomes.
        """
        service_name = LeadOutcomeService.__name__
        if service_name not in self._services:
            self._services[service_name] = LeadOutcomeService(self.db_session)
        return self._services[service_name]

    def get_communication_service(self) -> CommunicationService:
        service_name = CommunicationService.__name__
        if service_name not in self._services:
            self._services[service_name] = CommunicationService(self.db_session)
        return self._services[service_name]
