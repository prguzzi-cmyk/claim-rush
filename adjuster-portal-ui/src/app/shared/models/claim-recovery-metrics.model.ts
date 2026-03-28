/**
 * Claim Recovery Metrics Models
 *
 * Aggregated recovery metrics for the dashboard, performance tracking,
 * and reporting. Extends the existing ClaimFinancialSnapshot pattern
 * with dashboard-level aggregation, adjuster performance, and timeline events.
 *
 * Does NOT duplicate:
 * - ClaimFinancialSnapshot (per-claim financial calculation)
 * - ComparisonResult (per-estimate comparison data)
 * - ClaimPayment (per-payment records)
 * - ClaimMetrics (per-claim combined metrics)
 */

// ── Recovery Status Classification ─────────────────────────────

export type RecoveryStatus =
  | 'estimating'
  | 'carrier_review'
  | 'supplement_requested'
  | 'negotiation'
  | 'partial_payment'
  | 'fully_recovered'
  | 'closed';

export const RECOVERY_STATUS_META: Record<RecoveryStatus, {
  label: string;
  icon: string;
  color: string;
  order: number;
}> = {
  estimating:            { label: 'Estimating',            icon: 'calculate',     color: '#2196f3', order: 1 },
  carrier_review:        { label: 'Carrier Review',        icon: 'rate_review',   color: '#ff9800', order: 2 },
  supplement_requested:  { label: 'Supplement Requested',  icon: 'request_quote', color: '#9c27b0', order: 3 },
  negotiation:           { label: 'Negotiation',           icon: 'handshake',     color: '#e65100', order: 4 },
  partial_payment:       { label: 'Partial Payment',       icon: 'payments',      color: '#00838f', order: 5 },
  fully_recovered:       { label: 'Fully Recovered',       icon: 'check_circle',  color: '#4caf50', order: 6 },
  closed:                { label: 'Closed',                icon: 'lock',          color: '#9e9e9e', order: 7 },
};

// ── Per-Claim Recovery Record ──────────────────────────────────

/** Single claim's recovery metrics (row in the dashboard table). */
export interface ClaimRecoveryRecord {
  claimId: string;
  projectId: string;
  claimNumber: string;
  clientName: string;
  carrierName: string;
  assignedAdjusterId: string | null;
  assignedAdjusterName: string | null;

  carrierEstimateTotal: number;
  aciEstimateTotal: number;
  supplementRequestedTotal: number;
  supplementRecoveredTotal: number;
  carrierPaidTotal: number;
  totalRecoveryAboveCarrier: number;
  remainingRecoverable: number;
  recoveryPercent: number;

  recoveryStatus: RecoveryStatus;
  claimPhase: string | null;
  createdAt: string | null;
  lastPaymentDate: string | null;
}

// ── Dashboard Aggregated Metrics ───────────────────────────────

export interface RecoveryDashboardMetrics {
  totalClaimsActive: number;
  totalCarrierEstimates: number;
  totalAciEstimates: number;
  totalSupplementsRequested: number;
  totalSupplementsRecovered: number;
  averageRecoveryPerClaim: number;
  recoveryPercentVsCarrier: number;

  // Existing fields from backend (preserved for compatibility)
  totalClaims: number;
  totalAciValue: number;
  totalCarrierValue: number;
  totalRecoverable: number;
  totalRecovered: number;
  avgRecoveryPct: number;

  // Status breakdown
  statusCounts: Record<string, number>;

  // Per-claim records
  claims: ClaimRecoveryRecord[];
}

// ── Adjuster Performance Metrics ───────────────────────────────

export interface AdjusterPerformanceMetrics {
  adjusterId: string;
  adjusterName: string;
  claimsHandled: number;
  totalRecovery: number;
  averageRecoveryPerClaim: number;
  supplementSuccessRate: number;
  avgClaimCycleDays: number | null;
  supplementsSubmitted: number;
  supplementsRecovered: number;
}

// ── Monthly Trend Data ─────────────────────────────────────────

export interface MonthlyRecoveryTrend {
  month: string;
  recovered: number;
  supplementsSubmitted: number;
  supplementsRecovered: number;
  claimsClosed: number;
}

// ── Recovery Timeline Event ────────────────────────────────────

export type RecoveryTimelineEventType =
  | 'estimate_submitted'
  | 'carrier_estimate_received'
  | 'supplement_generated'
  | 'supplement_submitted'
  | 'carrier_payment_received';

export const RECOVERY_TIMELINE_META: Record<RecoveryTimelineEventType, {
  label: string;
  icon: string;
  color: string;
}> = {
  estimate_submitted:         { label: 'Estimate Submitted',         icon: 'calculate',     color: '#1565c0' },
  carrier_estimate_received:  { label: 'Carrier Estimate Received',  icon: 'business',      color: '#e65100' },
  supplement_generated:       { label: 'Supplement Generated',       icon: 'request_quote', color: '#7b1fa2' },
  supplement_submitted:       { label: 'Supplement Submitted',       icon: 'send',          color: '#00838f' },
  carrier_payment_received:   { label: 'Carrier Payment Received',   icon: 'payments',      color: '#2e7d32' },
};

// ── Role Visibility ────────────────────────────────────────────

export type DashboardRole = 'agent' | 'rvp' | 'owner';

export interface DashboardFilter {
  role: DashboardRole;
  adjusterId: string | null;
  teamIds: string[];
  dateRange: { start: string; end: string } | null;
  recoveryStatus: RecoveryStatus | null;
}