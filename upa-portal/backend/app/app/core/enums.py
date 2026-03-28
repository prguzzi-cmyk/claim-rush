#!/usr/bin/env python

"""Different types of Tags"""

from enum import Enum


class Tags(Enum):
    auth: str = "Auth"
    utils: str = "Utils"
    system: str = "System"
    dashboard: str = "Dashboard"
    permissions: str = "Permissions"
    roles: str = "Roles"
    users: str = "Users"
    user_policies: str = "User Policies"
    tags: str = "Tags"
    files: str = "Files"
    user_activities: str = "User Activities"
    tasks: str = "Tasks"
    schedules: str = "Schedules"
    user_tasks: str = "User Tasks"
    leads: str = "Leads"
    lead_comments: str = "Lead Comments"
    lead_files: str = "Lead Files"
    lead_tasks: str = "Lead Tasks"
    clients: str = "Clients"
    client_comments: str = "Client Comments"
    client_files: str = "Client Files"
    client_tasks: str = "Client Tasks"
    claims: str = "Claims"
    claim_comments: str = "Claim Comments"
    claim_files: str = "Claim Files"
    claim_files_share: str = "Claim Files Share"
    claim_tasks: str = "Claim Tasks"
    claim_activities: str = "Claim Activities"
    claim_communications: str = "Claim Communications"
    claim_payments: str = "Claim Payments"
    claim_payment_files: str = "Claim Payment Files"
    npo_initiatives: str = "NPO Initiatives"
    partnerships: str = "Partnerships"
    networking: str = "Networking"
    newsletters: str = "Newsletters"
    newsletter_files: str = "Newsletter Files"
    announcements: str = "Announcements"
    announcement_files: str = "Announcement Files"
    announcement_activities: str = "Announcement Activities"
    reports: str = "Reports"
    user_reports: str = "User Reports"
    user_personal_file: str = "User-Personal-File"
    lead_reports: str = "Lead Reports"
    client_reports: str = "Client Reports"
    claim_reports: str = "Claim Reports"
    business_emails: str = "Business Emails"
    template_files: str = "Template Files"
    categories: str = "Categories"
    products: str = "Products"
    carts: str = "Carts"
    masters: str = "Masters"
    accounts: str = "Accounts"
    account_details: str = "Account Details"
    orders: str = "Orders"
    ai_estimate: str = "ai-estimate"
    fire_agencies: str = "Fire Agencies"
    fire_incidents: str = "Fire Incidents"
    call_type_configs: str = "Call Type Configs"
    fire_data_source_configs: str = "Fire Data Source Configs"
    estimate_projects: str = "Estimate Projects"
    estimate_photos: str = "Estimate Photos"
    pricing: str = "Pricing"
    pricing_versions: str = "Pricing Versions"
    fire_claims: str = "Fire Claims"
    fire_claim_media: str = "Fire Claim Media"
    storm_events: str = "Storm Events"
    territories: str = "Territories"
    public_territories: str = "Public Territories"
    lead_distribution: str = "Lead Distribution"
    lead_outcomes: str = "Lead Outcomes"
    notifications: str = "Notifications"
    communications: str = "Communications"
    webhooks: str = "Webhooks"
    escalation: str = "Escalation"
    lead_intake: str = "Lead Intake"
    agent_dashboard: str = "Agent Dashboard"
    crime_incidents: str = "Crime Incidents"
    crime_data_sources: str = "Crime Data Sources"
    roof_analysis: str = "Roof Analysis"
    potential_claims: str = "Potential Claims"
    adjuster_cases: str = "Adjuster Cases"
    skiptrace_wallet: str = "Skip Trace Wallet"
    lead_skip_trace: str = "Lead Skip Trace"
    policy_documents: str = "Policy Documents"
    carrier_comparison: str = "Carrier Comparison"
    carrier_payments: str = "Carrier Payments"
    defense_notes: str = "Defense Notes"
    voice_outreach: str = "Voice Outreach"
    claim_recovery: str = "Claim Recovery"
    rotation_leads: str = "Rotation Leads"
    rotation_config: str = "Rotation Config"
    outreach: str = "Outreach"
    inspection_scheduling: str = "Inspection Scheduling"
    voice_campaigns: str = "Voice Campaigns"
    campaign_steps: str = "Campaign Steps"
    platform_activity: str = "Platform Activity"
    ai_intake: str = "AI Intake"
    communications_hub: str = "Communications Hub"
    incident_intelligence: str = "Incident Intelligence"
    lead_rescue: str = "Lead Rescue"
    intake_config: str = "Intake Config"


class CampaignType(str, Enum):
    AI_VOICE = "ai_voice"
    SMS = "sms"
    EMAIL = "email"
    MULTI_STEP = "multi_step"


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class EstimateMode(str, Enum):
    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial"
    RESTORATION = "restoration"
    CONTENTS = "contents"
    SUPPLEMENT = "supplement"


class FileModules(Enum):
    FILE: str = "file"
    PERSONAL_FILE: str = "personal_file"
    LEAD: str = "lead_file"
    CLIENT: str = "client_file"
    CLAIM: str = "claim_file"
    CLAIM_PAYMENT: str = "claim_payment_file"
    NEWSLETTER: str = "newsletter_file"
    TEMPLATE: str = "template_file"


class RefTypes(Enum):
    LEAD: str = "lead"
    CLIENT: str = "client"
    CLAIM: str = "claim"


class LeadStatusCreate(Enum):
    CALLBACK: str = "callback"
    NOT_INTERESTED: str = "not-interested"
    SIGNED: str = "signed"
    TRANSFER: str = "transfer"
    NOT_QUALIFIED: str = "not-qualified"
    INTERESTED: str = "interested"
    PENDING_SIGN: str = "pending-sign"


class LeadStatus(Enum):
    CALLBACK: str = "callback"
    NOT_INTERESTED: str = "not-interested"
    SIGNED: str = "signed"
    SIGNED_APPROVED: str = "signed-approved"
    TRANSFER: str = "transfer"
    NOT_QUALIFIED: str = "not-qualified"
    INTERESTED: str = "interested"
    PENDING_SIGN: str = "pending-sign"
    # Fire-workflow statuses
    SKIP_TRACE_PENDING: str = "skip-trace-pending"
    TEXT_SENT: str = "text-sent"
    RESPONDED_YES: str = "responded-yes"
    AWAITING_CALL: str = "awaiting-call"
    CONVERTED: str = "converted"
    CLOSED: str = "closed"


class LeadSource(Enum):
    SELF: str = "self"
    COMPANY: str = "company"
    OTHER: str = "other"


class ClaimPhases(Enum):
    CLAIM_REPORTED: str = "claim-reported"
    SCOPE: str = "scope"
    SCOPE_COMPLETE: str = "scope-complete"
    ESTIMATE: str = "estimate"
    ESTIMATE_COMPLETE: str = "estimate-complete"
    INSURANCE_COMPANY_INSPECTION: str = "insurance-company-inspection"
    INSURANCE_COMPANY_INSPECTION_COMPLETE: str = "insurance-company-inspection-complete"
    WAITING_FOR_INITIAL_PAYMENT: str = "waiting-for-initial-payment"
    INITIAL_PAYMENT_RECEIVED: str = "initial-payment-received"
    SUPPLEMENT_PAYMENT_RECEIVED: str = "supplement-payment-received"
    APPRAISAL: str = "appraisal"
    MEDIATION: str = "mediation"
    LAWSUIT: str = "lawsuit"
    FINAL_PAYMENT_RECEIVED: str = "final-payment-received"
    CHECK_AT_BANK: str = "check-at-bank"
    CLIENT_CANCELLED: str = "client-cancelled"
    CLAIM_CLOSED: str = "claim-closed"


class EscalationPath(Enum):
    NONE: str = "none"
    APPRAISAL: str = "appraisal"
    UMPIRE: str = "umpire"
    ATTORNEY_LITIGATION: str = "attorney-litigation"


class ClaimSubStatus(Enum):
    NONE: str = "none"
    WAITING_ON_POLICY: str = "waiting-on-policy"
    WAITING_ON_CARRIER_ESTIMATE: str = "waiting-on-carrier-estimate"
    REINSPECTION_REQUESTED: str = "reinspection-requested"
    APPRAISAL_INVOKED: str = "appraisal-invoked"
    UMPIRE_SELECTED: str = "umpire-selected"
    COUNSEL_RETAINED: str = "counsel-retained"
    SETTLEMENT_PENDING: str = "settlement-pending"
    PARTIAL_PAYMENT_RECEIVED: str = "partial-payment-received"
    FINAL_PAYMENT_RECEIVED: str = "final-payment-received"


class ClaimOriginType(Enum):
    NEW_CLAIM: str = "new-claim"
    REOPENED_CLAIM: str = "reopened-claim"
    POST_PAYMENT_UNDERPAID: str = "post-payment-underpaid"


class RecoveryMode(Enum):
    NONE: str = "none"
    SUPPLEMENT: str = "supplement"
    APPRAISAL: str = "appraisal"
    LITIGATION: str = "litigation"


class ClaimSource(Enum):
    SELF: str = "self"
    COMPANY: str = "company"
    OTHER: str = "other"


class ClaimFeeType(Enum):
    PERCENTAGE: str = "percentage"
    FIXED: str = "fixed"
    HOURLY: str = "hourly"


class ClaimPaymentCheckTypes(Enum):
    STANDARD: str = "standard"
    FLAGGED: str = "flagged"


class ClaimPaymentIncomeTypes(Enum):
    CLAIM_SETTLEMENT: str = "claim-settlement"
    OTHER: str = "other"


class ClaimPaymentExpenseTypes(Enum):
    CONTINGENCY_FEE: str = "contingency-fee"
    APPRAISAL_FEE: str = "appraisal-fee"
    UMPIRE_FEE: str = "umpire-fee"
    MISCELLANEOUS_FEE: str = "miscellaneous-fee"
    OTHER: str = "other"


class CommentVisibility(Enum):
    INTERNAL: str = "internal"
    EXTERNAL: str = "external"


class FileVisibility(Enum):
    INTERNAL: str = "internal"
    SHARED: str = "shared"


class ClaimCollaboratorRestrictedAttributes(Enum):
    FEE: str = "fee"
    FEE_TYPE: str = "fee_type"
    ANTICIPATED_AMOUNT: str = "anticipated_amount"
    INSTRUCTIONS_OR_NOTES: str = "instructions_or_notes"


class ClaimRoles(Enum):
    SOURCE: str = "source"
    COLLABORATOR: str = "collaborator"
    SIGNER: str = "signer"
    ADJUSTER: str = "adjuster"


class AppTags(Enum):
    AGENT_RESOURCE: str = "Agent Resource"


class SqlOperators(Enum):
    EQ: str = "eq"


class Priority(Enum):
    LOW: str = "low"
    MEDIUM: str = "medium"
    HIGH: str = "high"


class TaskStatus(Enum):
    TODO: str = "to-do"                          # lead/client/user tasks
    IN_PROGRESS: str = "in-progress"             # shared
    ON_HOLD: str = "on-hold"                     # lead/client/user tasks
    DONE: str = "done"                           # lead/client/user tasks
    PENDING: str = "pending"                     # claim tasks
    WAITING_ON_CARRIER: str = "waiting-on-carrier"  # claim tasks
    WAITING_ON_CLIENT: str = "waiting-on-client"    # claim tasks
    COMPLETED: str = "completed"                 # claim tasks


class TaskType(Enum):
    PHONE_CALL: str = "phone-call"
    EMAIL: str = "email"
    MEETING: str = "meeting"
    REMINDER: str = "reminder"
    FOLLOW_UP: str = "follow-up"
    OTHER: str = "other"


class TaskModule(Enum):
    LEAD: str = "lead_task"
    CLIENT: str = "client_task"
    CLAIM: str = "claim_task"
    USER: str = "user_task"
    DAILY_SCHEDULE: str = "daily_schedule"
    ALL: str = "all"


class NetworkEnv(Enum):
    IN_PERSON: str = "in-person"
    ONLINE: str = "online"
    HYBRID: str = "hybrid"


class ExplorationType(Enum):
    HYPERLINK: str = "hyperlink"
    SEARCH_TERM: str = "search-term"


class ReportPeriodType(Enum):
    ALL_TIME: str = "all-time"
    CURRENT_YEAR: str = "current-year"
    CURRENT_MONTH: str = "current-month"
    CURRENT_WEEK: str = "current-week"
    LAST_MONTH: str = "last-month"
    LAST_WEEK: str = "last-week"
    LAST_180_DAYS: str = "last-180-days"
    LAST_90_DAYS: str = "last-90-days"
    LAST_30_DAYS: str = "last-30-days"
    LAST_7_DAYS: str = "last-7-days"
    CUSTOM_RANGE: str = "custom-range"


class UserActivityType(Enum):
    LOGIN: str = "login"


class AnnouncementActivityType(Enum):
    SEEN: str = "seen"


class ClaimActivityType(Enum):
    PHASE_CHANGED: str = "phase-changed"
    ESCALATION_CHANGED: str = "escalation-changed"
    SUB_STATUS_CHANGED: str = "sub-status-changed"
    SUPPLEMENT_EMAIL_SENT: str = "supplement-email-sent"
    CLAIM_CREATED: str = "claim-created"
    DOCUMENT_UPLOADED: str = "document-uploaded"
    COMMENT_ADDED: str = "comment-added"
    PAYMENT_ISSUED: str = "payment-issued"
    PAYMENT_UPDATED: str = "payment-updated"
    INSPECTION_COMPLETED: str = "inspection-completed"
    ESTIMATE_GENERATED: str = "estimate-generated"
    CLAIM_ASSIGNED: str = "claim-assigned"
    CARRIER_MESSAGE_SENT: str = "carrier-message-sent"
    CLIENT_MESSAGE_SENT: str = "client-message-sent"
    INTERNAL_NOTE_ADDED: str = "internal-note-added"
    TASK_CREATED: str = "task-created"
    TASK_STATUS_CHANGED: str = "task-status-changed"
    TASK_ASSIGNED: str = "task-assigned"
    TASK_COMPLETED: str = "task-completed"
    CARRIER_ESTIMATE_RECEIVED: str = "carrier-estimate-received"
    ORIGIN_TYPE_CHANGED: str = "origin-type-changed"


class ActivityRelatedType(Enum):
    ACTIVITY: str = "activity"
    ANNOUNCEMENT: str = "announcement"


class PaymentType(Enum):
    DEBIT: str = "debit"
    CREDIT: str = "credit"


class PolicyEffect(Enum):
    DENY: str = "deny"
    PERMIT: str = "permit"


class ClaimFileShareType(Enum):
    SENT_AS_LINK: int = 1
    SENT_AS_ATTACHMENT: int = 2


class OrderStatus(Enum):
    PENDING: str = "Pending"
    PROCESSED: str = "Processed"


class LeadOutcomeStatus(Enum):
    # Contact Attempts
    NO_ANSWER_LEFT_MESSAGE: str = "no-answer-left-message"
    NO_ANSWER_NO_MESSAGE: str = "no-answer-no-message"
    CALL_BACK_LATER_TODAY: str = "call-back-later-today"
    CALL_BACK_TOMORROW: str = "call-back-tomorrow"
    WRONG_NUMBER: str = "wrong-number"
    # Lead Quality
    NO_FIRE_INCORRECT: str = "no-fire-incorrect-incident"
    NOT_INTERESTED: str = "not-interested"
    ALREADY_HANDLED: str = "already-handled"
    # Engagement
    WANTS_MORE_INFO: str = "wants-more-information"
    APPOINTMENT_SCHEDULED: str = "appointment-scheduled"
    INSPECTION_COMPLETED: str = "inspection-completed"
    # Conversions
    SIGNED_CLIENT: str = "signed-client"
    CLAIM_FILED: str = "claim-filed"
    LOST_LEAD: str = "lost-lead"


class LeadOutcomeCategory(Enum):
    CONTACT_ATTEMPTS: str = "contact-attempts"
    LEAD_QUALITY: str = "lead-quality"
    ENGAGEMENT: str = "engagement"
    CONVERSIONS: str = "conversions"


OUTCOME_STATUS_CATEGORIES: dict[LeadOutcomeStatus, LeadOutcomeCategory] = {
    LeadOutcomeStatus.NO_ANSWER_LEFT_MESSAGE: LeadOutcomeCategory.CONTACT_ATTEMPTS,
    LeadOutcomeStatus.NO_ANSWER_NO_MESSAGE: LeadOutcomeCategory.CONTACT_ATTEMPTS,
    LeadOutcomeStatus.CALL_BACK_LATER_TODAY: LeadOutcomeCategory.CONTACT_ATTEMPTS,
    LeadOutcomeStatus.CALL_BACK_TOMORROW: LeadOutcomeCategory.CONTACT_ATTEMPTS,
    LeadOutcomeStatus.WRONG_NUMBER: LeadOutcomeCategory.CONTACT_ATTEMPTS,
    LeadOutcomeStatus.NO_FIRE_INCORRECT: LeadOutcomeCategory.LEAD_QUALITY,
    LeadOutcomeStatus.NOT_INTERESTED: LeadOutcomeCategory.LEAD_QUALITY,
    LeadOutcomeStatus.ALREADY_HANDLED: LeadOutcomeCategory.LEAD_QUALITY,
    LeadOutcomeStatus.WANTS_MORE_INFO: LeadOutcomeCategory.ENGAGEMENT,
    LeadOutcomeStatus.APPOINTMENT_SCHEDULED: LeadOutcomeCategory.ENGAGEMENT,
    LeadOutcomeStatus.INSPECTION_COMPLETED: LeadOutcomeCategory.ENGAGEMENT,
    LeadOutcomeStatus.SIGNED_CLIENT: LeadOutcomeCategory.CONVERSIONS,
    LeadOutcomeStatus.CLAIM_FILED: LeadOutcomeCategory.CONVERSIONS,
    LeadOutcomeStatus.LOST_LEAD: LeadOutcomeCategory.CONVERSIONS,
}
