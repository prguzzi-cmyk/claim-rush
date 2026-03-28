#!/usr/bin/env python

from enum import Enum

from fastapi import HTTPException, status

from app.utils.common import generate_permission


class Operations(Enum):
    """Basic operations for RBAC"""

    READ: str = "read"
    CREATE: str = "create"
    UPDATE: str = "update"
    REMOVE: str = "remove"
    READ_REMOVED: str = "read_removed"
    RESTORE: str = "restore"


class MiscOperations(Enum):
    """Miscellaneous operations for RBAC"""

    RUN: str = "run"
    ASSIGN_PERMISSION: str = "assign_permission"
    ASSIGN_LEAD: str = "assign_lead"


class Modules(Enum):
    """Modules name of the application"""

    UTIL: str = "util"
    PERMISSION: str = "permission"
    ROLE: str = "role"
    USER: str = "user"
    USER_POLICY: str = "user_policy"
    PROFILE: str = "profile"
    TAG: str = "tag"
    FILE: str = "file"
    USER_ACTIVITY: str = "user_activity"
    TASK: str = "task"
    SCHEDULE: str = "schedule"
    USER_TASK: str = "user_task"
    USER_PERSONAL_FILE: str = "user_personal_file"
    LEAD: str = "lead"
    LEAD_COMMENT: str = "lead_comment"
    LEAD_FILE: str = "lead_file"
    LEAD_TASK: str = "lead_task"
    CLIENT: str = "client"
    CLIENT_COMMENT: str = "client_comment"
    CLIENT_FILE: str = "client_file"
    CLIENT_TASK: str = "client_task"
    CLAIM: str = "claim"
    CLAIM_COMMENT: str = "claim_comment"
    CLAIM_FILE: str = "claim_file"
    CLAIM_FILE_SHARE: str = "claim_file_share"
    CLAIM_TASK: str = "claim_task"
    CLAIM_ACTIVITY: str = "claim_activity"
    CLAIM_COMMUNICATION: str = "claim_communication"
    CLAIM_PAYMENT: str = "claim_payment"
    CLAIM_PAYMENT_FILE: str = "claim_payment_file"
    NPO_INITIATIVE: str = "npo_initiative"
    PARTNERSHIP: str = "partnership"
    NETWORK: str = "network"
    NEWSLETTER: str = "newsletter"
    NEWSLETTER_FILE: str = "newsletter_file"
    ANNOUNCEMENT: str = "announcement"
    ANNOUNCEMENT_FILE: str = "announcement_file"
    ANNOUNCEMENT_ACTIVITY: str = "announcement_activity"
    TEMPLATE_FILE: str = "template_file"
    SHOP: str = "shop"
    SHOP_MANAGEMENT: str = "shop_management"
    WAITLIST: str = "waitlist"
    FIRE_AGENCY: str = "fire_agency"
    FIRE_INCIDENT: str = "fire_incident"
    CALL_TYPE_CONFIG: str = "call_type_config"
    FIRE_DATA_SOURCE_CONFIG: str = "fire_data_source_config"
    ESTIMATE_PROJECT: str = "estimate_project"
    FIRE_CLAIM: str = "fire_claim"
    FIRE_CLAIM_MEDIA: str = "fire_claim_media"
    STORM_EVENT: str = "storm_event"
    STORM_OUTREACH_BATCH: str = "storm_outreach_batch"
    TERRITORY: str = "territory"
    LEAD_OUTCOME: str = "lead_outcome"
    COMMUNICATION_LOG: str = "communication_log"
    CRIME_INCIDENT: str = "crime_incident"
    CRIME_DATA_SOURCE_CONFIG: str = "crime_data_source_config"
    ROOF_ANALYSIS: str = "roof_analysis"
    POTENTIAL_CLAIMS: str = "potential_claims"
    ADJUSTER_CASE: str = "adjuster_case"
    POLICY_DOCUMENT: str = "policy_document"
    ROTATION_LEAD: str = "rotation_lead"
    ROTATION_CONFIG: str = "rotation_config"
    OUTREACH_CAMPAIGN: str = "outreach_campaign"
    OUTREACH_TEMPLATE: str = "outreach_template"
    INSPECTION_SCHEDULE: str = "inspection_schedule"
    INSPECTION_AVAILABILITY: str = "inspection_availability"
    VOICE_CAMPAIGN: str = "voice_campaign"
    INCIDENT_INTELLIGENCE: str = "incident_intelligence"

    @classmethod
    def get_with_operations(cls) -> dict[str, list]:
        """
        Assign permissions to the modules.

        Returns
        -------
        dict
            Returns a dictionary consists of modules with their permissions
        """
        return {
            cls.UTIL.value: [
                MiscOperations.RUN.value,
            ],
            cls.PERMISSION.value: [op.value for op in Operations],
            cls.ROLE.value: [op.value for op in Operations]
            + [
                MiscOperations.ASSIGN_PERMISSION.value,
            ],
            cls.USER.value: [op.value for op in Operations],
            cls.USER_POLICY.value: [op.value for op in Operations],
            cls.PROFILE.value: [
                Operations.READ.value,
                Operations.UPDATE.value,
            ],
            cls.LEAD.value: [op.value for op in Operations]
            + [MiscOperations.ASSIGN_LEAD.value],
            cls.LEAD_COMMENT.value: [op.value for op in Operations],
            cls.LEAD_FILE.value: [op.value for op in Operations],
            cls.LEAD_TASK.value: [op.value for op in Operations],
            cls.CLIENT.value: [op.value for op in Operations],
            cls.CLIENT_COMMENT.value: [op.value for op in Operations],
            cls.CLIENT_FILE.value: [op.value for op in Operations],
            cls.USER_ACTIVITY.value: [op.value for op in Operations],
            cls.CLIENT_TASK.value: [op.value for op in Operations],
            cls.CLAIM.value: [op.value for op in Operations],
            cls.CLAIM_COMMENT.value: [op.value for op in Operations],
            cls.CLAIM_FILE.value: [op.value for op in Operations],
            cls.CLAIM_FILE_SHARE.value: [op.value for op in Operations],
            cls.CLAIM_TASK.value: [op.value for op in Operations],
            cls.CLAIM_ACTIVITY.value: [op.value for op in Operations],
            cls.CLAIM_COMMUNICATION.value: [op.value for op in Operations],
            cls.CLAIM_PAYMENT.value: [op.value for op in Operations],
            cls.CLAIM_PAYMENT_FILE.value: [op.value for op in Operations],
            cls.NPO_INITIATIVE.value: [op.value for op in Operations],
            cls.PARTNERSHIP.value: [op.value for op in Operations],
            cls.NETWORK.value: [op.value for op in Operations],
            cls.TASK.value: [op.value for op in Operations],
            cls.SCHEDULE.value: [op.value for op in Operations],
            cls.USER_TASK.value: [op.value for op in Operations],
            cls.USER_PERSONAL_FILE.value: [op.value for op in Operations],
            cls.TAG.value: [op.value for op in Operations],
            cls.FILE.value: [op.value for op in Operations],
            cls.NEWSLETTER.value: [op.value for op in Operations],
            cls.NEWSLETTER_FILE.value: [op.value for op in Operations],
            cls.ANNOUNCEMENT.value: [op.value for op in Operations],
            cls.ANNOUNCEMENT_FILE.value: [op.value for op in Operations],
            cls.ANNOUNCEMENT_ACTIVITY.value: [op.value for op in Operations],
            cls.TEMPLATE_FILE.value: [op.value for op in Operations],
            cls.FIRE_AGENCY.value: [op.value for op in Operations],
            cls.FIRE_INCIDENT.value: [
                Operations.READ.value,
                Operations.READ_REMOVED.value,
            ],
            cls.CALL_TYPE_CONFIG.value: [op.value for op in Operations],
            cls.FIRE_DATA_SOURCE_CONFIG.value: [op.value for op in Operations],
            cls.ESTIMATE_PROJECT.value: [op.value for op in Operations],
            cls.FIRE_CLAIM.value: [op.value for op in Operations],
            cls.FIRE_CLAIM_MEDIA.value: [op.value for op in Operations],
            cls.STORM_EVENT.value: [op.value for op in Operations],
            cls.STORM_OUTREACH_BATCH.value: [op.value for op in Operations],
            cls.TERRITORY.value: [op.value for op in Operations],
            cls.LEAD_OUTCOME.value: [op.value for op in Operations],
            cls.COMMUNICATION_LOG.value: [
                Operations.READ.value,
                Operations.CREATE.value,
            ],
            cls.CRIME_INCIDENT.value: [
                Operations.READ.value,
                Operations.READ_REMOVED.value,
            ],
            cls.CRIME_DATA_SOURCE_CONFIG.value: [op.value for op in Operations],
            cls.ROOF_ANALYSIS.value: [op.value for op in Operations],
            cls.POTENTIAL_CLAIMS.value: [
                Operations.READ.value,
            ],
            cls.ADJUSTER_CASE.value: [op.value for op in Operations],
            cls.POLICY_DOCUMENT.value: [op.value for op in Operations],
            cls.ROTATION_LEAD.value: [op.value for op in Operations],
            cls.ROTATION_CONFIG.value: [op.value for op in Operations],
            cls.OUTREACH_CAMPAIGN.value: [op.value for op in Operations],
            cls.OUTREACH_TEMPLATE.value: [op.value for op in Operations],
            cls.INSPECTION_SCHEDULE.value: [op.value for op in Operations],
            cls.INSPECTION_AVAILABILITY.value: [op.value for op in Operations],
            cls.VOICE_CAMPAIGN.value: [op.value for op in Operations],
            cls.INCIDENT_INTELLIGENCE.value: [op.value for op in Operations],
        }

    @classmethod
    def generate_module_permissions(
        cls,
        module: str,
        read_only: bool = False,
        additional_operations: list[str] | None = None,
    ) -> list[str]:
        """
        Generate module specific permissions.

        Parameters
        ----------
        module : str
            Module name
        read_only : bool
            Generate read-only permissions
        additional_operations : list
            Additional permissions for the module

        Returns
        -------
        list
            A list of generated module permissions.
        """
        if not hasattr(cls, module.upper()):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="A module with this name doesn't exist in the system.",
            )

        permissions = []

        operations = cls.generate_operations_list(read_only, additional_operations)
        for operation in operations:
            name = generate_permission(module=module, operation=operation)
            permissions.append(name)

        return permissions

    @classmethod
    def generate_operations_list(
        cls, read_only: bool = False, additional_operations: list[str] | None = None
    ) -> list[str]:
        """
        Generate a list consist of specific operations.

        Parameters
        ----------
        read_only : bool
            Consider read-only operations
        additional_operations : list
            Additional operations to append in the list

        Returns
        -------
        list
            A list of operations.
        """
        operations = []

        if read_only:
            operations.append(Operations.READ.value)
            operations.append(Operations.READ_REMOVED.value)
        else:
            operations.extend(op.value for op in Operations)

        if additional_operations:
            for add_operation in additional_operations:
                if not hasattr(MiscOperations, add_operation.upper()):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="An additional operation with this name "
                        "doesn't exist in the system.",
                    )

                operations.append(add_operation)

        return operations


class Roles(Enum):
    """Roles in the application"""

    SUPER_ADMIN: str = "Super Admin"
    ADMIN: str = "Admin"
    MANAGER: str = "Manager"
    AGENT: str = "Agent"
    SALES_REP: str = "Sales Rep"
    CLIENT: str = "Client"

    @classmethod
    def get_with_permissions(cls, permissions: dict[str, list]) -> dict[str, list]:
        """
        Combine permissions with roles.

        Parameters
        ----------
        permissions : dict
            A dictionary consists of module-wise permission objects

        Returns
        -------
        dict
            Returns a dictionary consists of permissions and roles.
        """
        return {
            # Super Admin permissions
            cls.SUPER_ADMIN.value: permissions[Modules.UTIL.value]
            + permissions[Modules.PERMISSION.value]
            + permissions[Modules.ROLE.value]
            + permissions[Modules.USER.value]
            + permissions[Modules.USER_POLICY.value]
            + permissions[Modules.PROFILE.value]
            + permissions[Modules.TAG.value]
            + permissions[Modules.FILE.value]
            + permissions[Modules.USER_ACTIVITY.value]
            + permissions[Modules.TASK.value]
            + permissions[Modules.SCHEDULE.value]
            + permissions[Modules.USER_TASK.value]
            + permissions[Modules.USER_PERSONAL_FILE.value]
            + permissions[Modules.LEAD.value]
            + permissions[Modules.LEAD_COMMENT.value]
            + permissions[Modules.LEAD_FILE.value]
            + permissions[Modules.LEAD_TASK.value]
            + permissions[Modules.CLIENT.value]
            + permissions[Modules.CLIENT_COMMENT.value]
            + permissions[Modules.CLIENT_FILE.value]
            + permissions[Modules.CLIENT_TASK.value]
            + permissions[Modules.CLAIM.value]
            + permissions[Modules.CLAIM_COMMENT.value]
            + permissions[Modules.CLAIM_FILE.value]
            + permissions[Modules.CLAIM_FILE_SHARE.value]
            + permissions[Modules.CLAIM_TASK.value]
            + permissions[Modules.CLAIM_ACTIVITY.value]
            + permissions[Modules.CLAIM_PAYMENT.value]
            + permissions[Modules.CLAIM_PAYMENT_FILE.value]
            + permissions[Modules.NPO_INITIATIVE.value]
            + permissions[Modules.PARTNERSHIP.value]
            + permissions[Modules.NETWORK.value]
            + permissions[Modules.NEWSLETTER.value]
            + permissions[Modules.NEWSLETTER_FILE.value]
            + permissions[Modules.ANNOUNCEMENT.value]
            + permissions[Modules.ANNOUNCEMENT_FILE.value]
            + permissions[Modules.ANNOUNCEMENT_ACTIVITY.value]
            + permissions[Modules.TEMPLATE_FILE.value]
            + permissions[Modules.FIRE_AGENCY.value]
            + permissions[Modules.FIRE_INCIDENT.value]
            + permissions[Modules.CALL_TYPE_CONFIG.value]
            + permissions[Modules.FIRE_DATA_SOURCE_CONFIG.value]
            + permissions[Modules.ESTIMATE_PROJECT.value]
            + permissions[Modules.FIRE_CLAIM.value]
            + permissions[Modules.FIRE_CLAIM_MEDIA.value]
            + permissions[Modules.STORM_EVENT.value]
            + permissions[Modules.STORM_OUTREACH_BATCH.value]
            + permissions[Modules.TERRITORY.value]
            + permissions[Modules.LEAD_OUTCOME.value]
            + permissions[Modules.COMMUNICATION_LOG.value]
            + permissions[Modules.CRIME_INCIDENT.value]
            + permissions[Modules.CRIME_DATA_SOURCE_CONFIG.value]
            + permissions[Modules.ROOF_ANALYSIS.value]
            + permissions[Modules.POTENTIAL_CLAIMS.value]
            + permissions[Modules.ADJUSTER_CASE.value]
            + permissions[Modules.POLICY_DOCUMENT.value]
            + permissions[Modules.CLAIM_COMMUNICATION.value]
            + permissions[Modules.ROTATION_LEAD.value]
            + permissions[Modules.ROTATION_CONFIG.value]
            + permissions[Modules.OUTREACH_CAMPAIGN.value]
            + permissions[Modules.OUTREACH_TEMPLATE.value]
            + permissions[Modules.INSPECTION_SCHEDULE.value]
            + permissions[Modules.INSPECTION_AVAILABILITY.value]
            + permissions[Modules.VOICE_CAMPAIGN.value]
            + permissions[Modules.INCIDENT_INTELLIGENCE.value],
            # Admin permissions
            # TODO: Read only for roles
            cls.ADMIN.value: permissions[Modules.USER.value]
            + permissions[Modules.USER_POLICY.value]
            + permissions[Modules.PROFILE.value]
            + permissions[Modules.TAG.value]
            + permissions[Modules.FILE.value]
            + permissions[Modules.USER_ACTIVITY.value]
            + permissions[Modules.TASK.value]
            + permissions[Modules.SCHEDULE.value]
            + permissions[Modules.USER_TASK.value]
            + permissions[Modules.USER_PERSONAL_FILE.value]
            + permissions[Modules.LEAD.value]
            + permissions[Modules.LEAD_COMMENT.value]
            + permissions[Modules.LEAD_FILE.value]
            + permissions[Modules.LEAD_TASK.value]
            + permissions[Modules.CLIENT.value]
            + permissions[Modules.CLIENT_COMMENT.value]
            + permissions[Modules.CLIENT_FILE.value]
            + permissions[Modules.CLIENT_TASK.value]
            + permissions[Modules.CLAIM.value]
            + permissions[Modules.CLAIM_COMMENT.value]
            + permissions[Modules.CLAIM_FILE.value]
            + permissions[Modules.CLAIM_FILE_SHARE.value]
            + permissions[Modules.CLAIM_TASK.value]
            + permissions[Modules.CLAIM_ACTIVITY.value]
            + permissions[Modules.CLAIM_PAYMENT.value]
            + permissions[Modules.CLAIM_PAYMENT_FILE.value]
            + permissions[Modules.NPO_INITIATIVE.value]
            + permissions[Modules.PARTNERSHIP.value]
            + permissions[Modules.NETWORK.value]
            + permissions[Modules.NEWSLETTER.value]
            + permissions[Modules.NEWSLETTER_FILE.value]
            + permissions[Modules.ANNOUNCEMENT.value]
            + permissions[Modules.ANNOUNCEMENT_FILE.value]
            + permissions[Modules.ANNOUNCEMENT_ACTIVITY.value]
            + permissions[Modules.TEMPLATE_FILE.value]
            + permissions[Modules.FIRE_AGENCY.value]
            + permissions[Modules.FIRE_INCIDENT.value]
            + permissions[Modules.CALL_TYPE_CONFIG.value]
            + permissions[Modules.FIRE_DATA_SOURCE_CONFIG.value]
            + permissions[Modules.ESTIMATE_PROJECT.value]
            + permissions[Modules.FIRE_CLAIM.value]
            + permissions[Modules.FIRE_CLAIM_MEDIA.value]
            + permissions[Modules.STORM_EVENT.value]
            + permissions[Modules.STORM_OUTREACH_BATCH.value]
            + permissions[Modules.TERRITORY.value]
            + permissions[Modules.LEAD_OUTCOME.value]
            + permissions[Modules.COMMUNICATION_LOG.value]
            + permissions[Modules.CRIME_INCIDENT.value]
            + permissions[Modules.CRIME_DATA_SOURCE_CONFIG.value]
            + permissions[Modules.ROOF_ANALYSIS.value]
            + permissions[Modules.POTENTIAL_CLAIMS.value]
            + permissions[Modules.ADJUSTER_CASE.value]
            + permissions[Modules.POLICY_DOCUMENT.value]
            + permissions[Modules.CLAIM_COMMUNICATION.value]
            + permissions[Modules.ROTATION_LEAD.value]
            + permissions[Modules.ROTATION_CONFIG.value]
            + permissions[Modules.OUTREACH_CAMPAIGN.value]
            + permissions[Modules.OUTREACH_TEMPLATE.value]
            + permissions[Modules.INSPECTION_SCHEDULE.value]
            + permissions[Modules.INSPECTION_AVAILABILITY.value]
            + permissions[Modules.VOICE_CAMPAIGN.value]
            + permissions[Modules.INCIDENT_INTELLIGENCE.value],
            # Manager permissions
            cls.MANAGER.value: permissions[Modules.PROFILE.value]
            + permissions[Modules.USER_POLICY.value]
            + permissions[Modules.USER_ACTIVITY.value]
            + permissions[Modules.USER_TASK.value]
            + permissions[Modules.USER_PERSONAL_FILE.value]
            + permissions[Modules.LEAD.value]
            + permissions[Modules.LEAD_COMMENT.value]
            + permissions[Modules.LEAD_FILE.value]
            + permissions[Modules.LEAD_TASK.value]
            + permissions[Modules.CLIENT.value]
            + permissions[Modules.CLIENT_COMMENT.value]
            + permissions[Modules.CLIENT_FILE.value]
            + permissions[Modules.CLIENT_TASK.value]
            + permissions[Modules.CLAIM.value]
            + permissions[Modules.CLAIM_COMMENT.value]
            + permissions[Modules.CLAIM_FILE.value]
            + permissions[Modules.CLAIM_FILE_SHARE.value]
            + permissions[Modules.CLAIM_TASK.value]
            + permissions[Modules.CLAIM_ACTIVITY.value]
            + permissions[Modules.ANNOUNCEMENT_ACTIVITY.value]
            + permissions[Modules.TEMPLATE_FILE.value]
            + permissions[Modules.FIRE_INCIDENT.value]
            + permissions[Modules.ESTIMATE_PROJECT.value]
            + permissions[Modules.FIRE_CLAIM.value]
            + permissions[Modules.FIRE_CLAIM_MEDIA.value]
            + permissions[Modules.STORM_EVENT.value]
            + permissions[Modules.STORM_OUTREACH_BATCH.value]
            + permissions[Modules.TERRITORY.value]
            + permissions[Modules.LEAD_OUTCOME.value]
            + permissions[Modules.COMMUNICATION_LOG.value]
            + permissions[Modules.CRIME_INCIDENT.value]
            + permissions[Modules.ROOF_ANALYSIS.value]
            + permissions[Modules.POTENTIAL_CLAIMS.value]
            + permissions[Modules.ADJUSTER_CASE.value]
            + permissions[Modules.POLICY_DOCUMENT.value]
            + permissions[Modules.CLAIM_COMMUNICATION.value]
            + permissions[Modules.ROTATION_LEAD.value]
            + permissions[Modules.OUTREACH_CAMPAIGN.value]
            + permissions[Modules.OUTREACH_TEMPLATE.value]
            + permissions[Modules.INSPECTION_SCHEDULE.value]
            + permissions[Modules.INSPECTION_AVAILABILITY.value]
            + permissions[Modules.VOICE_CAMPAIGN.value]
            + permissions[Modules.INCIDENT_INTELLIGENCE.value],
            # Agent permissions
            cls.AGENT.value: permissions[Modules.PROFILE.value]
            + permissions[Modules.USER_POLICY.value]
            + permissions[Modules.USER_ACTIVITY.value]
            + permissions[Modules.USER_TASK.value]
            + permissions[Modules.USER_PERSONAL_FILE.value]
            + permissions[Modules.LEAD.value]
            + permissions[Modules.LEAD_COMMENT.value]
            + permissions[Modules.LEAD_FILE.value]
            + permissions[Modules.LEAD_TASK.value]
            + permissions[Modules.CLIENT.value]
            + permissions[Modules.CLIENT_COMMENT.value]
            + permissions[Modules.CLIENT_FILE.value]
            + permissions[Modules.CLIENT_TASK.value]
            + permissions[Modules.CLAIM.value]
            + permissions[Modules.CLAIM_COMMENT.value]
            + permissions[Modules.CLAIM_FILE.value]
            + permissions[Modules.CLAIM_FILE_SHARE.value]
            + permissions[Modules.CLAIM_TASK.value]
            + permissions[Modules.CLAIM_ACTIVITY.value]
            + permissions[Modules.ANNOUNCEMENT_ACTIVITY.value]
            + permissions[Modules.TEMPLATE_FILE.value]
            + permissions[Modules.FIRE_INCIDENT.value]
            + permissions[Modules.ESTIMATE_PROJECT.value]
            + permissions[Modules.FIRE_CLAIM.value]
            + permissions[Modules.FIRE_CLAIM_MEDIA.value]
            + permissions[Modules.STORM_EVENT.value]
            + permissions[Modules.STORM_OUTREACH_BATCH.value]
            + permissions[Modules.TERRITORY.value]
            + permissions[Modules.LEAD_OUTCOME.value]
            + permissions[Modules.COMMUNICATION_LOG.value]
            + permissions[Modules.CRIME_INCIDENT.value]
            + permissions[Modules.ROOF_ANALYSIS.value]
            + permissions[Modules.POTENTIAL_CLAIMS.value]
            + permissions[Modules.ADJUSTER_CASE.value]
            + permissions[Modules.POLICY_DOCUMENT.value]
            + permissions[Modules.CLAIM_COMMUNICATION.value]
            + permissions[Modules.ROTATION_LEAD.value]
            + permissions[Modules.OUTREACH_CAMPAIGN.value]
            + permissions[Modules.OUTREACH_TEMPLATE.value]
            + permissions[Modules.INSPECTION_SCHEDULE.value]
            + permissions[Modules.INSPECTION_AVAILABILITY.value]
            + permissions[Modules.VOICE_CAMPAIGN.value]
            + permissions[Modules.INCIDENT_INTELLIGENCE.value],
            # Sales Rep permissions (read-only on claims and related modules)
            cls.SALES_REP.value: permissions[Modules.PROFILE.value]
            + permissions[Modules.CLAIM.value]
            + permissions[Modules.CLAIM_COMMENT.value]
            + permissions[Modules.CLAIM_FILE.value]
            + permissions[Modules.CLAIM_ACTIVITY.value]
            + permissions[Modules.CLAIM_PAYMENT.value]
            + permissions[Modules.CLIENT.value]
            + permissions[Modules.CLAIM_COMMUNICATION.value],
            # Client permissions (restricted read-only + messaging)
            cls.CLIENT.value: permissions[Modules.PROFILE.value]
            + permissions[Modules.CLAIM.value]
            + permissions[Modules.CLAIM_COMMENT.value]
            + permissions[Modules.CLAIM_FILE.value]
            + permissions[Modules.CLAIM_ACTIVITY.value]
            + permissions[Modules.CLAIM_PAYMENT.value]
            + permissions[Modules.CLAIM_COMMUNICATION.value],
        }
