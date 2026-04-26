#!/usr/bin/env python

from enum import Enum


class RoleEnum(Enum):
    """Enum representing different roles in the system."""

    SUPER_ADMIN: str = "super-admin"
    ADMIN: str = "admin"
    MANAGER: str = "manager"
    AGENT: str = "agent"
    LEAD: str = "lead"
    CLIENT: str = "client"
    SALES_REP: str = "sales-rep"
    # Public-adjusting hierarchy roles (commission engine domain).
    # Lowercase slugs, consistent with the rest of the enum.
    CP: str = "cp"            # Chapter President
    RVP: str = "rvp"           # Regional Vice President
    ADJUSTER: str = "adjuster"


class OperationEnum(Enum):
    """Enum representing different operations for modules."""

    READ: str = "read"
    CREATE: str = "create"
    UPDATE: str = "update"
    REMOVE: str = "remove"
    READ_REMOVED: str = "read_removed"
    RESTORE: str = "restore"


class MiscOperationEnum(Enum):
    """Enum representing different miscellaneous operations for modules."""

    RUN: str = "run"
    ASSIGN_PERMISSION: str = "assign_permission"
    ASSIGN_LEAD: str = "assign_lead"


class ModuleEnum(Enum):
    """Enum representing different modules in the system."""

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
    USER_PERSONAL_FILE: str = "user_personal_file"
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
    COMMUNICATION_LOG: str = "communication_log"
    LEAD_OUTCOME: str = "lead_outcome"
    CRIME_INCIDENT: str = "crime_incident"
    CRIME_DATA_SOURCE_CONFIG: str = "crime_data_source_config"
    ROOF_ANALYSIS: str = "roof_analysis"
    OUTREACH_CAMPAIGN: str = "outreach_campaign"
    OUTREACH_TEMPLATE: str = "outreach_template"


class PolicyEffectEnum(str, Enum):
    """Enum representing different policy effects in the system."""

    DENY: str = "deny"
    PERMIT: str = "permit"
