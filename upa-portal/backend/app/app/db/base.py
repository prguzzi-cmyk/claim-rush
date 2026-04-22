#!/usr/bin/env python

"""
Import all the models, so that Base has them before being imported by Alembic
"""

# isort: skip_file

from app.db.base_class import Base  # noqa
from app.models.user_meta import UserMeta  # noqa
from app.models.user import User  # noqa
from app.models.permission import Permission  # noqa
from app.models.role import Role  # noqa
from app.models.tag import Tag  # noqa
from app.models.file import File  # noqa
from app.models.user_activity import UserActivity  # noqa
from app.models.comment import Comment  # noqa
from app.models.task_meta import TaskMeta  # noqa
from app.models.task import Task  # noqa
from app.models.schedule import Schedule  # noqa
from app.models.user_task import UserTask  # noqa
from app.models.daily_schedule import DailySchedule  # noqa
from app.models.business_email import BusinessEmail  # noqa
from app.models.lead_contact import LeadContact  # noqa
from app.models.lead import Lead  # noqa
from app.models.lead_comment import LeadComment  # noqa
from app.models.client_portal_lead import ClientPortalLead, ClientPortalFollowUp  # noqa
from app.models.voice_secretary import VoiceSecretary  # noqa
from app.models.sales_agent_session import SalesAgentSession  # noqa
from app.models.agreement import Agreement, AgreementAuditEntry  # noqa
from app.models.lead_file import LeadFile  # noqa
from app.models.lead_task import LeadTask  # noqa
from app.models.client import Client  # noqa
from app.models.client_comment import ClientComment  # noqa
from app.models.client_file import ClientFile  # noqa
from app.models.client_task import ClientTask  # noqa
from app.models.claim_contact import ClaimContact  # noqa
from app.models.claim_coverage import ClaimCoverage  # noqa
from app.models.claim import Claim  # noqa
from app.models.claim_comment import ClaimComment  # noqa
from app.models.claim_payment import ClaimPayment  # noqa
from app.models.claim_payment_file import ClaimPaymentFile  # noqa
from app.models.claim_file import ClaimFile  # noqa
from app.models.claim_file_share import ClaimFileShare, ClaimFileShareDetails  # noqa
from app.models.claim_task import ClaimTask  # noqa
from app.models.claim_activity import ClaimActivity  # noqa
from app.models.claim_business_email import ClaimBusinessEmail  # noqa
from app.models.npo_initiative import NpoInitiative  # noqa
from app.models.partnership import Partnership  # noqa
from app.models.network import Network  # noqa
from app.models.newsletter import Newsletter  # noqa
from app.models.newsletter_file import NewsletterFile  # noqa
from app.models.announcement import Announcement  # noqa
from app.models.announcement_file import AnnouncementFile  # noqa
from app.models.announcement_activity import AnnouncementActivity  # noqa
from app.models.user_policy import UserPolicy  # noqa
from app.models.policy_permission import PolicyPermission  # noqa
from app.models.template_file import TemplateFile  # noqa
from app.models.category import Category  # noqa
from app.models.product import Product  # noqa
from app.models.account import Account  # noqa
from app.models.account_detail import AccountDetail  # noqa
from app.models.cart import Cart  # noqa
from app.models.order import Order  # noqa
from app.models.order_detail import OrderDetail  # noqa
from app.models.user_personal_file import UserPersonalFile  # noqa
from app.models.waitlist import AIEstimateWaitlist  # noqa
from app.models.rin_source import RinSource  # noqa
from app.models.fire_agency import FireAgency  # noqa
from app.models.fire_incident import FireIncident  # noqa
from app.models.call_type_config import CallTypeConfig  # noqa
from app.models.pricing_item import PricingItem  # noqa
from app.models.estimate_project import EstimateProject  # noqa
from app.models.estimate_room import EstimateRoom  # noqa
from app.models.estimate_measurement import EstimateMeasurement  # noqa
from app.models.estimate_line_item import EstimateLineItem  # noqa
from app.models.estimate_photo import EstimatePhoto  # noqa
from app.models.property_intelligence import PropertyIntelligence  # noqa
from app.models.fire_claim import FireClaim  # noqa
from app.models.fire_claim_media import FireClaimMedia  # noqa
from app.models.storm_event import StormEvent  # noqa
from app.models.storm_outreach_batch import StormOutreachBatch  # noqa
from app.models.territory import Territory, UserTerritory  # noqa
from app.models.lead_distribution import LeadDistributionHistory, StateRotation, TerritoryRotationState  # noqa
from app.models.lead_delivery_log import LeadDeliveryLog  # noqa
from app.models.in_app_notification import InAppNotification  # noqa
from app.models.lead_outcome import LeadOutcome  # noqa
from app.models.communication_log import CommunicationLog  # noqa
from app.models.lead_contact_tracker import LeadContactTracker  # noqa
from app.models.escalation_attempt import EscalationAttempt  # noqa
from app.models.crime_incident import CrimeIncident  # noqa
from app.models.crime_data_source_config import CrimeDataSourceConfig  # noqa
from app.models.roof_analysis import RoofAnalysis  # noqa
from app.models.claim_zone_lead_tracker import ClaimZoneLeadTracker  # noqa
from app.models.login_attempt import LoginAttempt  # noqa
from app.models.user_passkey import UserPasskey  # noqa
from app.models.magic_link_token import MagicLinkToken  # noqa
from app.models.claim_communication import ClaimCommunication  # noqa
from app.models.skiptrace_wallet import SkiptraceWallet  # noqa
from app.models.skiptrace_transaction import SkiptraceTransaction  # noqa
from app.models.lead_owner_intelligence import LeadOwnerIntelligence  # noqa

from app.models.policy_document import PolicyDocument  # noqa
from app.models.policy_clause import PolicyClause  # noqa
from app.models.policy_intelligence import PolicyIntelligence  # noqa
from app.models.carrier_estimate import CarrierEstimate, CarrierLineItem  # noqa
from app.models.carrier_comparison import CarrierComparison  # noqa
from app.models.rotation_lead import RotationLead  # noqa
from app.models.rotation_lead_activity import RotationLeadActivity  # noqa
from app.models.rotation_config import RotationConfig  # noqa
from app.models.outreach_template import OutreachTemplate  # noqa
from app.models.outreach_campaign import OutreachCampaign  # noqa
from app.models.outreach_attempt import OutreachAttempt  # noqa
from app.models.conversation_message import ConversationMessage  # noqa
from app.models.inspection_schedule import InspectionSchedule  # noqa
from app.models.adjuster_availability import AdjusterAvailability, AdjusterBlockedSlot  # noqa
from app.models.voice_campaign import VoiceCampaign  # noqa
from app.models.voice_call_log import VoiceCallLog  # noqa
from app.models.voice_usage_record import VoiceUsageRecord  # noqa
from app.models.intake_session import IntakeSession  # noqa
from app.models.intake_appointment import IntakeAppointment  # noqa
from app.models.message_template import MessageTemplate  # noqa
from app.models.voice_script import VoiceScript  # noqa
from app.models.incident import Incident  # noqa
from app.models.outreach_compliance_config import OutreachComplianceConfig  # noqa

# Commission engine
from app.models.commission_claim import CommissionClaim  # noqa
from app.models.commission_ledger import CommissionLedger  # noqa
from app.models.commission_payout import CommissionPayout  # noqa
from app.models.commission_advance import CommissionAdvance  # noqa

# Agent profile satellites
from app.models.agent_profile import AgentProfile  # noqa
from app.models.agent_license import AgentLicense  # noqa
from app.models.agent_banking import AgentBanking  # noqa

# from app.models.task_comment import TaskComment  # noqa
