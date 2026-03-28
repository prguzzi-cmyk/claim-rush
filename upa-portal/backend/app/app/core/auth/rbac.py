#!/usr/bin/env python

from app.core.auth.enums import RoleEnum, ModuleEnum, OperationEnum, MiscOperationEnum


class RolePermissions:
    """
    Class representing the permissions assigned to each role.

    Attributes
    ----------
    role_permissions : dict[RoleEnum, dict[ModuleEnum, list[OperationEnum]]]
        Mapping of roles to modules and their respective permissions.
    """

    role_permissions: dict[RoleEnum, dict[ModuleEnum, list[OperationEnum]]] = {}

    @classmethod
    def _set_role_permissions(cls, role: RoleEnum, excluded_modules: list[ModuleEnum]):
        """
        Helper method to set permissions for a given role.

        Parameters
        ----------
        role : RoleEnum
            The role for which to set permissions.
        excluded_modules : list[ModuleEnum]
            Modules to exclude from the given role's permissions.
        """
        cls.role_permissions[role] = {
            module: [*OperationEnum]
            for module in ModuleEnum
            if module not in excluded_modules
        }

    @classmethod
    def _customize_permissions(
        cls, role: RoleEnum, custom_permissions: dict[ModuleEnum, list[OperationEnum]]
    ):
        """
        Helper method to apply custom permissions for specific modules with in a role.

        Parameters
        ----------
        role : RoleEnum
            The role to which custom permission are applied.
        custom_permissions : dict[ModuleEnum, list[OperationEnum]]
            A dictionary mapping specific modules to their respective permissions.
        """
        for module, operations in custom_permissions.items():
            if role in cls.role_permissions:
                cls.role_permissions[role][module] = operations
            else:
                cls.role_permissions[role] = {module: operations}

    @classmethod
    def _get_readonly_operations(cls) -> list[OperationEnum]:
        """
        Helper method to get readonly operations.

        Returns
        -------
        list[OperationEnum]
            The list consist of read related operations.
        """
        return [OperationEnum.READ, OperationEnum.READ_REMOVED]

    @classmethod
    def initialize_role_permissions(cls):
        """
        Initialize the permissions for all roles.
        """

        # Application default custom permissions
        profile_permissions = {
            ModuleEnum.PROFILE: [OperationEnum.READ, OperationEnum.UPDATE]
        }
        lead_permissions = {
            ModuleEnum.LEAD: [*OperationEnum, MiscOperationEnum.ASSIGN_LEAD]
        }

        # Set permissions for Super Admin
        cls._set_role_permissions(role=RoleEnum.SUPER_ADMIN, excluded_modules=[])

        # Set custom permissions for Super Admin
        communication_log_permissions = {
            ModuleEnum.COMMUNICATION_LOG: [OperationEnum.READ, OperationEnum.CREATE],
        }

        crime_incident_readonly = {
            ModuleEnum.CRIME_INCIDENT: cls._get_readonly_operations(),
        }

        roof_analysis_full = {
            ModuleEnum.ROOF_ANALYSIS: [*OperationEnum],
        }

        super_admin_custom_permissions = {
            ModuleEnum.UTIL: [MiscOperationEnum.RUN],
            ModuleEnum.ROLE: [*OperationEnum, MiscOperationEnum.ASSIGN_PERMISSION],
            **profile_permissions,
            **lead_permissions,
            **communication_log_permissions,
            **crime_incident_readonly,
            **roof_analysis_full,
        }
        cls._customize_permissions(RoleEnum.SUPER_ADMIN, super_admin_custom_permissions)

        # Set permissions for Admin
        admin_excluded_modules = [
            ModuleEnum.UTIL,
            ModuleEnum.PERMISSION,
            ModuleEnum.ROLE,
        ]
        cls._set_role_permissions(
            role=RoleEnum.ADMIN, excluded_modules=admin_excluded_modules
        )

        # Set custom permissions for Admin
        admin_custom_permissions = {
            **profile_permissions,
            **lead_permissions,
            **communication_log_permissions,
            **crime_incident_readonly,
            **roof_analysis_full,
        }
        cls._customize_permissions(RoleEnum.ADMIN, admin_custom_permissions)

        # Set permissions for Manager
        manager_excluded_modules = [
            ModuleEnum.UTIL,
            ModuleEnum.PERMISSION,
            ModuleEnum.ROLE,
            ModuleEnum.USER,
            ModuleEnum.USER_POLICY,
            ModuleEnum.TASK,
            ModuleEnum.SCHEDULE,
            ModuleEnum.SHOP,
            ModuleEnum.SHOP_MANAGEMENT,
            ModuleEnum.CRIME_DATA_SOURCE_CONFIG,
        ]
        cls._set_role_permissions(
            role=RoleEnum.MANAGER, excluded_modules=manager_excluded_modules
        )

        # Set custom permissions for Manager
        manager_custom_permissions = {
            **profile_permissions,
            **lead_permissions,
            **communication_log_permissions,
            ModuleEnum.TAG: cls._get_readonly_operations(),
            ModuleEnum.FILE: cls._get_readonly_operations(),
            ModuleEnum.NPO_INITIATIVE: cls._get_readonly_operations(),
            ModuleEnum.PARTNERSHIP: cls._get_readonly_operations(),
            ModuleEnum.NETWORK: cls._get_readonly_operations(),
            ModuleEnum.NEWSLETTER: cls._get_readonly_operations(),
            ModuleEnum.NEWSLETTER_FILE: cls._get_readonly_operations(),
            ModuleEnum.ANNOUNCEMENT: cls._get_readonly_operations(),
            ModuleEnum.ANNOUNCEMENT_FILE: cls._get_readonly_operations(),
            ModuleEnum.ANNOUNCEMENT_ACTIVITY: cls._get_readonly_operations(),
            **crime_incident_readonly,
            ModuleEnum.ROOF_ANALYSIS: cls._get_readonly_operations(),
        }
        cls._customize_permissions(RoleEnum.MANAGER, manager_custom_permissions)

        # Set permissions for Agent
        agent_excluded_modules = [
            ModuleEnum.UTIL,
            ModuleEnum.PERMISSION,
            ModuleEnum.ROLE,
            ModuleEnum.USER,
            ModuleEnum.USER_POLICY,
            ModuleEnum.TASK,
            ModuleEnum.SCHEDULE,
            ModuleEnum.CLAIM_PAYMENT,
            ModuleEnum.CLAIM_PAYMENT_FILE,
            ModuleEnum.SHOP,
            ModuleEnum.SHOP_MANAGEMENT,
            ModuleEnum.CRIME_DATA_SOURCE_CONFIG,
        ]
        cls._set_role_permissions(
            role=RoleEnum.AGENT, excluded_modules=agent_excluded_modules
        )

        # Set custom permissions for Agent
        agent_custom_permissions = {
            **profile_permissions,
            **lead_permissions,
            **communication_log_permissions,
            ModuleEnum.TAG: cls._get_readonly_operations(),
            ModuleEnum.FILE: cls._get_readonly_operations(),
            ModuleEnum.NPO_INITIATIVE: cls._get_readonly_operations(),
            ModuleEnum.PARTNERSHIP: cls._get_readonly_operations(),
            ModuleEnum.NETWORK: cls._get_readonly_operations(),
            ModuleEnum.NEWSLETTER: cls._get_readonly_operations(),
            ModuleEnum.NEWSLETTER_FILE: cls._get_readonly_operations(),
            ModuleEnum.ANNOUNCEMENT: cls._get_readonly_operations(),
            ModuleEnum.ANNOUNCEMENT_FILE: cls._get_readonly_operations(),
            ModuleEnum.ANNOUNCEMENT_ACTIVITY: cls._get_readonly_operations(),
            **crime_incident_readonly,
            ModuleEnum.ROOF_ANALYSIS: cls._get_readonly_operations(),
        }
        cls._customize_permissions(RoleEnum.AGENT, agent_custom_permissions)

        # Set permissions for Sales Rep (minimal read-only access)
        cls.role_permissions[RoleEnum.SALES_REP] = {}
        sales_rep_custom_permissions = {
            **profile_permissions,
            ModuleEnum.CLAIM: cls._get_readonly_operations(),
            ModuleEnum.CLAIM_COMMENT: [OperationEnum.READ],
            ModuleEnum.CLAIM_FILE: [OperationEnum.READ],
            ModuleEnum.CLAIM_ACTIVITY: [OperationEnum.READ],
            ModuleEnum.CLAIM_PAYMENT: [OperationEnum.READ],
            ModuleEnum.CLAIM_TASK: [OperationEnum.READ],
            ModuleEnum.CLIENT: [OperationEnum.READ],
        }
        cls._customize_permissions(RoleEnum.SALES_REP, sales_rep_custom_permissions)

        # Set permissions for Client (restricted read-only + messaging)
        cls.role_permissions[RoleEnum.CLIENT] = {}
        client_custom_permissions = {
            **profile_permissions,
            ModuleEnum.CLAIM: [OperationEnum.READ],
            ModuleEnum.CLAIM_COMMENT: [OperationEnum.READ, OperationEnum.CREATE],
            ModuleEnum.CLAIM_FILE: [OperationEnum.READ],
            ModuleEnum.CLAIM_ACTIVITY: [OperationEnum.READ],
            ModuleEnum.CLAIM_PAYMENT: [OperationEnum.READ],
        }
        cls._customize_permissions(RoleEnum.CLIENT, client_custom_permissions)

    @classmethod
    def get_permissions_for_role(
        cls, role: RoleEnum
    ) -> dict[ModuleEnum, list[OperationEnum]]:
        """
        Retrieve permissions for a specific role.

        Parameters
        ----------
        role : RoleEnum
            The role for which to retrieve permissions.

        Returns
        -------
        dict[ModuleEnum, list[OperationEnum]]
            The modules and their corresponding permissions allowed for the given role.
        """
        return cls.role_permissions.get(role, {})


# Initialize the permissions for roles when the module is loaded.
RolePermissions.initialize_role_permissions()
