/**
 * Outreach Campaign Engine Models
 *
 * Unified campaign management for property damage lead outreach.
 * Orchestrates AI voice, SMS, email, and multi-step campaigns.
 *
 * Does NOT duplicate:
 * - Campaign/CampaignStep (community-advocate.model — community outreach)
 * - EngagementMessageTemplate (engagement-sequence.config — claim follow-ups)
 * - VoiceCallRecord/CallSequence (voice-outreach.model — AI voice calls)
 * - CommunicationLog (communication-log.model — delivery tracking)
 *
 * This module is specifically for property damage lead outreach campaigns
 * that feed into the Lead Rotation Engine and Claim Intake pipeline.
 */

// ── Campaign Types ─────────────────────────────────────────────

export type OutreachCampaignType = 'ai_voice' | 'sms' | 'email' | 'multi_step';

export const CAMPAIGN_TYPE_META: Record<OutreachCampaignType, {
  label: string;
  icon: string;
  color: string;
}> = {
  ai_voice:   { label: 'AI Voice Call',       icon: 'phone',    color: '#1565c0' },
  sms:        { label: 'SMS Message',         icon: 'sms',      color: '#2e7d32' },
  email:      { label: 'Email Outreach',      icon: 'email',    color: '#e65100' },
  multi_step: { label: 'Multi-Step Campaign', icon: 'route',    color: '#7b1fa2' },
};

// ── Campaign Status ────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived';

// ── Outreach Campaign ──────────────────────────────────────────

export interface OutreachCampaign {
  id: string;
  name: string;
  campaignType: OutreachCampaignType;
  status: CampaignStatus;
  leadSource: string | null;
  targetState: string | null;
  targetTerritoryId: string | null;
  steps: OutreachCampaignStep[];
  automationTrigger: AutomationTrigger | null;
  metrics: OutreachCampaignMetrics;
  createdAt: string;
  updatedAt: string | null;
  createdBy: string | null;
}

// ── Campaign Steps ─────────────────────────────────────────────

export interface OutreachCampaignStep {
  stepNumber: number;
  channel: 'voice' | 'sms' | 'email';
  templateId: string;
  delayMinutes: number;
  subject: string | null;
  callScriptKey: string | null;
}

// ── Automation Triggers ────────────────────────────────────────

export type AutomationTriggerEvent =
  | 'new_lead_created'
  | 'lead_assigned'
  | 'lead_not_contacted'
  | 'lead_no_response'
  | 'storm_event_detected';

export interface AutomationTrigger {
  event: AutomationTriggerEvent;
  delayMinutes: number;
  conditions: Record<string, string>;
}

export const TRIGGER_EVENT_META: Record<AutomationTriggerEvent, {
  label: string;
  icon: string;
}> = {
  new_lead_created:     { label: 'New Lead Enters System',           icon: 'person_add' },
  lead_assigned:        { label: 'Lead Assigned to Agent',           icon: 'assignment_ind' },
  lead_not_contacted:   { label: 'Lead Not Contacted Within Timer',  icon: 'timer_off' },
  lead_no_response:     { label: 'Lead No Response After Outreach',  icon: 'phone_missed' },
  storm_event_detected: { label: 'Storm Event Detected',             icon: 'thunderstorm' },
};

// ── Outreach Templates ─────────────────────────────────────────

export interface OutreachMessageTemplate {
  id: string;
  name: string;
  channel: 'voice' | 'sms' | 'email';
  subject: string | null;
  body: string;
  callScript: string | null;
  category: string;
  variables: string[];
  isActive: boolean;
}

/** Standard template variables available for interpolation. */
export const TEMPLATE_VARIABLES = [
  '{{owner_name}}',
  '{{property_address}}',
  '{{incident_type}}',
  '{{adjuster_name}}',
  '{{company_name}}',
  '{{callback_number}}',
  '{{claim_number}}',
  '{{storm_type}}',
  '{{loss_date}}',
];

// ── Conversation Tracking ──────────────────────────────────────

export type ConversationOutcome =
  | 'no_answer'
  | 'voicemail'
  | 'sms_sent'
  | 'sms_replied'
  | 'email_sent'
  | 'email_opened'
  | 'email_replied'
  | 'call_connected'
  | 'appointment_booked'
  | 'not_interested'
  | 'wrong_number'
  | 'do_not_contact';

export interface ConversationRecord {
  id: string;
  campaignId: string;
  leadId: string;
  stepNumber: number;
  channel: string;
  outcome: ConversationOutcome;
  sentAt: string;
  deliveredAt: string | null;
  respondedAt: string | null;
  notes: string | null;
}

// ── Campaign Metrics ───────────────────────────────────────────

export interface OutreachCampaignMetrics {
  totalTargets: number;
  callAttempts: number;
  smsSent: number;
  emailsSent: number;
  responses: number;
  appointmentsBooked: number;
  contactRate: number;
  responseRate: number;
  conversionRate: number;
}

export function createEmptyCampaignMetrics(): OutreachCampaignMetrics {
  return {
    totalTargets: 0, callAttempts: 0, smsSent: 0, emailsSent: 0,
    responses: 0, appointmentsBooked: 0, contactRate: 0, responseRate: 0, conversionRate: 0,
  };
}

// ── Dashboard Metrics ──────────────────────────────────────────

export interface CampaignDashboardMetrics {
  activeCampaigns: number;
  totalLeadsTargeted: number;
  totalContactAttempts: number;
  overallContactRate: number;
  overallResponseRate: number;
  overallConversionRate: number;
  byChannel: Record<string, { attempts: number; responses: number; rate: number }>;
  byCampaign: { name: string; targets: number; contacted: number; converted: number }[];
}

// ── Agent Notification ─────────────────────────────────────────

export type AgentNotificationType =
  | 'homeowner_responded'
  | 'call_connected'
  | 'appointment_requested'
  | 'sms_reply_received'
  | 'email_reply_received';

export interface AgentNotificationPayload {
  type: AgentNotificationType;
  agentId: string;
  leadId: string;
  campaignId: string;
  title: string;
  message: string;
  link: string | null;
}

export const AGENT_NOTIFICATION_META: Record<AgentNotificationType, {
  label: string;
  icon: string;
  color: string;
  priority: 'low' | 'medium' | 'high';
}> = {
  homeowner_responded:   { label: 'Homeowner Responded',    icon: 'chat',          color: '#4caf50', priority: 'high' },
  call_connected:        { label: 'Call Connected',         icon: 'phone_in_talk', color: '#1565c0', priority: 'high' },
  appointment_requested: { label: 'Appointment Requested',  icon: 'event',         color: '#7b1fa2', priority: 'high' },
  sms_reply_received:    { label: 'SMS Reply Received',     icon: 'sms',           color: '#2e7d32', priority: 'medium' },
  email_reply_received:  { label: 'Email Reply Received',   icon: 'mark_email_read', color: '#e65100', priority: 'medium' },
};
