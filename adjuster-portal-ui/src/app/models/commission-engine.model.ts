/**
 * Commission Engine Domain Model
 *
 * Two-layer commission structure:
 *   Layer 1 (Master Split)   — Gross fee (100%) → House % + Field %
 *   Layer 2 (Field Allocation) — Field share (100% of field) → writing_agent + rvp_override + cp_override + reserve
 *
 * Writing agent is the financially-responsible party on a claim (carries advances, debit, interest).
 * Organizational role (Agent/RVP/CP) is separate from claim role.
 *
 * Source of truth is the append-only ledger. All balances and summaries are derived, never overwritten.
 */

export enum OrgRole {
  AGENT = 'AGENT',
  RVP = 'RVP',
  CP = 'CP',
  ADMIN = 'ADMIN',
}

export enum ClaimStage {
  INTAKE_SIGNED = 'INTAKE_SIGNED',
  INSPECTION_SCHEDULED = 'INSPECTION_SCHEDULED',
  INSPECTION_COMPLETED = 'INSPECTION_COMPLETED',
  ESTIMATE_IN_PROGRESS = 'ESTIMATE_IN_PROGRESS',
  ESTIMATE_SUBMITTED = 'ESTIMATE_SUBMITTED',
  CARRIER_REVIEW = 'CARRIER_REVIEW',
  NEGOTIATION = 'NEGOTIATION',
  SUPPLEMENT_SUBMITTED = 'SUPPLEMENT_SUBMITTED',
  APPRAISAL = 'APPRAISAL',
  LITIGATION = 'LITIGATION',
  SETTLEMENT_REACHED = 'SETTLEMENT_REACHED',
  PAID = 'PAID',
}

export const CLAIM_STAGE_LABELS: Record<ClaimStage, string> = {
  [ClaimStage.INTAKE_SIGNED]: 'Intake (Signed)',
  [ClaimStage.INSPECTION_SCHEDULED]: 'Inspection Scheduled',
  [ClaimStage.INSPECTION_COMPLETED]: 'Inspection Completed',
  [ClaimStage.ESTIMATE_IN_PROGRESS]: 'Estimate in Progress',
  [ClaimStage.ESTIMATE_SUBMITTED]: 'Estimate Submitted',
  [ClaimStage.CARRIER_REVIEW]: 'Carrier Review',
  [ClaimStage.NEGOTIATION]: 'Negotiation',
  [ClaimStage.SUPPLEMENT_SUBMITTED]: 'Supplement Submitted',
  [ClaimStage.APPRAISAL]: 'Appraisal',
  [ClaimStage.LITIGATION]: 'Litigation',
  [ClaimStage.SETTLEMENT_REACHED]: 'Settlement Reached',
  [ClaimStage.PAID]: 'Paid',
};

export const CLAIM_STAGE_ORDER: ClaimStage[] = [
  ClaimStage.INTAKE_SIGNED,
  ClaimStage.INSPECTION_SCHEDULED,
  ClaimStage.INSPECTION_COMPLETED,
  ClaimStage.ESTIMATE_IN_PROGRESS,
  ClaimStage.ESTIMATE_SUBMITTED,
  ClaimStage.CARRIER_REVIEW,
  ClaimStage.NEGOTIATION,
  ClaimStage.SUPPLEMENT_SUBMITTED,
  ClaimStage.APPRAISAL,
  ClaimStage.LITIGATION,
  ClaimStage.SETTLEMENT_REACHED,
  ClaimStage.PAID,
];

export const TERMINAL_STAGES: ReadonlySet<ClaimStage> = new Set([ClaimStage.PAID]);

export enum CommissionBucket {
  HOUSE = 'house',
  WRITING_AGENT = 'writing_agent',
  RVP_OVERRIDE = 'rvp_override',
  CP_OVERRIDE = 'cp_override',
  RESERVE = 'reserve',
}

export enum LedgerTransactionType {
  COMMISSION_EARNED = 'commission_earned',
  PAYOUT_ISSUED = 'payout_issued',
  ADVANCE_ISSUED = 'advance_issued',
  INTEREST_APPLIED = 'interest_applied',
  REPAYMENT_OFFSET = 'repayment_offset',
  ADJUSTMENT = 'adjustment',
}

/**
 * Append-only ledger entry. Never mutate; add a new entry (e.g., ADJUSTMENT) to correct.
 *
 * - COMMISSION_EARNED carries `bucket` (which of the 5 buckets is being credited).
 * - ADVANCE_ISSUED / INTEREST_APPLIED / REPAYMENT_OFFSET always scope to bucket=WRITING_AGENT.
 * - ADJUSTMENT can target any bucket.
 */
export interface LedgerTransaction {
  id: string;
  claim_id: string;
  user_id: string;
  type: LedgerTransactionType;
  bucket: CommissionBucket;
  amount: number;
  timestamp: string;
  memo?: string;
  metadata?: Record<string, unknown>;
}

export interface MasterSplit {
  house_percent: number;
  field_percent: number;
}

export interface FieldAllocation {
  writing_agent_percent: number;
  rvp_override_percent: number;
  cp_override_percent: number;
  reserve_percent: number;
}

export interface CommissionStructure {
  gross_fee: number;
  master_split: MasterSplit;
  field_allocation: FieldAllocation;
}

export interface BucketBreakdown {
  bucket: CommissionBucket;
  label: string;
  percent_of_gross: number;
  amount: number;
  recipient_user_id?: string;
}

/**
 * Two-section breakdown (the only way the UI should present commission structure):
 *   A) House   — master split, shown separately
 *   B) Field   — normalized to 100% of field, split among writing_agent / rvp / cp
 * House MUST NOT be shown as a segment in the same bar as field recipients.
 */
export interface ClaimTwoSectionBreakdown {
  claim_id: string;
  claim_ref: string;
  gross_fee: number;
  house: {
    percent_of_gross: number;   // e.g. 50
    amount: number;
  };
  field_total: {
    percent_of_gross: number;   // e.g. 50
    amount: number;
  };
  field_buckets: Array<{
    bucket: CommissionBucket;
    label: string;
    percent_of_field: number;   // normalized within field (sums to 100)
    percent_of_gross: number;   // for reference/tooltips
    amount: number;
    recipient_user_id?: string;
  }>;
}

export interface Claim {
  id: string;
  ref_string: string;
  client_name: string;
  stage: ClaimStage;
  writing_agent_id: string;
  rvp_override_user_id?: string;
  cp_override_user_id?: string;
  assigned_to?: string;
  gross_fee: number;
  commission_structure: CommissionStructure;
  opened_at: string;
}

export interface User {
  id: string;
  name: string;
  org_role: OrgRole;
  avatar_initials: string;
}

export interface MonthlyTarget {
  user_id: string;
  role_default: number;
  admin_override?: number;
  user_adjusted?: number;
  allowed_min: number;
  allowed_max: number;
  effective: number;
}

/* ------------------------------------------------------------------
 * Derived / view-model types (engine outputs)
 * ------------------------------------------------------------------ */

export interface BalanceCardView {
  writing_agent_id: string;
  total_advance_support_received: number;
  total_recovered_from_earnings: number;
  remaining_balance: number;
}

/**
 * The three numbers an agent sees on the main earnings tab.
 * Derived from the ledger:
 *   total_earned     = sum of COMMISSION_EARNED in WRITING_AGENT bucket
 *   paid_to_date     = |sum of PAYOUT_ISSUED| in WRITING_AGENT bucket
 *   remaining_balance = total_earned − paid_to_date  (clamped at 0)
 */
export interface AgentSimpleEarningsView {
  user_id: string;
  total_earned: number;
  paid_to_date: number;
  remaining_balance: number;
}

export interface EarningsSummaryView {
  user_id: string;
  commissions_earned: number;
  net_payout: number;
  active_claims_count: number;
  future_pipeline_value: number;
  monthly_target: number;
  month_to_date_earned: number;
  progress_percent: number;
}

export interface StageCard {
  stage: ClaimStage;
  label: string;
  claim_count: number;
  projected_field_value: number;
}

export interface AdvanceSupportView {
  writing_agent_id: string;
  active_advance_count: number;
  total_outstanding: number;
  account_position_label: string;
  account_position_tone: 'positive' | 'neutral' | 'caution';
}

export interface FinancialDetailRow {
  date: string;
  claim_ref: string;
  type: LedgerTransactionType;
  bucket: CommissionBucket;
  amount: number;
  memo?: string;
  running_balance: number;
}

export interface FinancialDetailView {
  writing_agent_id: string;
  advances_total: number;
  offsets_total: number;
  interest_total: number;
  adjustments_total: number;
  remaining_balance: number;
  rows: FinancialDetailRow[];
  /**
   * Two-section breakdown per claim. House first (one section), then field (normalized).
   * The UI MUST render these as two distinct visual groups, not a single 4-color bar.
   */
  bucket_breakdown_by_claim: ClaimTwoSectionBreakdown[];
}

export interface AdminAggregateRow {
  user_id: string;
  user_name: string;
  org_role: OrgRole;
  commissions_earned_mtd: number;
  advances_outstanding: number;
  remaining_balance: number;
  active_claims: number;
  taxable_1099_ytd: number;   // per-agent YTD disbursements (for 1099 reporting)
}

export interface AdminOverviewView {
  total_gross_fee_mtd: number;
  house_share_mtd: number;
  field_share_mtd: number;
  reserve_mtd: number;
  outstanding_advances_total: number;
  rows: AdminAggregateRow[];
}

/* ------------------------------------------------------------------
 * Premium-dashboard view-models (layered on top of existing ledger math)
 * ------------------------------------------------------------------ */

export interface EarningsTrendPoint {
  month_label: string;   // e.g. "Nov"
  month_key: string;     // e.g. "2025-11"
  earned: number;
  is_current: boolean;
}

export interface EarningsTrendView {
  user_id: string;
  points: EarningsTrendPoint[];   // 6 points, chronological
  current_month: number;
  prior_month: number;
  delta_percent: number;          // + or -; 0 if prior_month is 0
}

export interface RecentActivityItem {
  id: string;
  type: LedgerTransactionType;
  bucket: CommissionBucket;
  claim_ref?: string;
  amount: number;
  timestamp: string;
  memo?: string;
}

export interface ActiveClaimContribution {
  claim_id: string;
  claim_ref: string;
  client_name: string;
  stage: ClaimStage;
  stage_label: string;
  projected_agent_share: number;
}

export interface ClaimEarningsRow {
  claim_id: string;
  claim_ref: string;
  client_name: string;
  stage: ClaimStage;
  stage_label: string;
  earned: number;
  paid: number;
  remaining: number;
}

export interface NextExpectedPayoutView {
  estimated_date: string;   // ISO date, or '' if none
  estimated_amount: number;
  status_label: string;     // 'Processing' | 'Scheduled' | 'No payout pending'
  has_pending: boolean;
}

/* ------------------------------------------------------------------
 * 1099 / Tax view
 * ------------------------------------------------------------------
 * Business rule: advances are considered taxable payouts.
 * 1099 YTD = |sum of PAYOUT_ISSUED in calendar year|
 *         + |sum of ADVANCE_ISSUED in calendar year|
 * filtered to WRITING_AGENT bucket for this user.
 *
 * Explicitly NOT based on: gross earned commission, remaining balance,
 * or unpaid accruals.
 * ------------------------------------------------------------------ */
export interface Taxable1099View {
  user_id: string;
  year: number;
  ytd_total: number;        // total disbursed to agent (reportable to IRS)
  payout_total: number;     // |Σ PAYOUT_ISSUED| YTD
  advance_total: number;    // |Σ ADVANCE_ISSUED| YTD (advances are taxable)
  transaction_count: number;
}

/* ------------------------------------------------------------------
 * Statements — branded, downloadable financial documents
 * ------------------------------------------------------------------ */

export type StatementPeriodType = 'week' | 'month' | 'year' | 'custom';

export interface StatementPeriod {
  type: StatementPeriodType;
  start: string;   // ISO date
  end: string;     // ISO date (inclusive)
  label: string;   // human readable e.g. "April 2026" or "Apr 1 – Apr 7, 2026"
}

export interface StatementClaimDetail {
  claim_id: string;
  claim_ref: string;
  client_name: string;
  stage_label: string;
  earned_in_period: number;
  paid_in_period: number;
  advances_in_period: number;
}

export interface StatementTransactionRow {
  id: string;
  date: string;
  claim_ref?: string;
  type: LedgerTransactionType;
  type_label: string;
  amount: number;
  memo?: string;
}

export interface StatementView {
  user_id: string;
  user_name: string;
  user_role: string;
  period: StatementPeriod;
  generated_at: string;      // ISO timestamp

  // Summary totals on a commission statement are CUMULATIVE through period end —
  // same source/semantics as the dashboard's earnings card, so the numbers reconcile.
  // In-period activity is surfaced via claim_details + transactions below.
  opening_balance: number;   // cumulative (earned − paid + adjustments) BEFORE period start
  total_earned: number;      // Σ COMMISSION_EARNED in writing_agent bucket through period end
  total_paid: number;        // |Σ PAYOUT_ISSUED| through period end
  advances_issued: number;   // |Σ ADVANCE_ISSUED| through period end
  closing_balance: number;   // max(0, Earned − Paid) cumulative — matches dashboard Remaining Balance

  taxable_1099_ytd: number;  // cumulative YTD as of period end

  claim_details: StatementClaimDetail[];
  transactions: StatementTransactionRow[];
}

export interface StatementBranding {
  company_name: string;
  company_short: string;
  logo_path: string;             // path under /assets or absolute URL
  address_lines: string[];
  footer_tagline: string;
  accent_hex: string;            // primary brand color for dividers/accents
  contact_email?: string;
  contact_phone?: string;
  ein?: string;                  // for 1099 reporting
}
