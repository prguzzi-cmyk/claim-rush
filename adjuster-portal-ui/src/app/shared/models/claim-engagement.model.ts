/**
 * Claim Engagement Status & Anti-Ghosting Models
 *
 * Reusable engagement-state tracking for each claim/client.
 * Used by: Workflow Engine, Dashboard Metrics, Communications Hub,
 * Client Portal, Follow-Up Automation, Future Reporting.
 */

// ── Engagement Status ──────────────────────────────────────────

export type EngagementStatus =
  | 'active'
  | 'waiting_on_client'
  | 'reminder_sent'
  | 'escalation_pending'
  | 'stalled'
  | 'reengagement_in_progress'
  | 'responsive';

export const ENGAGEMENT_STATUS_META: Record<EngagementStatus, {
  label: string;
  icon: string;
  color: string;
  severity: 'ok' | 'warning' | 'critical';
}> = {
  active:                    { label: 'Active',                  icon: 'check_circle',   color: '#4caf50', severity: 'ok' },
  responsive:                { label: 'Responsive',              icon: 'thumb_up',       color: '#2e7d32', severity: 'ok' },
  waiting_on_client:         { label: 'Waiting on Client',       icon: 'hourglass_top',  color: '#ff9800', severity: 'warning' },
  reminder_sent:             { label: 'Reminder Sent',           icon: 'notifications',  color: '#2196f3', severity: 'warning' },
  escalation_pending:        { label: 'Escalation Pending',      icon: 'priority_high',  color: '#e65100', severity: 'critical' },
  stalled:                   { label: 'Stalled',                 icon: 'pause_circle',   color: '#c62828', severity: 'critical' },
  reengagement_in_progress:  { label: 'Re-Engagement Active',    icon: 'autorenew',      color: '#7b1fa2', severity: 'warning' },
};

// ── Engagement Snapshot ────────────────────────────────────────

/** Computed engagement state for a single claim. */
export interface ClaimEngagementSnapshot {
  claimId: string;
  status: EngagementStatus;
  daysSinceLastClientAction: number | null;
  daysSinceLastOutreach: number | null;
  remindersSent: number;
  currentSequenceStep: number;
  sequenceId: string | null;
  lastClientActionDate: string | null;
  lastOutreachDate: string | null;
  nextScheduledAction: ScheduledEngagementAction | null;
  stalledReason: string | null;
}

// ── Follow-Up Sequence ─────────────────────────────────────────

export type FollowUpChannel = 'email' | 'sms' | 'portal_notification' | 'task_creation' | 'voice_call';

/** A single step in a follow-up sequence. */
export interface FollowUpStep {
  stepNumber: number;
  delayDays: number;
  channel: FollowUpChannel;
  templateKey: string;
  escalateOnNoResponse: boolean;
}

/** A complete follow-up sequence definition. */
export interface FollowUpSequence {
  id: string;
  name: string;
  triggerCondition: string;
  steps: FollowUpStep[];
}

// ── Scheduled Action ───────────────────────────────────────────

/** A pending engagement action computed by the engine. */
export interface ScheduledEngagementAction {
  actionType: 'reminder' | 'escalation' | 'status_update' | 'reengagement';
  channel: FollowUpChannel;
  scheduledDate: string;
  templateKey: string;
  stepNumber: number;
  sequenceId: string;
}

// ── Escalation Rule ────────────────────────────────────────────

export interface EscalationRule {
  maxAutomatedAttempts: number;
  escalationActions: EscalationAction[];
}

export type EscalationAction =
  | 'create_adjuster_task'
  | 'flag_claim_stalled'
  | 'recommend_phone_outreach'
  | 'voice_agent_handoff';

export const DEFAULT_ESCALATION_RULE: EscalationRule = {
  maxAutomatedAttempts: 3,
  escalationActions: [
    'create_adjuster_task',
    'flag_claim_stalled',
    'recommend_phone_outreach',
  ],
};

// ── Proactive Status Update ────────────────────────────────────

export type StatusUpdateEvent =
  | 'claim_received'
  | 'policy_reviewed'
  | 'estimate_in_progress'
  | 'estimate_submitted'
  | 'supplement_under_review'
  | 'payment_received'
  | 'next_action_pending'
  | 'inspection_scheduled'
  | 'carrier_response_received';

export const STATUS_UPDATE_LABELS: Record<StatusUpdateEvent, string> = {
  claim_received:             'Your claim has been received and assigned.',
  policy_reviewed:            'Your policy has been reviewed — coverage confirmed.',
  estimate_in_progress:       'Your estimate is being prepared.',
  estimate_submitted:         'Your estimate has been submitted to the carrier.',
  supplement_under_review:    'Your supplement is under review by the carrier.',
  payment_received:           'A payment has been received on your claim.',
  next_action_pending:        'Your claim has a pending action that needs attention.',
  inspection_scheduled:       'An inspection has been scheduled for your property.',
  carrier_response_received:  'The carrier has responded — your adjuster is reviewing.',
};

// ── Client Portal Nudge ────────────────────────────────────────

export type NudgeType =
  | 'action_needed'
  | 'document_required'
  | 'signature_required'
  | 'review_required'
  | 'payment_update'
  | 'general_reminder';

export interface ClientPortalNudge {
  id: string;
  claimId: string;
  nudgeType: NudgeType;
  title: string;
  message: string;
  actionUrl: string | null;
  priority: 'low' | 'medium' | 'high';
  isDismissed: boolean;
  seenAt: string | null;
  createdAt: string;
}

export const NUDGE_TYPE_META: Record<NudgeType, { icon: string; color: string; label: string }> = {
  action_needed:      { icon: 'notification_important', color: '#c62828', label: 'Action Needed' },
  document_required:  { icon: 'upload_file',            color: '#e65100', label: 'Document Required' },
  signature_required: { icon: 'draw',                   color: '#ad1457', label: 'Signature Required' },
  review_required:    { icon: 'rate_review',             color: '#1565c0', label: 'Review Required' },
  payment_update:     { icon: 'payments',                color: '#2e7d32', label: 'Payment Update' },
  general_reminder:   { icon: 'notifications',           color: '#ff9800', label: 'Reminder' },
};

// ── Message Tone (Claude-Ready) ────────────────────────────────

export type MessageTone =
  | 'professional_reminder'
  | 'gentle_reengagement'
  | 'status_update'
  | 'escalation_to_human'
  | 'urgent_action';

export const MESSAGE_TONE_INSTRUCTIONS: Record<MessageTone, string> = {
  professional_reminder:
    'Write a professional, polite follow-up reminder. Acknowledge the client may be busy. ' +
    'State what is needed clearly and offer to help with any questions.',
  gentle_reengagement:
    'Write a warm, empathetic re-engagement message. Express that the team is still here to help. ' +
    'Avoid blame or urgency. Offer a simple next step to re-engage.',
  status_update:
    'Write a clear, informative status update. Lead with what has been accomplished. ' +
    'State the current phase and next expected milestone. Keep tone confident and transparent.',
  escalation_to_human:
    'Write an internal note recommending human follow-up. Summarize the engagement history, ' +
    'number of automated attempts, and days since last client contact. Suggest a phone call.',
  urgent_action:
    'Write a firm but respectful urgent action request. State the deadline or consequence clearly. ' +
    'Offer alternative ways to respond (phone, email, portal).',
};
