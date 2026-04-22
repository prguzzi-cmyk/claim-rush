/**
 * ACI Commission Engine — Advance Schedule.
 *
 * Single source of truth for the tier/cap policy that governs team-member
 * cash advances against in-progress claims. Consumed by IssueAdvanceDialog
 * (computes the tier amount + enforces caps) and, eventually, by any batch
 * advance-eligibility job that rolls forward at month-end.
 *
 * Keep this file in sync with the authoritative policy doc. Mutating
 * tiers here changes what the UI offers and what the server validates —
 * make changes deliberately and communicate them to ops.
 */

export interface AdvanceTier {
  /** Minimum estimate (inclusive) that qualifies for this tier. */
  min: number;
  /**
   * Maximum estimate (inclusive) for this tier, or `null` for the open-ended
   * top bracket. An estimate E matches a tier when `min <= E && (max === null || E <= max)`.
   */
  max: number | null;
  /** The advance amount (USD) granted for claims in this tier. */
  amount: number;
}

export interface AdvanceSchedule {
  /**
   * Ordered list of tiers. `computeTierAmount` assumes increasing-min.
   */
  tiers: readonly AdvanceTier[];
  /**
   * Hard cap on the sum of ADVANCE_ISSUED amounts within a single Monday-
   * to-Sunday calendar week, per team member.
   */
  weeklyCapPerMember: number;
  /**
   * Hard cap on the lifetime sum of ADVANCE_ISSUED amounts per team member.
   */
  lifetimeCapPerMember: number;
  /**
   * Policy token for estimates below the lowest tier minimum. Only meaningful
   * value today is `"admin_discretionary"` — the dialog hides the tier
   * amount, surfaces a free-text amount input, and requires the admin
   * override toggle before the submit button enables.
   */
  underMinimumPolicy: 'admin_discretionary';
}

export const ADVANCE_SCHEDULE: AdvanceSchedule = {
  tiers: [
    { min: 10_000,  max: 50_000,  amount: 250 },
    { min: 50_001,  max: 100_000, amount: 500 },
    { min: 100_001, max: 200_000, amount: 1_000 },
    { min: 200_001, max: null,    amount: 1_500 },
  ],
  weeklyCapPerMember: 5_000,
  lifetimeCapPerMember: 25_000,
  underMinimumPolicy: 'admin_discretionary',
};

/**
 * Returns the tier-matched advance amount for a given claim estimate, or
 * null if the estimate falls below the lowest tier's minimum (in which
 * case the dialog routes to admin-discretionary free-text input).
 */
export function computeTierAmount(
  estimate: number | null | undefined,
  schedule: AdvanceSchedule = ADVANCE_SCHEDULE,
): number | null {
  if (estimate == null || estimate <= 0) return null;
  for (const tier of schedule.tiers) {
    if (estimate >= tier.min && (tier.max === null || estimate <= tier.max)) {
      return tier.amount;
    }
  }
  // Estimate falls below the lowest tier.min → admin-discretionary.
  return null;
}
