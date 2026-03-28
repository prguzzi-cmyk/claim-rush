import { Injectable } from '@angular/core';
import { ClaimFinancialSnapshot, PaymentSummaryPayload } from '../models/claim-financials.model';

/**
 * ClaimFinancialEngine
 *
 * Pure-calculation service — no HTTP calls, no side effects.
 * Takes raw payment summary data and returns a deterministic ClaimFinancialSnapshot.
 *
 * Reuse this from any module that needs claim financial KPIs:
 *   Recovery tab, Payments ledger, Carrier Comparison, Supplement Engine, Dashboard widgets.
 */
@Injectable({ providedIn: 'root' })
export class ClaimFinancialEngineService {

  /**
   * Compute the full financial snapshot from a raw payment-summary payload.
   */
  compute(raw: PaymentSummaryPayload): ClaimFinancialSnapshot {
    const aciEstimateTotal     = raw.aci_estimate_total     ?? 0;
    const carrierEstimateTotal = raw.carrier_estimate_total  ?? 0;
    const paidToDate           = raw.total_paid              ?? 0;

    const unpaidGap       = Math.max(aciEstimateTotal - paidToDate, 0);
    const recoverableGap  = Math.max(aciEstimateTotal - carrierEstimateTotal, 0);

    // Safe divide-by-zero: if ACI estimate is zero, recovery is 0%.
    const recoveryPercent = aciEstimateTotal > 0
      ? (paidToDate / aciEstimateTotal) * 100
      : 0;

    const supplementOpportunity =
      aciEstimateTotal > carrierEstimateTotal || unpaidGap > 0;

    return {
      aciEstimateTotal,
      carrierEstimateTotal,
      paidToDate,
      unpaidGap,
      recoverableGap,
      recoveryPercent,
      supplementOpportunity,
    };
  }
}
