#!/usr/bin/env python

"""Compute claim probability and severity from storm event data."""

import random
from typing import Any

from app.models.storm_event import StormEvent


def compute_claim_probability(storm_event: StormEvent) -> int:
    """Compute claim probability (0-100) based on storm characteristics.

    Hail >= 2":      90-95%
    Hail 1.5-2":     75-85%
    Hail 1-1.5":     55-70%
    Wind >= 80 mph:  75-85%
    Wind 58-80 mph:  45-65%
    Tornado:         90-98%
    Lightning:       5-60% (based on strike_count)
    """
    event_type = storm_event.event_type
    hail = storm_event.hail_size_inches or 0
    wind = storm_event.wind_speed_mph or 0

    if event_type == "tornado":
        return random.randint(90, 98)

    if event_type == "hail":
        if hail >= 2.0:
            return random.randint(90, 95)
        if hail >= 1.5:
            return random.randint(75, 85)
        if hail >= 1.0:
            return random.randint(55, 70)
        if hail >= 0.75:
            return random.randint(30, 45)
        return random.randint(10, 25)

    if event_type == "wind":
        if wind >= 80:
            return random.randint(75, 85)
        if wind >= 58:
            return random.randint(45, 65)
        if wind >= 40:
            return random.randint(20, 35)
        return random.randint(5, 15)

    if event_type == "hurricane":
        cat = storm_event.hurricane_category or 1
        return min(60 + cat * 10, 98)

    # Lightning — use strike_count if available
    if event_type == "lightning":
        strike_count = getattr(storm_event, "strike_count", None) or 0
        if strike_count >= 100:
            return random.randint(40, 60)
        if strike_count >= 50:
            return random.randint(25, 45)
        if strike_count >= 20:
            return random.randint(15, 30)
        return random.randint(5, 15)

    # Flooding — significant property damage potential
    if event_type == "flooding":
        severity = getattr(storm_event, "severity", "moderate")
        if severity in ("extreme", "severe"):
            return random.randint(75, 90)
        if severity == "high":
            return random.randint(55, 75)
        return random.randint(35, 55)

    # Fire (NWS Red Flag / Fire Weather)
    if event_type == "fire":
        severity = getattr(storm_event, "severity", "moderate")
        if severity in ("extreme", "severe"):
            return random.randint(65, 85)
        return random.randint(40, 60)

    # other
    return random.randint(5, 25)


# ── Fire incident probability + severity ──────────────────────────

# Call type code → (description keyword, probability range, severity)
_FIRE_CALL_TYPE_MAP: dict[str, tuple[int, int, str]] = {
    # Structure fires
    "STRUC": (80, 95, "extreme"),
    "COMML": (70, 85, "severe"),
    "APART": (70, 85, "severe"),
    "INDUS": (70, 85, "severe"),
    "RESID": (55, 70, "high"),
    "RFIRE": (55, 70, "high"),
    # Wildfires
    "WILD": (40, 60, "high"),
    "BRUSH": (40, 60, "high"),
    "GRASS": (35, 50, "moderate"),
    "VEG": (35, 50, "moderate"),
    # Vehicle / misc fires
    "VEHIC": (30, 45, "moderate"),
    "TRASH": (20, 35, "low"),
    "RUBB": (20, 35, "low"),
}

# ── Property-loss allowlist ──────────────────────────────────────
# Only these call type codes and description keywords are relevant to
# property-loss claim opportunities. Everything else is EXCLUDED.

# Allowlisted call type codes (upper-cased substring match)
# Vegetation/grass/brush fires are EXCLUDED by default — they rarely
# produce insurable property-loss claims. Enable via wildfire mode.
_PROPERTY_LOSS_CALL_TYPE_CODES: set[str] = {
    "STRUC", "COMML", "APART", "INDUS", "RESID", "RFIRE",  # Structure fires
    "SF", "CF", "AF", "RF",                                  # Short codes
}

# Allowlisted description keywords (upper-cased substring match)
_PROPERTY_LOSS_KEYWORDS: set[str] = {
    "STRUCTURE", "BUILDING", "HOUSE", "HOME", "DWELLING",
    "COMMERCIAL", "WAREHOUSE", "FACTORY", "INDUSTRIAL",
    "RESIDENTIAL", "APARTMENT", "CONDO", "TOWNHOUSE",
    "CHIMNEY", "ATTIC", "KITCHEN FIRE", "GARAGE FIRE",
}

# Explicitly excluded — these never produce property-loss claims
_EXCLUDED_CALL_TYPES: set[str] = {
    "ME", "MED", "MEDICAL", "EMS",
    "TC", "MVC", "TRAFFIC", "COLLISION", "ACCIDENT",
    "INV", "INVESTIGATION",
    "RESC", "RESCUE", "WATER RESCUE",
    "AA", "ANIMAL",
    "PA", "PUBLIC ASSIST", "LIFT ASSIST",
    "MA", "MUTUAL AID",
    "HAZMAT", "HAZ",
    "POLICE", "LAW", "PD",
    "ALARM", "CO ALARM", "CARBON MONOXIDE", "FIRE ALARM",
    "SMOKE IN", "SMOKE INVESTIGATION",
    "VF", "VEH", "VEHICLE FIRE",
    "OF", "OUTSIDE FIRE", "DUMPSTER",
    "GF",
    # Vegetation / brush / grass / wildfire — excluded unless wildfire mode enabled
    "VEG", "VEGETATION", "GRASS", "BRUSH", "WILD", "FOREST",
    "GRASS FIRE", "BRUSH FIRE", "WILDFIRE", "FOREST FIRE",
}


def is_property_loss_incident(incident: Any) -> bool:
    """Check if a fire incident is relevant to property-loss claims.

    Uses an ALLOWLIST approach: the incident must match a known
    property-loss call type or description keyword. Unknown/unmapped
    incidents are EXCLUDED by default.

    Returns True only if the incident is a property-loss claim candidate.
    """
    call_type = (getattr(incident, "call_type", "") or "").upper().strip()
    desc = (getattr(incident, "call_type_description", "") or "").upper().strip()

    # Check explicit exclusions first
    for excl in _EXCLUDED_CALL_TYPES:
        if excl in call_type or excl in desc:
            return False

    # Check allowlisted call type codes
    for code in _PROPERTY_LOSS_CALL_TYPE_CODES:
        if code in call_type:
            return True

    # Check allowlisted description keywords
    for keyword in _PROPERTY_LOSS_KEYWORDS:
        if keyword in desc:
            return True

    # Default: EXCLUDED. Unknown call types do not enter the claims pipeline.
    return False


def compute_fire_claim_probability(incident: Any) -> int:
    """Compute claim probability (0-100) for a fire incident based on call type.

    Structure fires:   80-95%
    Commercial/Apt:    70-85%
    Residential:       55-70%
    Wildfire/Brush:    40-60%
    Default:           30-50%
    """
    call_type = getattr(incident, "call_type", "") or ""
    call_type_upper = call_type.upper()

    # Check call_type_description for more context
    desc = (getattr(incident, "call_type_description", "") or "").upper()

    # Try direct code match first
    for code, (lo, hi, _sev) in _FIRE_CALL_TYPE_MAP.items():
        if code in call_type_upper or code in desc:
            return random.randint(lo, hi)

    # Keyword fallback on description
    if any(kw in desc for kw in ("STRUCTURE", "BUILDING", "HOUSE")):
        return random.randint(80, 95)
    if any(kw in desc for kw in ("COMMERCIAL", "WAREHOUSE", "FACTORY")):
        return random.randint(70, 85)
    if any(kw in desc for kw in ("RESIDENTIAL", "HOME", "DWELLING")):
        return random.randint(55, 70)
    if any(kw in desc for kw in ("WILDFIRE", "WILD", "BRUSH", "FOREST")):
        return random.randint(40, 60)

    # Default: unrecognized call type → 0 probability (excluded from claims feed)
    return 0


def fire_severity_from_call_type(call_type: str, call_type_description: str | None = None) -> str:
    """Map fire call type to storm-style severity string.

    Returns one of: extreme, severe, high, moderate, low
    so it can be fed into map_to_claim_severity() → severity_to_priority().
    """
    ct = (call_type or "").upper()
    desc = (call_type_description or "").upper()

    for code, (_lo, _hi, sev) in _FIRE_CALL_TYPE_MAP.items():
        if code in ct or code in desc:
            return sev

    # Keyword fallback
    if any(kw in desc for kw in ("STRUCTURE", "BUILDING", "HOUSE")):
        return "extreme"
    if any(kw in desc for kw in ("COMMERCIAL", "WAREHOUSE", "FACTORY")):
        return "severe"
    if any(kw in desc for kw in ("RESIDENTIAL", "HOME", "DWELLING")):
        return "high"
    if any(kw in desc for kw in ("WILDFIRE", "WILD", "BRUSH", "FOREST")):
        return "high"

    return "moderate"


def map_to_claim_severity(storm_severity: str) -> str:
    """Map storm severity to claim severity.

    extreme/severe → critical
    high           → high
    moderate       → moderate
    low            → monitor
    """
    mapping = {
        "extreme": "critical",
        "severe": "critical",
        "high": "high",
        "moderate": "moderate",
        "low": "monitor",
    }
    return mapping.get(storm_severity, "monitor")


def severity_to_priority(claim_severity: str) -> str:
    """Map claim severity to priority label.

    critical → P1
    high     → P2
    moderate → P3
    monitor  → P4
    """
    mapping = {
        "critical": "P1",
        "high": "P2",
        "moderate": "P3",
        "monitor": "P4",
    }
    return mapping.get(claim_severity, "P4")
