"""Roof Intelligence Scoring Engine — V1 heuristic.

Generates scored property opportunities from storm event data.
Each property gets a composite score based on storm proximity,
severity, recency, and area event density.
"""

import hashlib
import math
import random
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.storm_event import StormEvent


def generate_roof_opportunities(
    db_session: Session,
    *,
    date_range: str = "7d",
    state: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    """Generate scored roof intelligence opportunities from storm events.

    Pulls recent storm events, generates synthetic properties within
    impacted areas, and scores each using V1 heuristics.

    Returns list of property dicts ready for the frontend.
    """
    from app.crud.crud_storm_event import storm_event

    # Fetch storm events using existing CRUD
    events = storm_event.get_filtered(
        db_session,
        date_range=date_range,
        state=state,
    )

    if not events:
        return []

    # Generate properties from event locations
    properties: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for event in events:
        if not event.latitude or not event.longitude:
            continue

        # Generate 1-3 properties per event based on severity
        count = _properties_per_event(event)
        for i in range(count):
            prop = _generate_property(event, i)
            if prop["property_id"] not in seen_ids:
                seen_ids.add(prop["property_id"])
                # Score the property
                score_result = _score_property(prop, event, events)
                prop.update(score_result)
                properties.append(prop)

            if len(properties) >= limit:
                break
        if len(properties) >= limit:
            break

    # ── Structure Validation + Building Center Lookup ──
    # Returns has_structure boolean AND the nearest building center coordinates.
    # The frontend uses building_lat/building_lng to center the satellite crop
    # on the actual roof instead of the random synthetic coordinate.
    try:
        from app.utils.structure_validator import validate_structures_with_centers
        validation = validate_structures_with_centers(properties, radius_m=50)
        for prop in properties:
            key = f"{prop['latitude']:.4f},{prop['longitude']:.4f}"
            result = validation.get(key, {})
            prop["has_structure"] = result.get("has_structure", None)
            prop["building_lat"] = result.get("building_lat")
            prop["building_lng"] = result.get("building_lng")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Structure validation skipped: %s", e)
        for prop in properties:
            prop["has_structure"] = None
            prop["building_lat"] = None
            prop["building_lng"] = None

    # Sort by damage score descending, structures first
    properties.sort(key=lambda p: (not p.get("has_structure", True), -p["damage_score"]))
    return properties[:limit]


def _properties_per_event(event: StormEvent) -> int:
    """How many properties to generate per storm event."""
    sev = (event.severity or "").lower()
    if sev in ("extreme", "severe"):
        return 3
    if sev == "high":
        return 2
    return 1


def _generate_property(event: StormEvent, index: int) -> dict[str, Any]:
    """Generate a synthetic property near a storm event location."""
    # Deterministic offset from event coordinates
    seed = hashlib.md5(f"{event.id}-{index}".encode()).hexdigest()
    rng = random.Random(seed)

    lat_offset = rng.uniform(-0.02, 0.02)  # ~2km spread
    lng_offset = rng.uniform(-0.02, 0.02)
    lat = round(event.latitude + lat_offset, 6)
    lng = round(event.longitude + lng_offset, 6)

    # Deterministic property ID from coordinates
    prop_id = f"rf-{seed[:12]}"

    # Random but deterministic roof properties
    roof_types = ["asphalt_shingle", "metal", "tile", "wood_shake", "slate"]
    roof_type = rng.choice(roof_types)
    roof_age = rng.randint(3, 35)
    roof_size = rng.randint(1200, 4500)

    # Street address (synthetic)
    street_num = rng.randint(100, 9999)
    streets = ["Oak", "Elm", "Maple", "Pine", "Cedar", "Main", "Park", "Lake", "Hill", "Ridge"]
    types = ["St", "Dr", "Ln", "Ave", "Blvd", "Ct", "Way", "Rd"]
    address = f"{street_num} {rng.choice(streets)} {rng.choice(types)}"

    return {
        "property_id": prop_id,
        "address": address,
        "city": event.county or "Unknown",
        "state": event.state or "??",
        "zip_code": "",
        "county": event.county or "",
        "latitude": lat,
        "longitude": lng,
        "roof_type": roof_type,
        "roof_age_years": roof_age,
        "roof_size_sqft": roof_size,
        "storm_event_id": str(event.id),
        "storm_type": event.event_type,
        "hail_size_inches": getattr(event, "hail_size_inches", None),
        "wind_speed_mph": getattr(event, "wind_speed_mph", None),
        "analysis_mode": "rules",
        "is_demo": False,
    }


def _score_property(
    prop: dict[str, Any],
    primary_event: StormEvent,
    all_events: list[StormEvent],
) -> dict[str, Any]:
    """V1 heuristic scoring for a property.

    Score = combination of:
      - Storm severity (0-30): hail size, wind speed, severity label
      - Storm recency (0-25): how recent the storm event is
      - Area density (0-25): number of events within ~50km
      - Roof vulnerability (0-20): age and type of roof

    Output range: 0-100
    """
    score = 0.0

    # ── Storm severity (0-30) ──
    sev_label = (primary_event.severity or "").lower()
    sev_map = {"extreme": 30, "severe": 25, "high": 20, "moderate": 12, "low": 5}
    score += sev_map.get(sev_label, 8)

    hail = getattr(primary_event, "hail_size_inches", None) or 0
    if hail >= 2.0:
        score += 5
    elif hail >= 1.0:
        score += 3

    wind = getattr(primary_event, "wind_speed_mph", None) or 0
    if wind >= 80:
        score += 5
    elif wind >= 60:
        score += 3

    # ── Storm recency (0-25) ──
    if primary_event.reported_at:
        hours_ago = (datetime.now(timezone.utc) - primary_event.reported_at).total_seconds() / 3600
        if hours_ago < 24:
            score += 25
        elif hours_ago < 72:
            score += 20
        elif hours_ago < 168:
            score += 12
        else:
            score += 5

    # ── Area density (0-25) ──
    lat, lng = prop["latitude"], prop["longitude"]
    nearby = 0
    for evt in all_events:
        if evt.latitude and evt.longitude:
            dist = _haversine_km(lat, lng, evt.latitude, evt.longitude)
            if dist < 50:
                nearby += 1
    if nearby >= 20:
        score += 25
    elif nearby >= 10:
        score += 18
    elif nearby >= 5:
        score += 12
    elif nearby >= 2:
        score += 8
    else:
        score += 3

    # ── Roof vulnerability (0-20) ──
    age = prop.get("roof_age_years", 10)
    if age >= 25:
        score += 15
    elif age >= 15:
        score += 10
    elif age >= 8:
        score += 5
    else:
        score += 2

    rtype = prop.get("roof_type", "")
    vulnerable_types = {"asphalt_shingle": 5, "wood_shake": 5, "tile": 3}
    score += vulnerable_types.get(rtype, 1)

    # ── Clamp to 0-100 ──
    total = min(max(int(round(score)), 0), 100)

    # ── Derive labels and estimates ──
    if total >= 85:
        label = "severe"
        confidence = "high"
        tier = "immediate"
    elif total >= 70:
        label = "high"
        confidence = "high"
        tier = "high"
    elif total >= 41:
        label = "moderate"
        confidence = "medium"
        tier = "medium"
    else:
        label = "low"
        confidence = "low"
        tier = "low"

    # Estimated claim value (rough heuristic from score + roof size)
    roof_sqft = prop.get("roof_size_sqft", 2000)
    base_value = roof_sqft * 4.5  # ~$4.50/sqft baseline
    claim_low = round(base_value * (total / 100) * 0.6, -2)  # round to nearest $100
    claim_high = round(base_value * (total / 100) * 1.2, -2)
    claim_est = round((claim_low + claim_high) / 2, -2)

    return {
        "damage_score": total,
        "damage_label": label,
        "confidence": confidence,
        "status": "completed",
        "claim_range_low": max(claim_low, 500),
        "claim_range_high": max(claim_high, 1500),
        "estimated_claim_value": max(claim_est, 1000),
        "recommended_action": "outreach" if total >= 60 else "monitor" if total >= 40 else "archive",
        "summary": f"V1 heuristic: {sev_label} {primary_event.event_type}, {nearby} nearby events, roof age {age}y",
    }


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Approximate distance in km between two lat/lng points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
