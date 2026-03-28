#!/usr/bin/env python

"""Central normalization logic for crime incident types, severity, and relevance scoring."""

INSURANCE_RELEVANT_TYPES = {
    "burglary",
    "break_in",
    "forced_entry",
    "theft",
    "vandalism",
    "property_damage",
    "construction_theft",
    "copper_theft",
}

CHICAGO_TYPE_MAP: dict[str, str] = {
    "BURGLARY": "burglary",
    "THEFT": "theft",
    "MOTOR VEHICLE THEFT": "theft",
    "ROBBERY": "theft",
    "CRIMINAL DAMAGE": "vandalism",
    "CRIMINAL TRESPASS": "break_in",
    "ARSON": "property_damage",
    "CRIMINAL DAMAGE TO PROPERTY": "vandalism",
    "CRIMINAL DAMAGE TO VEHICLE": "vandalism",
    "BURGLARY - FORCIBLE ENTRY": "forced_entry",
}

PHILLY_TYPE_MAP: dict[str, str] = {
    "Burglary Residential": "burglary",
    "Burglary Non-Residential": "burglary",
    "Theft from Vehicle": "theft",
    "Thefts": "theft",
    "Other Thefts": "theft",
    "Vandalism/Criminal Mischief": "vandalism",
    "Motor Vehicle Theft": "theft",
    "Robbery No Firearm": "theft",
    "Robbery Firearm": "theft",
    "Arson": "property_damage",
    "Burglary Non-Residential No Force": "break_in",
    "Burglary Residential No Force": "break_in",
}

FBI_TYPE_MAP: dict[str, str] = {
    "burglary": "burglary",
    "larceny": "theft",
    "motor-vehicle-theft": "theft",
    "arson": "property_damage",
    "robbery": "theft",
    "property-crime": "property_damage",
}

_SOURCE_MAPS: dict[str, dict[str, str]] = {
    "chicago_socrata": CHICAGO_TYPE_MAP,
    "philly_carto": PHILLY_TYPE_MAP,
    "fbi_ucr": FBI_TYPE_MAP,
    "fbi_ucr_mock": FBI_TYPE_MAP,
}


def normalize_incident_type(raw: str, source: str) -> str | None:
    """Returns normalized type or None if not insurance-relevant."""
    type_map = _SOURCE_MAPS.get(source, {})

    # Try exact match first
    normalized = type_map.get(raw)
    if normalized and normalized in INSURANCE_RELEVANT_TYPES:
        return normalized

    # Try case-insensitive match
    raw_upper = raw.upper().strip()
    for key, val in type_map.items():
        if key.upper() == raw_upper:
            if val in INSURANCE_RELEVANT_TYPES:
                return val

    # Try generic keyword matching as fallback
    raw_lower = raw.lower()
    if "burglary" in raw_lower or "breaking" in raw_lower:
        return "burglary"
    if "theft" in raw_lower or "larceny" in raw_lower or "stolen" in raw_lower:
        return "theft"
    if "vandal" in raw_lower or "criminal damage" in raw_lower or "mischief" in raw_lower:
        return "vandalism"
    if "arson" in raw_lower or "fire" in raw_lower:
        return "property_damage"
    if "trespass" in raw_lower or "break" in raw_lower:
        return "break_in"
    if "forced entry" in raw_lower:
        return "forced_entry"

    return None


def compute_severity(incident_type: str, estimated_loss: float | None) -> str:
    """Returns severity: critical/high/moderate/low based on type + loss."""
    loss = estimated_loss or 0.0

    # High-impact types boost severity
    high_impact = {"forced_entry", "burglary"}
    moderate_impact = {"break_in", "theft", "construction_theft", "copper_theft"}

    if loss >= 50000 or (incident_type in high_impact and loss >= 25000):
        return "critical"
    if loss >= 20000 or incident_type in high_impact:
        return "high"
    if loss >= 5000 or incident_type in moderate_impact:
        return "moderate"
    return "low"


def compute_claim_relevance(
    incident_type: str, severity: str, has_address: bool
) -> float:
    """Returns 0.0–1.0 score."""
    base_scores: dict[str, float] = {
        "burglary": 0.85,
        "forced_entry": 0.80,
        "break_in": 0.70,
        "theft": 0.60,
        "construction_theft": 0.65,
        "copper_theft": 0.65,
        "vandalism": 0.50,
        "property_damage": 0.45,
    }
    score = base_scores.get(incident_type, 0.40)

    severity_boost: dict[str, float] = {
        "critical": 0.15,
        "high": 0.10,
        "moderate": 0.0,
        "low": -0.10,
    }
    score += severity_boost.get(severity, 0.0)

    if has_address:
        score += 0.05

    return round(min(max(score, 0.0), 1.0), 2)
