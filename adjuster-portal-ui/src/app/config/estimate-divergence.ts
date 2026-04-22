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

export const PERCENTAGE_THRESHOLD = 25;       // literal percent (25%)
export const DOLLAR_THRESHOLD = 5_000;        // $5,000

export type ClaimType = 'residential' | 'commercial';

export interface DivergenceResult {
  flagged: boolean;
  /** Literal absolute percent (28 == 28%); null when either side missing. */
  percentage: number | null;
  /** firm − carrier, signed: positive = carrier lower, negative = carrier higher. */
  dollars: number | null;
  thresholdTriggered: 'percent' | 'dollars' | 'both' | null;
}

export function computeDivergence(
  firmEstimate: number | null | undefined,
  carrierEstimate: number | null | undefined,
  claimType: ClaimType | string | null | undefined = 'residential',
): DivergenceResult {
  if (firmEstimate == null || carrierEstimate == null) return noFlag();
  if (firmEstimate <= 0 || carrierEstimate <= 0) return noFlag();

  const dollars = firmEstimate - carrierEstimate;  // signed
  const isCommercial = (claimType ?? 'residential').toString().toLowerCase() === 'commercial';

  if (!isCommercial && dollars <= 0) {
    // Residential + carrier matches or beats firm — no warning.
    return { flagged: false, percentage: 0, dollars, thresholdTriggered: null };
  }

  const absDollars = Math.abs(dollars);
  const percentage = (absDollars / firmEstimate) * 100;
  const pctTrip = percentage >= PERCENTAGE_THRESHOLD;
  const dolTrip = absDollars >= DOLLAR_THRESHOLD;

  let triggered: DivergenceResult['thresholdTriggered'] = null;
  if (pctTrip && dolTrip) triggered = 'both';
  else if (pctTrip) triggered = 'percent';
  else if (dolTrip) triggered = 'dollars';

  return {
    flagged: triggered !== null,
    percentage,
    dollars,        // SIGNED — UI uses sign to pick chip/banner variant
    thresholdTriggered: triggered,
  };
}

function noFlag(): DivergenceResult {
  return { flagged: false, percentage: null, dollars: null, thresholdTriggered: null };
}
