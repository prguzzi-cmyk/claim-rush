#!/usr/bin/env python

"""ACI Commission Engine — Carrier estimate divergence policy (server side).

Python port of adjuster-portal-ui/src/app/config/estimate-divergence.ts.
Keep these two files in lockstep — they encode the same business rule.

Rule: when both a firm estimate (estimate_amount, written by the
EstimateProject sync in I2) and a carrier estimate (carrier total_cost,
linked via I1) exist on a commission_claim, fire a divergence warning
when the carrier value is materially LOWER than the firm value.

Thresholds (OR'd — either trips the flag):
  - PERCENTAGE_THRESHOLD = 0.25  → (firm − carrier) / firm >= 25%
  - DOLLAR_THRESHOLD     = 5000  → (firm − carrier) >= $5,000

We deliberately do NOT warn when carrier > firm — that's a windfall for
the homeowner, not something the commission operator needs to review.

The warning surfaces in the UI as:
  - amber banner on the claim row in the Commission Admin claims table
    (aggregate count above the table)
  - red chip next to any displayed carrier estimate value
"""

from __future__ import annotations

from decimal import Decimal


PERCENTAGE_THRESHOLD = Decimal("0.25")    # 25%
DOLLAR_THRESHOLD = Decimal("5000")        # $5,000


def compute_divergence(
    firm_estimate: Decimal | float | int | None,
    carrier_estimate: Decimal | float | int | None,
) -> dict:
    """Return a structured divergence result.

    Output keys:
      flagged              : bool      — True if any threshold tripped
      percentage           : Decimal | None  — (firm-carrier)/firm, only when both exist
      dollars              : Decimal | None  — firm-carrier, only when both exist
      threshold_triggered  : 'percent' | 'dollars' | 'both' | None

    Returns flagged=False with all-None metrics when:
      - either side is missing or non-positive
      - carrier >= firm (windfall — no warning per policy)
    """
    if firm_estimate is None or carrier_estimate is None:
        return _no_flag()

    firm = Decimal(str(firm_estimate))
    carrier = Decimal(str(carrier_estimate))

    if firm <= 0 or carrier <= 0:
        return _no_flag()

    dollars = firm - carrier
    if dollars <= 0:
        # Carrier matches or beats firm — no warning.
        return {
            "flagged": False,
            "percentage": Decimal("0"),
            "dollars": dollars,
            "threshold_triggered": None,
        }

    percentage = dollars / firm

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
