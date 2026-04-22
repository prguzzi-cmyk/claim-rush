#!/usr/bin/env python

"""ACI Commission Engine — Advance Schedule (server-side mirror).

Python port of adjuster-portal-ui/src/app/config/advance-schedule.ts.

This is the server-side source of truth for what constitutes a valid
advance request. The dialog enforces the same policy in the browser as
a UX guardrail, but the backend holds the line — mutating only one side
must not open a loophole.

Keep this file and its TypeScript twin in lockstep. A comment at the
top of each should reference the other when either is edited.

Policy
──────
  Tier table:
    $10,000 – $50,000     → $250
    $50,001 – $100,000    → $500
    $100,001 – $200,000   → $1,000
    $200,001 – open       → $1,500

  Weekly cap (Mon–Sun, per member):  $5,000
  Lifetime cap (per member):         $25,000

  Under-minimum policy: an estimate below the lowest tier minimum
  ($10,000) has no tier amount. The dialog surfaces a free-text
  amount input guarded by an admin-override toggle; the backend
  likewise requires `admin_override=True` before issuing.

Backend enforcement applies whenever `claim_id` is provided AND the
claim has a non-null `estimate_amount`:
  - If estimate falls in a tier:
      amount MUST equal tier.amount unless admin_override=True
  - If estimate is below the minimum tier:
      admin_override=True is required for ANY amount

When `claim_id` is None or the claim has no estimate_amount, we fall
back to admin-discretionary: admin_override=True is required.

`admin_override` NEVER bypasses the weekly or lifetime caps — those
are hard limits regardless.
"""

from __future__ import annotations

from decimal import Decimal
from typing import NamedTuple


class AdvanceTier(NamedTuple):
    """A single bracket in the tier table.

    `max` of None means "no upper bound" — the open top bracket.
    An estimate E matches this tier when `min <= E and (max is None or E <= max)`.
    """
    min: Decimal
    max: Decimal | None
    amount: Decimal


# Ordered by increasing min — `compute_tier_amount` relies on this.
ADVANCE_TIERS: tuple[AdvanceTier, ...] = (
    AdvanceTier(Decimal("10000"),  Decimal("50000"),  Decimal("250")),
    AdvanceTier(Decimal("50001"),  Decimal("100000"), Decimal("500")),
    AdvanceTier(Decimal("100001"), Decimal("200000"), Decimal("1000")),
    AdvanceTier(Decimal("200001"), None,              Decimal("1500")),
)

WEEKLY_CAP_PER_MEMBER = Decimal("5000")
LIFETIME_CAP_PER_MEMBER = Decimal("25000")
UNDER_MINIMUM_POLICY = "admin_discretionary"


def compute_tier_amount(estimate: Decimal | None) -> Decimal | None:
    """Return the tier-matched advance amount for the given estimate.

    None return cases:
      - estimate is None
      - estimate <= 0
      - estimate is below the lowest tier minimum (under-minimum policy)

    Callers distinguish "no match" (None) from a real $0 match. $0 is
    never a valid tier amount in the current schedule.
    """
    if estimate is None or estimate <= 0:
        return None
    for tier in ADVANCE_TIERS:
        if estimate >= tier.min and (tier.max is None or estimate <= tier.max):
            return tier.amount
    return None
