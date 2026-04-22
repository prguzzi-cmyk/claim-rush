#!/usr/bin/env python

"""ACI Commission Engine — Carrier estimate divergence policy (server side).

Python port of adjuster-portal-ui/src/app/config/estimate-divergence.ts.
Keep these two files in lockstep — they encode the same business rule.

Rule (residential):
  Fire a warning only when the carrier estimate is materially LOWER
  than the firm estimate. A higher carrier is a homeowner windfall —
  no warning.

Rule (commercial):
  Bidirectional. Fire when |carrier − firm| meets the dollar / percent
  thresholds in EITHER direction. Carrier-over-firm on a commercial
  policy can indicate coinsurance penalty exposure — operationally
  significant for the firm.

Thresholds (OR'd — either trips the flag):
  PERCENTAGE_THRESHOLD = 25    → |firm − carrier| / firm >= 25%
  DOLLAR_THRESHOLD     = 5000  → |firm − carrier| >= $5,000

Output `percentage` is a literal percent value (28.00 == 28%), stored
as NUMERIC(5,2). Always non-negative — UI uses `dollars` sign to know
direction.

Output `dollars` is signed: positive = carrier lower (lowball),
negative = carrier higher (windfall residential / coinsurance commercial).
"""

from __future__ import annotations

from decimal import Decimal


PERCENTAGE_THRESHOLD = Decimal("25")      # 25 (literal percent)
DOLLAR_THRESHOLD = Decimal("5000")        # $5,000

CLAIM_TYPE_COMMERCIAL = "commercial"
CLAIM_TYPE_RESIDENTIAL = "residential"


def compute_divergence(
    firm_estimate: Decimal | float | int | None,
    carrier_estimate: Decimal | float | int | None,
    claim_type: str | None = None,
) -> dict:
    """Return a structured divergence result.

    Output keys:
      flagged              : bool         — True if any threshold tripped
      percentage           : Decimal|None — literal absolute percent
      dollars              : Decimal|None — firm − carrier (signed)
      threshold_triggered  : 'percent' | 'dollars' | 'both' | None

    Branching:
      claim_type is None or 'residential' → residential rule (one-sided)
      claim_type == 'commercial'          → bidirectional rule

    Returns flagged=False with all-None metrics when either side is
    missing or non-positive. Returns flagged=False with percentage=0
    and signed dollars when residential and carrier >= firm.
    """
    if firm_estimate is None or carrier_estimate is None:
        return _no_flag()

    firm = Decimal(str(firm_estimate))
    carrier = Decimal(str(carrier_estimate))

    if firm <= 0 or carrier <= 0:
        return _no_flag()

    dollars = firm - carrier  # signed
    is_commercial = (claim_type or CLAIM_TYPE_RESIDENTIAL).lower() == CLAIM_TYPE_COMMERCIAL

    if not is_commercial and dollars <= 0:
        # Residential + carrier matches or beats firm — no warning.
        return {
            "flagged": False,
            "percentage": Decimal("0"),
            "dollars": dollars,
            "threshold_triggered": None,
        }

    abs_dollars = abs(dollars)
    # Literal absolute percent (28.00 == 28%), rounded to 2dp for NUMERIC(5,2).
    percentage = ((abs_dollars / firm) * Decimal("100")).quantize(Decimal("0.01"))

    pct_trip = percentage >= PERCENTAGE_THRESHOLD
    dol_trip = abs_dollars >= DOLLAR_THRESHOLD

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
        "dollars": dollars,  # SIGNED — UI keys off the sign for which banner/chip variant
        "threshold_triggered": triggered,
    }


def _no_flag() -> dict:
    return {
        "flagged": False,
        "percentage": None,
        "dollars": None,
        "threshold_triggered": None,
    }
