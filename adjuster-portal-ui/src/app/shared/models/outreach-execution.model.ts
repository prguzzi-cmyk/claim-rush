/**
 * Outreach Execution Engine Models
 *
 * Tracks the execution state of outreach campaigns against individual leads.
 * Manages step scheduling, attempt history, stop conditions, and agent notifications.
 *
 * Does NOT duplicate:
 * - OutreachCampaign/Step (campaign definition — consumed here)
 * - ConversationRecord (conversation log — written by this engine)
 * - VoiceCallRecord (voice call state — delegated to voice engine)
 */

import { ConversationOutcome } from './outreach-campaign.model';

// ── Execution Job ──────────────────────────────────────────────

export type ExecutionJobStatus =
  | 'queued'
  | 'waiting_delay'
  | 'ready'
  | 'executing'
  | 'completed'
  | 'stopped'
  | 'failed';

export interface OutreachExecutionJob {
  id: string;
  campaignId: string;
  leadId: string;
  leadName: string;
  leadPhone: string | null;
  leadEmail: string | null;
  assignedAgentId: string | null;
  status: ExecutionJobStatus;
  currentStepNumber: number;
  totalSteps: number;
  attempts: ExecutionAttempt[];
  stopReason: StopReason | null;
  createdAt: string;
  updatedAt: string;
  nextExecutionAt: string | null;
}

// ── Execution Attempt ──────────────────────────────────────────

export type AttemptResult = 'sent' | 'delivered' | 'failed' | 'responded' | 'no_answer' | 'voicemail';

export interface ExecutionAttempt {
  attemptNumber: number;
  stepNumber: number;
  channel: 'voice' | 'sms' | 'email';
  templateId: string;
  result: AttemptResult;
  outcome: ConversationOutcome | null;
  executedAt: string;
  providerMessageId: string | null;
  errorMessage: string | null;
}

// ── Stop Conditions ────────────────────────────────────────────

export type StopReason =
  | 'homeowner_responded'
  | 'appointment_booked'
  | 'lead_closed'
  | 'max_attempts_reached'
  | 'do_not_contact'
  | 'manual_stop'
  | 'campaign_paused';

export const STOP_REASON_LABELS: Record<StopReason, string> = {
  homeowner_responded:  'Homeowner responded',
  appointment_booked:   'Appointment booked',
  lead_closed:          'Lead closed',
  max_attempts_reached: 'Max attempts reached',
  do_not_contact:       'Do not contact',
  manual_stop:          'Manually stopped',
  campaign_paused:      'Campaign paused',
};

/** Outcomes that trigger an automatic stop. */
export const AUTO_STOP_OUTCOMES: Set<ConversationOutcome> = new Set([
  'sms_replied',
  'email_replied',
  'call_connected',
  'appointment_booked',
  'not_interested',
  'do_not_contact',
]);

/** Outcomes that trigger agent notification. */
export const NOTIFY_AGENT_OUTCOMES: Set<ConversationOutcome> = new Set([
  'sms_replied',
  'email_replied',
  'call_connected',
  'appointment_booked',
]);

// ── Execution Queue ────────────────────────────────────────────

export interface ExecutionQueueStats {
  totalJobs: number;
  queued: number;
  waitingDelay: number;
  ready: number;
  executing: number;
  completed: number;
  stopped: number;
  failed: number;
}

// ── Execution Request (sent to backend) ────────────────────────

export interface ExecuteStepRequest {
  jobId: string;
  campaignId: string;
  leadId: string;
  stepNumber: number;
  channel: 'voice' | 'sms' | 'email';
  templateId: string;
  resolvedSubject: string | null;
  resolvedBody: string;
  resolvedCallScript: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
}

export interface ExecuteStepResponse {
  success: boolean;
  attemptResult: AttemptResult;
  providerMessageId: string | null;
  error: string | null;
}
