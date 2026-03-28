/**
 * Intelligent Follow-Up System — Models
 *
 * Tracks user activity states and defines follow-up sequences
 * for automated re-engagement across SMS, email, and voice channels.
 */

// ── User Activity States ─────────────────────────────────────────

export type UserClaimState =
  | 'started_no_photos'
  | 'photos_uploaded_no_continue'
  | 'insights_viewed_no_review'
  | 'review_requested_no_schedule'
  | 'scheduled_no_attendance'
  | 'completed';

export const USER_STATE_META: Record<UserClaimState, {
  label: string;
  description: string;
  priority: number;
}> = {
  started_no_photos:            { label: 'Started — No Photos',       description: 'Started claim but did not upload photos',        priority: 3 },
  photos_uploaded_no_continue:  { label: 'Photos — No Continue',      description: 'Uploaded photos but did not continue',            priority: 2 },
  insights_viewed_no_review:    { label: 'Insights — No Review',      description: 'Viewed AI insights but did not request review',   priority: 2 },
  review_requested_no_schedule: { label: 'Review — No Schedule',      description: 'Requested review but did not schedule',           priority: 1 },
  scheduled_no_attendance:      { label: 'Scheduled — No Attendance', description: 'Scheduled but did not attend',                    priority: 1 },
  completed:                    { label: 'Completed',                 description: 'Completed the full flow',                        priority: 5 },
};

// ── Follow-Up Types ──────────────────────────────────────────────

export type FollowUpType = 'reminder' | 're_engagement' | 'reinforcement';

export type FollowUpChannel = 'sms' | 'email' | 'voice';

export type FollowUpStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';

// ── Follow-Up Sequence Step ──────────────────────────────────────

export interface FollowUpStep {
  delayMinutes: number;
  type: FollowUpType;
  channel: FollowUpChannel;
  messageKey: string;
  status: FollowUpStatus;
  sentAt: string | null;
}

// ── Follow-Up Sequence ───────────────────────────────────────────

export interface FollowUpSequence {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  claimNumber: string | null;
  userState: UserClaimState;
  steps: FollowUpStep[];
  createdAt: string;
  completedAt: string | null;
  cancelled: boolean;
}

// ── Follow-Up Event (CRM audit log) ─────────────────────────────

export interface FollowUpEvent {
  id: string;
  sequenceId: string;
  clientId: string;
  type: FollowUpType;
  channel: FollowUpChannel;
  status: FollowUpStatus;
  messageKey: string;
  messageText: string;
  sentAt: string;
  deliveredAt: string | null;
  failureReason: string | null;
}

// ── Message Templates ────────────────────────────────────────────

export interface FollowUpMessage {
  key: string;
  type: FollowUpType;
  smsText: string;
  emailSubject: string;
  emailBody: string;
  voiceScript: string | null;
}

export const FOLLOW_UP_MESSAGES: Record<string, FollowUpMessage> = {
  // Reminders
  reminder_photos: {
    key: 'reminder_photos',
    type: 'reminder',
    smsText: "We're here when you're ready to continue your claim. Upload a few photos to get started.",
    emailSubject: 'Continue Your Claim',
    emailBody: "We noticed you started your claim but haven't uploaded photos yet. Whenever you're ready, just open your portal and upload a few photos of the damage. We'll take it from there.",
    voiceScript: null,
  },
  reminder_continue: {
    key: 'reminder_continue',
    type: 'reminder',
    smsText: "Your photos are uploaded. Continue when you're ready — we'll guide you through the next steps.",
    emailSubject: 'Your Photos Are Ready for Review',
    emailBody: "We've received your property photos. When you're ready, continue through the portal and we'll walk you through what we found.",
    voiceScript: null,
  },
  reminder_schedule: {
    key: 'reminder_schedule',
    type: 'reminder',
    smsText: "We're ready to review your claim whenever you are. Schedule a time that works for you.",
    emailSubject: 'Schedule Your Claim Review',
    emailBody: "You requested a claim review and we'd love to walk through the details with you. Pick a time that works and we'll take care of the rest.",
    voiceScript: null,
  },

  // Re-engagement
  reengage_insights: {
    key: 'reengage_insights',
    type: 're_engagement',
    smsText: 'Many claims benefit from a closer review — you can continue anytime.',
    emailSubject: 'Your Claim Insights Are Ready',
    emailBody: "We've analyzed your property photos and found areas that may benefit from a closer review. Many claims have additional details that are easy to overlook. You can pick up where you left off anytime.",
    voiceScript: "Hi, this is a follow-up regarding your property claim. We've completed an initial review of your photos and found some areas worth looking at more closely. You can continue through your portal anytime, or we'd be happy to walk through it with you.",
  },
  reengage_general: {
    key: 'reengage_general',
    type: 're_engagement',
    smsText: 'Your claim is still open. Continue anytime — we\'re here to help.',
    emailSubject: 'Your Claim Is Still Open',
    emailBody: "Just a quick note to let you know your claim is still open and available in your portal. There's no rush — you can continue whenever it's convenient.",
    voiceScript: null,
  },

  // Reinforcement
  reinforce_scheduled: {
    key: 'reinforce_scheduled',
    type: 'reinforcement',
    smsText: "We're looking forward to reviewing your claim with you.",
    emailSubject: 'Your Claim Review Is Coming Up',
    emailBody: "Just a reminder that your claim review is coming up. We're looking forward to walking through everything with you and answering any questions.",
    voiceScript: "Hi, this is a quick reminder about your upcoming claim review. We're looking forward to connecting with you and going over the details of your claim.",
  },
  reinforce_missed: {
    key: 'reinforce_missed',
    type: 'reinforcement',
    smsText: 'We missed you. Would you like to reschedule your claim review? Reply YES to pick a new time.',
    emailSubject: 'Let\'s Reschedule Your Claim Review',
    emailBody: "It looks like we weren't able to connect at your scheduled time. No worries — you can reschedule anytime through your portal. We're still here to help.",
    voiceScript: null,
  },
};
