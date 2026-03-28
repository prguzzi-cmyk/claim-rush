/**
 * Claim Financial Engine — Shared Models
 *
 * Central type definitions for all claim-financial data.
 * Used by: Recovery tab, Payments tab, Carrier Comparison, Supplement Engine, Dashboard KPIs.
 */

// ─── Financial Snapshot ────────────────────────────────────────────────────────

/** Core monetary metrics for a single claim. */
export interface ClaimFinancialSnapshot {
  /** ACI's full scope estimate (our number). */
  aciEstimateTotal: number;
  /** Carrier's approved/scoped estimate. */
  carrierEstimateTotal: number;
  /** Sum of all payments received to date. */
  paidToDate: number;
  /** max(aciEstimateTotal − paidToDate, 0) */
  unpaidGap: number;
  /** max(aciEstimateTotal − carrierEstimateTotal, 0) */
  recoverableGap: number;
  /** paidToDate / aciEstimateTotal * 100, safe against divide-by-zero. */
  recoveryPercent: number;
  /** True when aciEstimateTotal > carrierEstimateTotal OR unpaidGap > 0. */
  supplementOpportunity: boolean;
}

// ─── Status Snapshot ───────────────────────────────────────────────────────────

/** Normalised workflow / status state for a claim. */
export interface ClaimStatusSnapshot {
  /** Normalised claim phase (e.g. "Initial Review", "Supplement", "Closed"). */
  claimPhase: string;
  /** Most recent action taken by the carrier (e.g. "Estimate received"). */
  lastCarrierAction: string | null;
  /** Most recent action taken by the insured (e.g. "Documents uploaded"). */
  lastInsuredAction: string | null;
  /** Best-guess next step based on phase + payment/reinspection status. */
  pendingNextStep: string | null;
}

// ─── Combined Metrics ──────────────────────────────────────────────────────────

/** Full computed metrics for a claim — financial + status combined.
 *  This is what consumers (tabs, widgets, dashboards) should request. */
export interface ClaimMetrics {
  financials: ClaimFinancialSnapshot;
  status: ClaimStatusSnapshot;
  /** ISO timestamp of when these metrics were computed. */
  computedAt: string;
}

// ─── Raw API payloads (mapped from backend) ────────────────────────────────────

/** Shape returned by ClaimService.getClaimPaymentSummary(). */
export interface PaymentSummaryPayload {
  aci_estimate_total?: number;
  carrier_estimate_total?: number;
  total_paid?: number;
  remaining_recoverable?: number;
  [key: string]: any;
}
