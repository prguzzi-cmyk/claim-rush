/**
 * Voice Outreach Models
 *
 * Frontend type definitions for the AI voice outreach workflow.
 * Maps to backend: LeadContactTracker, VoiceCallProvider, EscalationAttempt.
 *
 * Used by: Voice Outreach Engine, Communications Hub, Lead Rotation,
 * Activity Timeline, Dashboard Metrics.
 */

// ── Call Outcome States ────────────────────────────────────────

export type VoiceCallOutcome =
  | 'no_answer'
  | 'left_voicemail'
  | 'wrong_number'
  | 'call_back_later'
  | 'not_interested'
  | 'not_qualified'
  | 'possible_claim'
  | 'qualified_lead'
  | 'urgent_followup'
  | 'existing_client';

export const CALL_OUTCOME_META: Record<VoiceCallOutcome, {
  label: string;
  icon: string;
  color: string;
  category: 'no_contact' | 'negative' | 'positive' | 'neutral';
  feedsRotation: boolean;
}> = {
  no_answer:       { label: 'No Answer',        icon: 'phone_missed',       color: '#ff9800', category: 'no_contact', feedsRotation: false },
  left_voicemail:  { label: 'Left Voicemail',   icon: 'voicemail',          color: '#2196f3', category: 'no_contact', feedsRotation: false },
  wrong_number:    { label: 'Wrong Number',     icon: 'phone_disabled',     color: '#9e9e9e', category: 'negative',   feedsRotation: false },
  call_back_later: { label: 'Call Back Later',  icon: 'schedule',           color: '#00bcd4', category: 'neutral',    feedsRotation: false },
  not_interested:  { label: 'Not Interested',   icon: 'thumb_down',         color: '#f44336', category: 'negative',   feedsRotation: false },
  not_qualified:   { label: 'Not Qualified',    icon: 'block',              color: '#795548', category: 'negative',   feedsRotation: false },
  possible_claim:  { label: 'Possible Claim',   icon: 'help_outline',       color: '#ff9800', category: 'positive',   feedsRotation: true },
  qualified_lead:  { label: 'Qualified Lead',   icon: 'verified',           color: '#4caf50', category: 'positive',   feedsRotation: true },
  urgent_followup: { label: 'Urgent Follow-Up', icon: 'priority_high',      color: '#c62828', category: 'positive',   feedsRotation: true },
  existing_client: { label: 'Existing Client',  icon: 'person',             color: '#6a1b9a', category: 'neutral',    feedsRotation: false },
};

// ── AI Call Status (maps to backend LeadContactTracker.ai_call_status) ──

export type AICallStatus =
  | 'pending'
  | 'initiated'
  | 'ringing'
  | 'connected'
  | 'no_answer'
  | 'voicemail'
  | 'failed'
  | 'completed'
  | 'skipped';

// ── Contact Status (maps to backend LeadContactTracker.contact_status) ──

export type ContactStatus =
  | 'new'
  | 'ai_call_initiated'
  | 'connected_live'
  | 'transferred'
  | 'no_answer'
  | 'voicemail_left'
  | 'sms_sent'
  | 'email_sent'
  | 'escalated'
  | 'queued_quiet_hours'
  | 'closed_signed'
  | 'closed_not_interested';

// ── Voice Call Record ──────────────────────────────────────────

/** A single outbound voice call attempt. */
export interface VoiceCallRecord {
  id: string;
  leadId: string;
  phoneNumber: string;
  callSid: string | null;
  provider: string;
  status: AICallStatus;
  outcome: VoiceCallOutcome | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  transcriptUrl: string | null;
  transcriptSummary: string | null;
  qualificationData: QualificationData | null;
  nextAction: string | null;
  assignedAdjusterId: string | null;
  assignedAdjusterName: string | null;
  createdAt: string;
}

// ── Qualification Data ─────────────────────────────────────────

/** Structured data captured during AI voice qualification. */
export interface QualificationData {
  damageType: string | null;
  eventType: string | null;
  lossDate: string | null;
  propertyAddress: string | null;
  hasInsuranceClaim: boolean | null;
  wantsInspection: boolean | null;
  callbackNumber: string | null;
  bestTimeToCall: string | null;
  additionalNotes: string | null;
}

export function createEmptyQualificationData(): QualificationData {
  return {
    damageType: null,
    eventType: null,
    lossDate: null,
    propertyAddress: null,
    hasInsuranceClaim: null,
    wantsInspection: null,
    callbackNumber: null,
    bestTimeToCall: null,
    additionalNotes: null,
  };
}

// ── Voice Outreach Session ─────────────────────────────────────

/** Full outreach session for a lead — may contain multiple call attempts. */
export interface VoiceOutreachSession {
  leadId: string;
  contactStatus: ContactStatus;
  callAttempts: VoiceCallRecord[];
  totalAttempts: number;
  lastAttemptAt: string | null;
  escalationLevel: number;
  isResolved: boolean;
  resolutionType: string | null;
  resolvedAt: string | null;
}

// ── Call Sequence (retry logic) ────────────────────────────────

export type CallSequenceChannel = 'voice' | 'sms' | 'email';

export interface CallSequenceStep {
  stepNumber: number;
  channel: CallSequenceChannel;
  delayMinutes: number;
  templateKey: string | null;
  maxAttempts: number;
}

export interface CallSequence {
  id: string;
  name: string;
  steps: CallSequenceStep[];
}

/** Default multi-step outreach sequence. */
export const DEFAULT_CALL_SEQUENCE: CallSequence = {
  id: 'default_outreach',
  name: 'Standard Outreach Sequence',
  steps: [
    { stepNumber: 1, channel: 'voice', delayMinutes: 0,    templateKey: null,                     maxAttempts: 1 },
    { stepNumber: 2, channel: 'voice', delayMinutes: 120,  templateKey: null,                     maxAttempts: 1 },
    { stepNumber: 3, channel: 'voice', delayMinutes: 1440, templateKey: null,                     maxAttempts: 1 },
    { stepNumber: 4, channel: 'sms',   delayMinutes: 1500, templateKey: 'voice_fallback_sms',     maxAttempts: 1 },
    { stepNumber: 5, channel: 'email', delayMinutes: 2880, templateKey: 'voice_fallback_email',   maxAttempts: 1 },
  ],
};

// ── Voice Provider Adapter (abstract interface) ────────────────

/** Provider-agnostic interface for voice operations.
 *  Implementations: VapiAdapter, RetellAdapter, BlandAdapter, TwilioAdapter.
 *  The active provider is determined by backend configuration. */
export interface VoiceProviderCapabilities {
  supportsOutboundCalls: boolean;
  supportsTransfer: boolean;
  supportsRecording: boolean;
  supportsTranscription: boolean;
  supportsRealTimeAnalysis: boolean;
  providerName: string;
}

/** Request shape for initiating a voice call via the backend. */
export interface InitiateCallRequest {
  leadId: string;
  phoneNumber: string;
  leadContext: Record<string, string>;
}

/** Response from the backend after call initiation. */
export interface InitiateCallResponse {
  success: boolean;
  callId: string | null;
  error: string | null;
}

// ── Human Handoff ──────────────────────────────────────────────

/** Payload for creating a human follow-up task from a voice session. */
export interface VoiceHandoffPayload {
  leadId: string;
  callRecordId: string;
  assignedAdjusterId: string | null;
  transcriptSummary: string | null;
  qualificationData: QualificationData | null;
  outcome: VoiceCallOutcome;
  suggestedTaskTitle: string;
  suggestedTaskDescription: string;
  priority: 'low' | 'medium' | 'high';
}

// ── Communications Hub Integration ─────────────────────────────

/** Shape for logging a voice call in the communications timeline.
 *  Compatible with existing ClaimCommunication / CommunicationLog patterns. */
export interface VoiceCommunicationEntry {
  channel: 'voice';
  direction: 'outbound';
  subject: string;
  body: string;
  recipientPhone: string;
  callOutcome: VoiceCallOutcome | null;
  callDurationSeconds: number | null;
  transcriptSummary: string | null;
  isSystemGenerated: boolean;
  provider: string;
  callSid: string | null;
}

// ── Voice Campaign ──────────────────────────────────────────────

export type VoiceCampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';

export type VoiceCampaignLeadSource =
  | 'all_leads'
  | 'fire_leads'
  | 'storm_leads'
  | 'hail_leads'
  | 'wind_leads'
  | 'flood_leads'
  | 'rotation_leads'
  | 'manual_selection';

export interface VoiceCampaignScript {
  id: string;
  name: string;
  description: string;
}

export const VOICE_CAMPAIGN_SCRIPTS: VoiceCampaignScript[] = [
  { id: 'intro_inspection', name: 'Intro & Free Inspection', description: 'Initial outreach offering a free roof/property inspection' },
  { id: 'storm_followup', name: 'Storm Follow-Up', description: 'Follow-up call after a recent storm event' },
  { id: 'claim_qualification', name: 'Claim Qualification', description: 'Qualify lead for potential insurance claim' },
  { id: 'appointment_setter', name: 'Appointment Setter', description: 'Schedule an inspection or consultation appointment' },
  { id: 'reengagement', name: 'Re-engagement', description: 'Re-engage cold leads that previously showed interest' },
];

export interface VoiceCampaign {
  id: string;
  name: string;
  leadSource: VoiceCampaignLeadSource;
  scriptId: string;
  scriptName: string;
  assignedAgentId: string | null;
  assignedAgentName: string;
  status: VoiceCampaignStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
  leadCount: number;
  callsPlaced: number;
  callsConnected: number;
  appointmentsBooked: number;
  clientsSigned: number;
  createdAt: string;
}

// ── Call Result (quick-action buttons) ──────────────────────────

export type QuickCallResult =
  | 'no_answer'
  | 'left_voicemail'
  | 'call_back_later'
  | 'not_interested'
  | 'wants_information'
  | 'signed_client';

export const QUICK_CALL_RESULT_META: Record<QuickCallResult, {
  label: string;
  icon: string;
  color: string;
}> = {
  no_answer:         { label: 'No Answer',         icon: 'phone_missed',    color: '#ff9800' },
  left_voicemail:    { label: 'Left Voicemail',    icon: 'voicemail',       color: '#2196f3' },
  call_back_later:   { label: 'Call Back Later',   icon: 'schedule',        color: '#00bcd4' },
  not_interested:    { label: 'Not Interested',    icon: 'thumb_down',      color: '#f44336' },
  wants_information: { label: 'Wants Information', icon: 'info',            color: '#7b1fa2' },
  signed_client:     { label: 'Signed Client',     icon: 'how_to_reg',      color: '#2e7d32' },
};
