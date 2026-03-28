/**
 * Claim Command Center Models
 *
 * Unified operational view aggregating claim workflow state, tasks,
 * communications, supplement status, and payment tracking into
 * actionable queues and metrics.
 *
 * Does NOT duplicate:
 * - Claim (references existing claim fields)
 * - ClaimTask (reads task data, doesn't recreate it)
 * - ClaimFinancialSnapshot (delegates financial math to existing engine)
 * - ClaimStatusSnapshot (delegates phase logic to existing engine)
 * - RecoveryStatus (reuses existing classification)
 * - EngagementStatus (reuses existing engagement state)
 */

import { RecoveryStatus } from './claim-recovery-metrics.model';
import { EngagementStatus } from './claim-engagement.model';

// ── Claim Action Status ────────────────────────────────────────

export type ClaimActionStatus =
  | 'needs_estimate'
  | 'awaiting_carrier_response'
  | 'supplement_required'
  | 'supplement_submitted'
  | 'awaiting_payment'
  | 'payment_received'
  | 'claim_closed';

export const ACTION_STATUS_META: Record<ClaimActionStatus, {
  label: string;
  icon: string;
  color: string;
  queueName: string;
  priority: number;
}> = {
  needs_estimate:            { label: 'Needs Estimate',            icon: 'calculate',     color: '#2196f3', queueName: 'Claims Requiring Estimate',      priority: 1 },
  awaiting_carrier_response: { label: 'Awaiting Carrier Response', icon: 'hourglass_top', color: '#ff9800', queueName: 'Carriers Awaiting Response',     priority: 2 },
  supplement_required:       { label: 'Supplement Required',       icon: 'request_quote', color: '#9c27b0', queueName: 'Supplements Needing Submission', priority: 1 },
  supplement_submitted:      { label: 'Supplement Submitted',      icon: 'send',          color: '#00838f', queueName: 'Supplements Pending Response',   priority: 3 },
  awaiting_payment:          { label: 'Awaiting Payment',          icon: 'payments',      color: '#e65100', queueName: 'Payments Pending',               priority: 2 },
  payment_received:          { label: 'Payment Received',          icon: 'check_circle',  color: '#4caf50', queueName: 'Payments Received',              priority: 4 },
  claim_closed:              { label: 'Claim Closed',              icon: 'lock',          color: '#9e9e9e', queueName: 'Closed Claims',                  priority: 5 },
};

// ── Activity Signals ───────────────────────────────────────────

export interface ClaimActivitySignals {
  hasUnreadCommunications: boolean;
  hasOverdueTasks: boolean;
  isStalled: boolean;
  hasNewPayment: boolean;
  hasNewCarrierResponse: boolean;
  daysSinceLastActivity: number | null;
}

// ── Command Center Claim View ──────────────────────────────────

/** Unified per-claim operational view for the command center. */
export interface CommandCenterClaimView {
  // Claim identity
  claimId: string;
  claimNumber: string;
  refString: string;
  clientName: string;
  carrierName: string;
  propertyAddress: string;
  assignedAdjusterId: string | null;
  assignedAdjusterName: string | null;

  // Workflow state
  currentPhase: string;
  actionStatus: ClaimActionStatus;
  recoveryStatus: RecoveryStatus;
  engagementStatus: EngagementStatus;

  // Financial summary
  aciEstimate: number;
  carrierEstimate: number;
  supplementTotal: number;
  totalPaid: number;
  recoveryPercent: number;

  // Task summary
  totalTasks: number;
  overdueTasks: number;
  pendingTasks: number;

  // Communication summary
  unreadCount: number;
  lastCommunicationDate: string | null;

  // Activity signals
  signals: ClaimActivitySignals;

  // Metadata
  createdAt: string;
  lastActivityDate: string | null;
}

// ── Action Queue ───────────────────────────────────────────────

export interface ActionQueue {
  actionStatus: ClaimActionStatus;
  label: string;
  icon: string;
  color: string;
  claims: CommandCenterClaimView[];
  count: number;
}

// ── Dashboard Metrics ──────────────────────────────────────────

export interface CommandCenterMetrics {
  activeClaims: number;
  claimsNeedingAction: number;
  supplementsPending: number;
  paymentsIssuedToday: number;
  totalRecovered: number;

  byActionStatus: Record<ClaimActionStatus, number>;
  overdueTaskCount: number;
  stalledClaimCount: number;
  unreadCommunicationCount: number;
}

// ── Dashboard Filter ───────────────────────────────────────────

export type CommandCenterRole = 'agent' | 'rvp' | 'owner';

export interface CommandCenterFilter {
  role: CommandCenterRole;
  adjusterId: string | null;
  teamIds: string[];
  actionStatus: ClaimActionStatus | null;
  phase: string | null;
}
