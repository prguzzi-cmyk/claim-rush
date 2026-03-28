"""Structure validation — check if coordinates contain a building footprint.

Uses OpenStreetMap Overpass API to find buildings near a set of coordinates.
Results are cached in-memory for 24 hours.
"""

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# In-memory cache: "lat,lng" (rounded to 4 decimals) -> (has_structure, timestamp)
_cache: dict[str, tuple[bool, float]] = {}
_CACHE_TTL = 86400  # 24 hours


def _cache_key(lat: float, lng: float) -> str:
    return f"{lat:.4f},{lng:.4f}"


def _is_fresh(ts: float) -> bool:
    return (time.time() - ts) < _CACHE_TTL


def validate_structures_batch(
    points: list[dict[str, Any]],
    radius_m: int = 50,
) -> dict[str, bool]:
    """Check which points have a building footprint within `radius_m` meters.

    Args:
        points: list of dicts with 'latitude' and 'longitude' keys
        radius_m: search radius in meters (default 50m)

    Returns:
        dict mapping "lat,lng" cache keys to True (has structure) or False.
    """
    result = validate_structures_with_centers(points, radius_m=radius_m)
    return {k: v["has_structure"] for k, v in result.items()}


# Extended cache: "lat,lng" -> (has_structure, building_lat, building_lng, timestamp)
_center_cache: dict[str, tuple[bool, float | None, float | None, float]] = {}


def validate_structures_with_centers(
    points: list[dict[str, Any]],
    radius_m: int = 50,
) -> dict[str, dict[str, Any]]:
    """Check which points have a building footprint and return the nearest building center.

    Returns dict mapping cache keys to:
        {"has_structure": bool, "building_lat": float|None, "building_lng": float|None}
    """
    if not points:
        return {}

    results: dict[str, dict[str, Any]] = {}
    uncached: list[dict[str, Any]] = []

    # Check cache first
    for p in points:
        key = _cache_key(p["latitude"], p["longitude"])
        if key in _center_cache and _is_fresh(_center_cache[key][3]):
            cached = _center_cache[key]
            results[key] = {
                "has_structure": cached[0],
                "building_lat": cached[1],
                "building_lng": cached[2],
            }
        else:
            uncached.append(p)

    if not uncached:
        return results

    lats = [p["latitude"] for p in uncached]
    lngs = [p["longitude"] for p in uncached]

    pad = radius_m / 111000
    bbox = f"{min(lats) - pad},{min(lngs) - pad},{max(lats) + pad},{max(lngs) + pad}"

    query = f"""
    [out:json][timeout:5];
    (
      way["building"]({bbox});
    );
    out center;
    """

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            data = resp.json()

        buildings = data.get("elements", [])
        logger.info(
            "Structure validator: %d buildings found in bbox for %d points",
            len(buildings),
            len(uncached),
        )

        building_centers: list[tuple[float, float]] = []
        for b in buildings:
            center = b.get("center", {})
            blat = center.get("lat") or b.get("lat")
            blng = center.get("lon") or b.get("lon")
            if blat and blng:
                building_centers.append((float(blat), float(blng)))

        now = time.time()
        for p in uncached:
            key = _cache_key(p["latitude"], p["longitude"])
            nearest = _find_nearest_building(
                p["latitude"], p["longitude"], building_centers, radius_m
            )
            has = nearest is not None
            blat = nearest[0] if nearest else None
            blng = nearest[1] if nearest else None
            results[key] = {
                "has_structure": has,
                "building_lat": blat,
                "building_lng": blng,
            }
            _center_cache[key] = (has, blat, blng, now)
            # Keep legacy cache in sync
            _cache[key] = (has, now)

    except Exception as e:
        logger.warning("Structure validation failed: %s — marking all as unverified", e)
        now = time.time()
        for p in uncached:
            key = _cache_key(p["latitude"], p["longitude"])
            results[key] = {"has_structure": True, "building_lat": None, "building_lng": None}
            _center_cache[key] = (True, None, None, now)
            _cache[key] = (True, now)

    return results


def _find_nearest_building(
    lat: float, lng: float,
    buildings: list[tuple[float, float]],
    radius_m: int,
) -> tuple[float, float] | None:
    """Find the nearest building center within radius_m of (lat, lng).

    Returns (building_lat, building_lng) or None if no building is within radius.
    """
    threshold_deg = radius_m / 111000
    best: tuple[float, float] | None = None
    best_dist = float("inf")
    for blat, blng in buildings:
        dlat = abs(blat - lat)
        dlng = abs(blng - lng)
        if dlat < threshold_deg and dlng < threshold_deg:
            dist = dlat * dlat + dlng * dlng  # squared distance, no sqrt needed for comparison
            if dist < best_dist:
                best_dist = dist
                best = (blat, blng)
    return best


def has_structure(lat: float, lng: float) -> bool:
    """Check a single point (uses cache)."""
    key = _cache_key(lat, lng)
    if key in _cache and _is_fresh(_cache[key][1]):
        return _cache[key][0]

    result = validate_structures_batch([{"latitude": lat, "longitude": lng}])
    return result.get(key, True)  # Fail open
