"""Deterministic roof damage scoring using storm + property metadata.

Used as a fallback when OpenAI Vision is unavailable, or as the primary
scoring mode when analysis_mode="rules".
"""

import logging

logger = logging.getLogger(__name__)

# ── Severity base scores ──────────────────────────────────────────────
_SEVERITY_SCORES: dict[str, int] = {
    "extreme": 40,
    "severe": 32,
    "high": 25,
    "moderate": 15,
    "low": 5,
}

# ── Roof type vulnerability multipliers ───────────────────────────────
_ROOF_TYPE_MULTIPLIER: dict[str, float] = {
    "asphalt_shingle": 1.0,
    "tile": 0.8,
    "metal": 0.6,
    "flat": 0.9,
}

# ── Damage label thresholds ───────────────────────────────────────────
_LABEL_THRESHOLDS = [
    (80, "severe"),
    (60, "high"),
    (40, "moderate"),
    (20, "low"),
    (0, "none"),
]

# ── Per-sqft claim rates by damage label ──────────────────────────────
_CLAIM_RATES: dict[str, tuple[float, float]] = {
    "severe": (8.0, 12.0),
    "high": (5.0, 8.0),
    "moderate": (3.0, 5.0),
    "low": (1.0, 3.0),
    "none": (0.0, 0.0),
}

DEFAULT_ROOF_SIZE_SQFT = 2000.0


def _score_to_label(score: int) -> str:
    for threshold, label in _LABEL_THRESHOLDS:
        if score >= threshold:
            return label
    return "none"


def _confidence_from_inputs(
    storm_type: str | None,
    hail_size_inches: float | None,
    wind_speed_mph: float | None,
    roof_age_years: int | None,
) -> str:
    """Estimate confidence based on how much data we have."""
    data_points = sum([
        storm_type is not None,
        hail_size_inches is not None and hail_size_inches > 0,
        wind_speed_mph is not None and wind_speed_mph > 0,
        roof_age_years is not None and roof_age_years > 0,
    ])
    if data_points >= 3:
        return "high"
    if data_points >= 2:
        return "medium"
    return "low"


def score_property(
    storm_type: str | None = None,
    storm_severity: str | None = None,
    hail_size_inches: float | None = None,
    wind_speed_mph: float | None = None,
    roof_age_years: int | None = None,
    roof_type: str | None = None,
    roof_size_sqft: float | None = None,
    latitude: float = 0.0,
    longitude: float = 0.0,
    satellite_anomaly_factor: float = 0.0,
) -> dict:
    """
    Deterministic scoring for roof damage probability.

    Returns
    -------
    dict
        damage_score, damage_label, confidence, summary, indicators,
        claim_range_low, claim_range_high, estimated_claim_value,
        recommended_action
    """
    indicators: list[str] = []
    raw_score = 0

    # 1. Storm severity base (0-40)
    severity_key = (storm_severity or "").lower()
    severity_pts = _SEVERITY_SCORES.get(severity_key, 0)
    raw_score += severity_pts
    if severity_pts > 0:
        indicators.append(f"Storm severity: {severity_key} (+{severity_pts} pts)")

    # 2. Hail impact (0-25)
    hail_pts = 0
    if hail_size_inches is not None and hail_size_inches > 0:
        if hail_size_inches >= 2.5:
            hail_pts = 25
        elif hail_size_inches >= 1.75:
            hail_pts = 20
        elif hail_size_inches >= 1.25:
            hail_pts = 15
        elif hail_size_inches >= 1.0:
            hail_pts = 10
        elif hail_size_inches >= 0.75:
            hail_pts = 5
        raw_score += hail_pts
        indicators.append(f"Hail size: {hail_size_inches}\" (+{hail_pts} pts)")

    # 3. Wind impact (0-20)
    wind_pts = 0
    if wind_speed_mph is not None and wind_speed_mph > 0:
        if wind_speed_mph >= 100:
            wind_pts = 20
        elif wind_speed_mph >= 80:
            wind_pts = 16
        elif wind_speed_mph >= 65:
            wind_pts = 12
        elif wind_speed_mph >= 50:
            wind_pts = 8
        elif wind_speed_mph >= 40:
            wind_pts = 4
        raw_score += wind_pts
        indicators.append(f"Wind speed: {wind_speed_mph} mph (+{wind_pts} pts)")

    # 4. Roof age factor (0-10)
    age_pts = 0
    if roof_age_years is not None and roof_age_years > 0:
        if roof_age_years >= 20:
            age_pts = 10
        elif roof_age_years >= 15:
            age_pts = 8
        elif roof_age_years >= 10:
            age_pts = 5
        elif roof_age_years >= 5:
            age_pts = 2
        raw_score += age_pts
        indicators.append(f"Roof age: {roof_age_years} years (+{age_pts} pts)")

    # 5. Satellite anomaly (0-5) — future AI pre-scan
    if satellite_anomaly_factor > 0:
        anomaly_pts = min(int(satellite_anomaly_factor * 5), 5)
        raw_score += anomaly_pts
        indicators.append(f"Satellite anomaly factor: {satellite_anomaly_factor:.2f} (+{anomaly_pts} pts)")

    # 6. Roof type vulnerability multiplier
    roof_type_key = (roof_type or "asphalt_shingle").lower()
    multiplier = _ROOF_TYPE_MULTIPLIER.get(roof_type_key, 1.0)
    if multiplier != 1.0:
        indicators.append(f"Roof type: {roof_type_key} (×{multiplier})")

    damage_score = min(int(raw_score * multiplier), 100)
    damage_label = _score_to_label(damage_score)
    confidence = _confidence_from_inputs(storm_type, hail_size_inches, wind_speed_mph, roof_age_years)

    # Claim estimate
    sqft = roof_size_sqft if roof_size_sqft and roof_size_sqft > 0 else DEFAULT_ROOF_SIZE_SQFT
    rate_low, rate_high = _CLAIM_RATES.get(damage_label, (0, 0))
    claim_range_low = sqft * rate_low
    claim_range_high = sqft * rate_high
    estimated_claim_value = (claim_range_low + claim_range_high) / 2

    # Recommended action
    if damage_score >= 80:
        recommended_action = "Immediate inspection — high-value claim opportunity"
    elif damage_score >= 60:
        recommended_action = "Schedule inspection within 48 hours"
    elif damage_score >= 40:
        recommended_action = "Add to outreach queue — moderate opportunity"
    elif damage_score >= 20:
        recommended_action = "Monitor — low probability but worth tracking"
    else:
        recommended_action = "Archive — minimal damage expected"

    # Summary
    summary = (
        f"Rules engine analysis: damage score {damage_score}/100 ({damage_label}). "
        f"Based on {len(indicators)} factors. "
        f"Estimated claim range: ${claim_range_low:,.0f} – ${claim_range_high:,.0f}."
    )

    return {
        "damage_score": damage_score,
        "damage_label": damage_label,
        "confidence": confidence,
        "summary": summary,
        "indicators": indicators,
        "claim_range_low": claim_range_low,
        "claim_range_high": claim_range_high,
        "estimated_claim_value": estimated_claim_value,
        "recommended_action": recommended_action,
    }
