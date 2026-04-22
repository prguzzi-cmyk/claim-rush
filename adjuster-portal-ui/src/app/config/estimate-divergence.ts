/**
 * ACI Commission Engine — Carrier estimate divergence policy (frontend).
 *
 * TypeScript twin of upa-portal/backend/app/app/config/estimate_divergence.py.
 * Keep both files in lockstep — they encode the same business rule.
 *
 * The backend is the authoritative computer of divergence. This module
 * exists so frontend code can:
 *   - render the same threshold values in tooltips ("flagged when carrier
 *     is >= 25% or >= $5,000 lower than firm")
 *   - run a defensive recompute for client-side display when needed
 *
 * Rule: warn only when the CARRIER estimate is materially LOWER than the
 * firm estimate. A carrier higher than firm = a homeowner windfall, not
 * something the operator needs to be alerted about.
 */

export const PERCENTAGE_THRESHOLD = 0.25;     // 25%
export const DOLLAR_THRESHOLD = 5_000;        // $5,000

export interface DivergenceResult {
  flagged: boolean;
  /** (firm - carrier) / firm, in [0, 1]; null when either side missing. */
  percentage: number | null;
  /** firm - carrier, in dollars; null when either side missing. */
  dollars: number | null;
  thresholdTriggered: 'percent' | 'dollars' | 'both' | null;
}

export function computeDivergence(
  firmEstimate: number | null | undefined,
  carrierEstimate: number | null | undefined,
): DivergenceResult {
  if (firmEstimate == null || carrierEstimate == null) return noFlag();
  if (firmEstimate <= 0 || carrierEstimate <= 0) return noFlag();

  const dollars = firmEstimate - carrierEstimate;
  if (dollars <= 0) {
    return { flagged: false, percentage: 0, dollars, thresholdTriggered: null };
  }

  const percentage = dollars / firmEstimate;
  const pctTrip = percentage >= PERCENTAGE_THRESHOLD;
  const dolTrip = dollars >= DOLLAR_THRESHOLD;

  let triggered: DivergenceResult['thresholdTriggered'] = null;
  if (pctTrip && dolTrip) triggered = 'both';
  else if (pctTrip) triggered = 'percent';
  else if (dolTrip) triggered = 'dollars';

  return {
    flagged: triggered !== null,
    percentage,
    dollars,
    thresholdTriggered: triggered,
  };
}

function noFlag(): DivergenceResult {
  return { flagged: false, percentage: null, dollars: null, thresholdTriggered: null };
}
