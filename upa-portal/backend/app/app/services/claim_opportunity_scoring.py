"""Claim Opportunity Scoring Service.

Combines storm-level probability with property-level damage factors into
a single composite opportunity score (0-100).

Reuses:
- compute_claim_probability() from app/utils/claim_probability.py
- score_property() from app/utils/roof_rules_engine.py

Does NOT duplicate the above — it composes their outputs into a weighted
composite score enriched with proximity and property value factors.
"""

import logging
import math
from typing import Any

from app.models.storm_event import StormEvent
from app.utils.claim_probability import compute_claim_probability
from app.utils.roof_rules_engine import score_property

logger = logging.getLogger(__name__)

# ── Weight configuration ──────────────────────────────────────────
WEIGHT_STORM_PROBABILITY = 0.40
WEIGHT_PROPERTY_DAMAGE = 0.30
WEIGHT_PROXIMITY = 0.15
WEIGHT_PROPERTY_VALUE = 0.15

# ── Property value normalization ──────────────────────────────────
# Used to map raw property value into a 0-100 factor
_PROPERTY_VALUE_TIERS = [
    (500_000, 100),
    (350_000, 85),
    (250_000, 70),
    (150_000, 55),
    (100_000, 40),
    (50_000, 25),
]


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in miles between two lat/lon points."""
    R = 3958.8  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _proximity_factor(distance_miles: float, radius_miles: float) -> int:
    """Score 0-100 based on distance from storm center.

    Properties at the center score 100; at the edge score ~30; beyond score 0.
    """
    if distance_miles <= 0:
        return 100
    if radius_miles <= 0:
        radius_miles = 5.0
    ratio = distance_miles / radius_miles
    if ratio >= 1.5:
        return 0
    return max(0, int(100 * (1 - (ratio * 0.7))))


def _property_value_factor(value: float) -> int:
    """Normalize property value to 0-100 factor."""
    if value <= 0:
        return 30  # default for unknown
    for threshold, score in _PROPERTY_VALUE_TIERS:
        if value >= threshold:
            return score
    return 15


def impact_level_from_score(score: int) -> str:
    """Map composite score to impact level label."""
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 40:
        return "moderate"
    return "low"


def score_opportunity(storm_event: StormEvent, property_data: dict) -> dict:
    """Compute a composite opportunity score (0-100) for a property in a storm zone.

    Parameters
    ----------
    storm_event : StormEvent
        The storm event record (used for storm-level probability).
    property_data : dict
        Keys: latitude, longitude, property_value, roof_age_years, roof_type,
              roof_size_sqft, property_type

    Returns
    -------
    dict
        claim_probability_score, estimated_claim_value, impact_level,
        scoring_factors (breakdown)
    """
    # 1. Storm-level probability (0-100)
    storm_prob = compute_claim_probability(storm_event)

    # 2. Property-level damage score (0-100) via roof rules engine
    prop_result = score_property(
        storm_type=storm_event.event_type,
        storm_severity=storm_event.severity,
        hail_size_inches=storm_event.hail_size_inches,
        wind_speed_mph=storm_event.wind_speed_mph,
        roof_age_years=property_data.get("roof_age_years"),
        roof_type=property_data.get("roof_type"),
        roof_size_sqft=property_data.get("roof_size_sqft"),
        latitude=property_data.get("latitude", 0.0),
        longitude=property_data.get("longitude", 0.0),
    )
    damage_score = prop_result["damage_score"]

    # 3. Proximity factor (0-100)
    prop_lat = property_data.get("latitude", 0.0)
    prop_lon = property_data.get("longitude", 0.0)
    storm_lat = storm_event.latitude or 0.0
    storm_lon = storm_event.longitude or 0.0
    radius_miles = property_data.get("radius_miles", 5.0)

    distance = _haversine_miles(storm_lat, storm_lon, prop_lat, prop_lon)
    prox_factor = _proximity_factor(distance, radius_miles)

    # 4. Property value factor (0-100)
    prop_value = property_data.get("property_value", 0)
    val_factor = _property_value_factor(prop_value)

    # ── Weighted composite ────────────────────────────────────────
    composite = int(
        storm_prob * WEIGHT_STORM_PROBABILITY
        + damage_score * WEIGHT_PROPERTY_DAMAGE
        + prox_factor * WEIGHT_PROXIMITY
        + val_factor * WEIGHT_PROPERTY_VALUE
    )
    composite = min(max(composite, 0), 100)

    return {
        "claim_probability_score": composite,
        "estimated_claim_value": prop_result["estimated_claim_value"],
        "impact_level": impact_level_from_score(composite),
        "scoring_factors": {
            "storm_probability": storm_prob,
            "property_damage_score": damage_score,
            "proximity_factor": prox_factor,
            "property_value_factor": val_factor,
            "distance_miles": round(distance, 2),
        },
    }


def score_zone_properties(
    storm_event: StormEvent,
    properties: list[dict],
    radius_miles: float = 5.0,
) -> list[dict]:
    """Batch-score a list of properties against a storm event.

    Each property dict should contain: latitude, longitude, address,
    and optionally: property_value, roof_age_years, roof_type, roof_size_sqft.

    Returns list of dicts with original property data + scoring results.
    """
    results = []
    for prop in properties:
        prop["radius_miles"] = radius_miles
        try:
            scoring = score_opportunity(storm_event, prop)
            results.append({
                **prop,
                **scoring,
            })
        except Exception as exc:
            logger.warning("Failed to score property %s: %s", prop.get("address", "?"), exc)
    # Sort by score descending
    results.sort(key=lambda r: r.get("claim_probability_score", 0), reverse=True)
    return results
