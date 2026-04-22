#!/usr/bin/env python

"""ACI Commission Engine — Carrier estimate divergence policy (server side).

Python port of adjuster-portal-ui/src/app/config/estimate-divergence.ts.
Keep these two files in lockstep — they encode the same business rule.

Rule: when both a firm estimate (estimate_amount, written by the
EstimateProject sync in I2) and a carrier estimate (carrier total_cost,
linked via I1) exist on a commission_claim, fire a divergence warning
when the carrier value is materially LOWER than the firm value.

Thresholds (OR'd — either trips the flag):
  PERCENTAGE_THRESHOLD = 25    → (firm − carrier) / firm >= 25%
  DOLLAR_THRESHOLD     = 5000  → (firm − carrier) >= $5,000

`percentage` is stored / returned as a literal percent value
(28.00 == 28%), NOT a fractional decimal. Schema is NUMERIC(5,2).

We deliberately do NOT warn when carrier > firm — that's a windfall for
the homeowner, not something the residential operator needs to review.
(J3 will add bidirectional commercial-mode handling on top of this.)
"""

from __future__ import annotations

from decimal import Decimal


PERCENTAGE_THRESHOLD = Decimal("25")      # 25 (literal percent)
DOLLAR_THRESHOLD = Decimal("5000")        # $5,000


def compute_divergence(
    firm_estimate: Decimal | float | int | None,
    carrier_estimate: Decimal | float | int | None,
) -> dict:
    """Return a structured divergence result.

    Output keys:
      flagged              : bool         — True if any threshold tripped
      percentage           : Decimal|None — literal percent (e.g. 28.00 == 28%)
      dollars              : Decimal|None — firm − carrier (signed)
      threshold_triggered  : 'percent' | 'dollars' | 'both' | None

    Returns flagged=False with all-None metrics when either side is
    missing or non-positive. Returns flagged=False with percentage=0
    and signed dollars when carrier >= firm (windfall — no warning).
    """
    if firm_estimate is None or carrier_estimate is None:
        return _no_flag()

    firm = Decimal(str(firm_estimate))
    carrier = Decimal(str(carrier_estimate))

    if firm <= 0 or carrier <= 0:
        return _no_flag()

    dollars = firm - carrier
    if dollars <= 0:
        # Carrier matches or beats firm — no warning per residential policy.
        return {
            "flagged": False,
            "percentage": Decimal("0"),
            "dollars": dollars,
            "threshold_triggered": None,
        }

    # Literal percent (28.00 means 28%), rounded to 2dp to match NUMERIC(5,2).
    percentage = ((dollars / firm) * Decimal("100")).quantize(Decimal("0.01"))

    pct_trip = percentage >= PERCENTAGE_THRESHOLD
    dol_trip = dollars >= DOLLAR_THRESHOLD

    triggered: str | None
    if pct_trip and dol_trip:
        triggered = "both"
    elif pct_trip:
        triggered = "percent"
    elif dol_trip:
        triggered = "dollars"
    else:
        triggered = None

    return {
        "flagged": triggered is not None,
        "percentage": percentage,
        "dollars": dollars,
        "threshold_triggered": triggered,
    }


def _no_flag() -> dict:
    return {
        "flagged": False,
        "percentage": None,
        "dollars": None,
        "threshold_triggered": None,
    }
