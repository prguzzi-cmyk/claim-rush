/**
 * Follow-Up Sequence Configurations
 *
 * Pre-built engagement sequences for common claim bottlenecks.
 * Each sequence defines timed steps with channel, template, and escalation rules.
 *
 * To add new sequences: append to ENGAGEMENT_SEQUENCES below.
 * The ClaimEngagementEngine reads from this array at runtime.
 */

import { FollowUpSequence, EscalationRule, DEFAULT_ESCALATION_RULE } from '../shared/models/claim-engagement.model';

// ── Follow-Up Sequences ────────────────────────────────────────

export const ENGAGEMENT_SEQUENCES: FollowUpSequence[] = [
  {
    id: 'missing_documents',
    name: 'Missing Documents Follow-Up',
    triggerCondition: 'Client has not uploaded required documents',
    steps: [
      { stepNumber: 1, delayDays: 3,  channel: 'email',               templateKey: 'missing_docs_reminder_1',  escalateOnNoResponse: false },
      { stepNumber: 2, delayDays: 7,  channel: 'sms',                 templateKey: 'missing_docs_reminder_2',  escalateOnNoResponse: false },
      { stepNumber: 3, delayDays: 14, channel: 'portal_notification', templateKey: 'missing_docs_urgent',      escalateOnNoResponse: true },
    ],
  },
  {
    id: 'unsigned_forms',
    name: 'Unsigned Forms Follow-Up',
    triggerCondition: 'Client has not signed required forms',
    steps: [
      { stepNumber: 1, delayDays: 2,  channel: 'email',               templateKey: 'unsigned_forms_reminder_1', escalateOnNoResponse: false },
      { stepNumber: 2, delayDays: 5,  channel: 'sms',                 templateKey: 'unsigned_forms_reminder_2', escalateOnNoResponse: false },
      { stepNumber: 3, delayDays: 10, channel: 'portal_notification', templateKey: 'unsigned_forms_urgent',     escalateOnNoResponse: true },
    ],
  },
  {
    id: 'pending_approval',
    name: 'Pending Approval Follow-Up',
    triggerCondition: 'Client has not approved estimate or scope',
    steps: [
      { stepNumber: 1, delayDays: 3,  channel: 'email',               templateKey: 'approval_reminder_1',  escalateOnNoResponse: false },
      { stepNumber: 2, delayDays: 7,  channel: 'sms',                 templateKey: 'approval_reminder_2',  escalateOnNoResponse: false },
      { stepNumber: 3, delayDays: 14, channel: 'task_creation',       templateKey: 'approval_escalation',  escalateOnNoResponse: true },
    ],
  },
  {
    id: 'unanswered_questions',
    name: 'Unanswered Questions Follow-Up',
    triggerCondition: 'Adjuster question has gone unanswered',
    steps: [
      { stepNumber: 1, delayDays: 3,  channel: 'email',               templateKey: 'question_followup_1', escalateOnNoResponse: false },
      { stepNumber: 2, delayDays: 7,  channel: 'sms',                 templateKey: 'question_followup_2', escalateOnNoResponse: false },
      { stepNumber: 3, delayDays: 10, channel: 'portal_notification', templateKey: 'question_urgent',     escalateOnNoResponse: true },
    ],
  },
  {
    id: 'stalled_intake',
    name: 'Stalled Intake Follow-Up',
    triggerCondition: 'Client intake process has stalled',
    steps: [
      { stepNumber: 1, delayDays: 2,  channel: 'email',               templateKey: 'intake_reminder_1',    escalateOnNoResponse: false },
      { stepNumber: 2, delayDays: 5,  channel: 'sms',                 templateKey: 'intake_reminder_2',    escalateOnNoResponse: false },
      { stepNumber: 3, delayDays: 10, channel: 'portal_notification', templateKey: 'intake_urgent',        escalateOnNoResponse: true },
    ],
  },
  {
    id: 'inactive_portal',
    name: 'Inactive Portal Follow-Up',
    triggerCondition: 'Client has not logged into the portal',
    steps: [
      { stepNumber: 1, delayDays: 7,  channel: 'email',               templateKey: 'portal_login_reminder_1', escalateOnNoResponse: false },
      { stepNumber: 2, delayDays: 14, channel: 'sms',                 templateKey: 'portal_login_reminder_2', escalateOnNoResponse: false },
      { stepNumber: 3, delayDays: 21, channel: 'task_creation',       templateKey: 'portal_inactive_escalation', escalateOnNoResponse: true },
    ],
  },
  {
    id: 'general_reengagement',
    name: 'General Re-Engagement',
    triggerCondition: 'No client activity detected across all channels',
    steps: [
      { stepNumber: 1, delayDays: 5,  channel: 'email',               templateKey: 'reengagement_gentle_1',  escalateOnNoResponse: false },
      { stepNumber: 2, delayDays: 10, channel: 'sms',                 templateKey: 'reengagement_gentle_2',  escalateOnNoResponse: false },
      { stepNumber: 3, delayDays: 14, channel: 'portal_notification', templateKey: 'reengagement_nudge',     escalateOnNoResponse: false },
      { stepNumber: 4, delayDays: 21, channel: 'task_creation',       templateKey: 'reengagement_escalation', escalateOnNoResponse: true },
    ],
  },
];

// ── Escalation Rules ───────────────────────────────────────────

export const ESCALATION_RULES: Record<string, EscalationRule> = {
  default: DEFAULT_ESCALATION_RULE,
  urgent: {
    maxAutomatedAttempts: 2,
    escalationActions: [
      'create_adjuster_task',
      'flag_claim_stalled',
      'recommend_phone_outreach',
    ],
  },
  relaxed: {
    maxAutomatedAttempts: 4,
    escalationActions: [
      'create_adjuster_task',
      'recommend_phone_outreach',
    ],
  },
};

// ── Message Templates (Claude-Ready Placeholders) ──────────────

export interface EngagementMessageTemplate {
  key: string;
  name: string;
  channel: 'email' | 'sms' | 'portal_notification' | 'task_creation';
  subject?: string;
  body: string;
  tone: 'professional_reminder' | 'gentle_reengagement' | 'status_update' | 'escalation_to_human' | 'urgent_action';
  /** When true, the body is a placeholder that should be refined by Claude
   *  using claim context before sending. */
  claudeRefinable: boolean;
}

export const ENGAGEMENT_TEMPLATES: EngagementMessageTemplate[] = [
  // ── Missing Documents ──
  {
    key: 'missing_docs_reminder_1',
    name: 'Missing Documents — First Reminder',
    channel: 'email',
    subject: 'Action Needed: Documents Required for Your Claim',
    body: 'Hi {{client_name}},\n\nWe are working on your claim ({{claim_number}}) and need a few documents to move forward. Please log in to your portal and upload the required items at your earliest convenience.\n\nIf you have any questions, do not hesitate to reach out.\n\nThank you,\n{{adjuster_name}}',
    tone: 'professional_reminder',
    claudeRefinable: true,
  },
  {
    key: 'missing_docs_reminder_2',
    name: 'Missing Documents — Second Reminder (SMS)',
    channel: 'sms',
    body: 'Hi {{client_name}}, your claim {{claim_number}} is waiting on documents. Please log in to upload them or reply to this message with questions. — {{adjuster_name}}',
    tone: 'professional_reminder',
    claudeRefinable: true,
  },
  {
    key: 'missing_docs_urgent',
    name: 'Missing Documents — Urgent Portal Alert',
    channel: 'portal_notification',
    body: 'Your claim cannot proceed without the required documents. Please upload them now to avoid delays.',
    tone: 'urgent_action',
    claudeRefinable: false,
  },

  // ── Unsigned Forms ──
  {
    key: 'unsigned_forms_reminder_1',
    name: 'Unsigned Forms — First Reminder',
    channel: 'email',
    subject: 'Signature Required: Please Sign Your Claim Documents',
    body: 'Hi {{client_name}},\n\nWe have documents ready for your signature on claim {{claim_number}}. Please log in to your portal to review and sign.\n\nThis step is required before we can proceed with your claim.\n\nThank you,\n{{adjuster_name}}',
    tone: 'professional_reminder',
    claudeRefinable: true,
  },
  {
    key: 'unsigned_forms_reminder_2',
    name: 'Unsigned Forms — Second Reminder (SMS)',
    channel: 'sms',
    body: 'Hi {{client_name}}, your claim {{claim_number}} needs your signature to proceed. Please log in or call us. — {{adjuster_name}}',
    tone: 'professional_reminder',
    claudeRefinable: true,
  },
  {
    key: 'unsigned_forms_urgent',
    name: 'Unsigned Forms — Urgent Alert',
    channel: 'portal_notification',
    body: 'Your claim is paused pending your signature. Please sign the required documents to continue.',
    tone: 'urgent_action',
    claudeRefinable: false,
  },

  // ── Pending Approval ──
  {
    key: 'approval_reminder_1',
    name: 'Pending Approval — First Reminder',
    channel: 'email',
    subject: 'Your Approval Is Needed to Continue Your Claim',
    body: 'Hi {{client_name}},\n\nYour claim {{claim_number}} has an item awaiting your approval. Please review it in your portal and let us know if you have any questions.\n\nThank you,\n{{adjuster_name}}',
    tone: 'professional_reminder',
    claudeRefinable: true,
  },
  {
    key: 'approval_reminder_2',
    name: 'Pending Approval — Second Reminder (SMS)',
    channel: 'sms',
    body: 'Hi {{client_name}}, your approval is needed on claim {{claim_number}}. Please log in or call us to proceed. — {{adjuster_name}}',
    tone: 'professional_reminder',
    claudeRefinable: true,
  },
  {
    key: 'approval_escalation',
    name: 'Pending Approval — Escalation Task',
    channel: 'task_creation',
    body: 'Client {{client_name}} has not responded to approval requests on claim {{claim_number}} after {{reminder_count}} automated reminders over {{days_waiting}} days. Recommend phone outreach.',
    tone: 'escalation_to_human',
    claudeRefinable: false,
  },

  // ── Unanswered Questions ──
  {
    key: 'question_followup_1',
    name: 'Unanswered Question — First Follow-Up',
    channel: 'email',
    subject: 'Following Up: Question About Your Claim',
    body: 'Hi {{client_name}},\n\nWe sent you a question about your claim {{claim_number}} and have not received a response yet. Your input is needed for us to continue working on your file.\n\nPlease reply to this email or log in to your portal.\n\nThank you,\n{{adjuster_name}}',
    tone: 'professional_reminder',
    claudeRefinable: true,
  },
  {
    key: 'question_followup_2',
    name: 'Unanswered Question — Second Follow-Up (SMS)',
    channel: 'sms',
    body: 'Hi {{client_name}}, we have an open question on claim {{claim_number}}. Please reply or call us at your convenience. — {{adjuster_name}}',
    tone: 'gentle_reengagement',
    claudeRefinable: true,
  },
  {
    key: 'question_urgent',
    name: 'Unanswered Question — Urgent Alert',
    channel: 'portal_notification',
    body: 'Your adjuster has a question that needs your response before your claim can proceed.',
    tone: 'urgent_action',
    claudeRefinable: false,
  },

  // ── Stalled Intake ──
  {
    key: 'intake_reminder_1',
    name: 'Stalled Intake — First Reminder',
    channel: 'email',
    subject: 'Let\'s Complete Your Claim Intake',
    body: 'Hi {{client_name}},\n\nIt looks like your claim intake for {{claim_number}} was started but not completed. We are here to help you through the process.\n\nPlease log in to finish your intake, or call us if you need assistance.\n\nThank you,\n{{adjuster_name}}',
    tone: 'gentle_reengagement',
    claudeRefinable: true,
  },
  {
    key: 'intake_reminder_2',
    name: 'Stalled Intake — Second Reminder (SMS)',
    channel: 'sms',
    body: 'Hi {{client_name}}, your claim intake is incomplete. Log in to finish or reply for help. — {{adjuster_name}}',
    tone: 'gentle_reengagement',
    claudeRefinable: true,
  },
  {
    key: 'intake_urgent',
    name: 'Stalled Intake — Urgent Alert',
    channel: 'portal_notification',
    body: 'Your claim intake is incomplete. Please complete it to begin the claims process.',
    tone: 'urgent_action',
    claudeRefinable: false,
  },

  // ── Inactive Portal ──
  {
    key: 'portal_login_reminder_1',
    name: 'Inactive Portal — Login Reminder',
    channel: 'email',
    subject: 'You Have Updates Waiting in Your Claims Portal',
    body: 'Hi {{client_name}},\n\nThere are updates on your claim {{claim_number}} waiting for you in your portal. Please log in to review the latest progress on your file.\n\nThank you,\n{{adjuster_name}}',
    tone: 'status_update',
    claudeRefinable: true,
  },
  {
    key: 'portal_login_reminder_2',
    name: 'Inactive Portal — SMS Reminder',
    channel: 'sms',
    body: 'Hi {{client_name}}, your claims portal has updates. Log in to see the latest on claim {{claim_number}}. — {{adjuster_name}}',
    tone: 'gentle_reengagement',
    claudeRefinable: true,
  },
  {
    key: 'portal_inactive_escalation',
    name: 'Inactive Portal — Escalation Task',
    channel: 'task_creation',
    body: 'Client {{client_name}} has not logged into the portal for {{days_waiting}} days on claim {{claim_number}}. No response to {{reminder_count}} automated reminders. Recommend phone outreach.',
    tone: 'escalation_to_human',
    claudeRefinable: false,
  },

  // ── General Re-Engagement ──
  {
    key: 'reengagement_gentle_1',
    name: 'Re-Engagement — Gentle Email',
    channel: 'email',
    subject: 'We Are Still Here for You',
    body: 'Hi {{client_name}},\n\nWe wanted to check in on your claim {{claim_number}}. We have not heard from you recently, and we want to make sure everything is okay.\n\nYour claim is still active, and we are ready to continue working on your behalf whenever you are ready.\n\nPlease do not hesitate to reach out.\n\nWarm regards,\n{{adjuster_name}}',
    tone: 'gentle_reengagement',
    claudeRefinable: true,
  },
  {
    key: 'reengagement_gentle_2',
    name: 'Re-Engagement — Gentle SMS',
    channel: 'sms',
    body: 'Hi {{client_name}}, just checking in on claim {{claim_number}}. We are still working for you. Reply or call anytime. — {{adjuster_name}}',
    tone: 'gentle_reengagement',
    claudeRefinable: true,
  },
  {
    key: 'reengagement_nudge',
    name: 'Re-Engagement — Portal Nudge',
    channel: 'portal_notification',
    body: 'We are waiting on you to continue your claim. Please log in to review your file and let us know how to help.',
    tone: 'gentle_reengagement',
    claudeRefinable: false,
  },
  {
    key: 'reengagement_escalation',
    name: 'Re-Engagement — Escalation Task',
    channel: 'task_creation',
    body: 'Client {{client_name}} has been unresponsive on claim {{claim_number}} for {{days_waiting}} days. {{reminder_count}} automated attempts made. Recommend direct phone call to re-engage.',
    tone: 'escalation_to_human',
    claudeRefinable: false,
  },

  // ── Voice Fallback Templates ──
  {
    key: 'voice_fallback_sms',
    name: 'Voice Fallback — SMS After No Answer',
    channel: 'sms',
    body: 'Hi {{client_name}}, we tried to reach you about a potential property claim. Please call us back or reply to this message. — {{adjuster_name}}',
    tone: 'gentle_reengagement',
    claudeRefinable: true,
  },
  {
    key: 'voice_fallback_email',
    name: 'Voice Fallback — Email After No Answer',
    channel: 'email',
    subject: 'We Tried to Reach You About Your Property',
    body: 'Hi {{client_name}},\n\nWe attempted to call you regarding a potential property claim at your address. We were unable to reach you by phone.\n\nIf you have experienced property damage and would like a free inspection, please reply to this email or call us at your convenience.\n\nThank you,\n{{adjuster_name}}',
    tone: 'gentle_reengagement',
    claudeRefinable: true,
  },
];

/** Get a template by its key. */
export function getEngagementTemplate(key: string): EngagementMessageTemplate | undefined {
  return ENGAGEMENT_TEMPLATES.find(t => t.key === key);
}

/** Get all templates for a specific channel. */
export function getTemplatesByChannel(channel: string): EngagementMessageTemplate[] {
  return ENGAGEMENT_TEMPLATES.filter(t => t.channel === channel);
}

/** Get the sequence definition by ID. */
export function getSequenceById(id: string): FollowUpSequence | undefined {
  return ENGAGEMENT_SEQUENCES.find(s => s.id === id);
}
