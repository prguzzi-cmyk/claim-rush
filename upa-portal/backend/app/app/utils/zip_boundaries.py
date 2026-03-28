"""Fetch ZIP code (ZCTA) boundary polygons from US Census Bureau TIGERweb API."""

import time
from typing import Any

import httpx

TIGERWEB_URL = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/"
    "TIGERweb/tigerWMS_ACS2023/MapServer/2/query"
)

# In-memory cache: zip_code -> (feature_dict, timestamp)
_cache: dict[str, tuple[dict[str, Any], float]] = {}
_CACHE_TTL = 86400  # 24 hours


def _is_fresh(ts: float) -> bool:
    return (time.time() - ts) < _CACHE_TTL


async def _fetch_batch(zip_codes: list[str]) -> list[dict[str, Any]]:
    """Fetch boundary features for a batch of up to 50 ZIP codes."""
    quoted = ",".join(f"'{z}'" for z in zip_codes)
    params = {
        "where": f"GEOID IN ({quoted})",
        "outFields": "GEOID,BASENAME,AREALAND,AREAWATER",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(TIGERWEB_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    return data.get("features", [])


async def get_zips_at_points(
    points: list[tuple[float, float]],
) -> list[str]:
    """Find the ZCTA (ZIP code) containing each (lat, lng) point.

    Uses TIGERweb spatial query. Batches points for performance.
    Returns deduplicated sorted list of ZIP codes.
    """
    if not points:
        return []

    zips: set[str] = set()

    # Batch by 25 points — build a multipoint geometry for spatial query
    batch_size = 25
    for i in range(0, len(points), batch_size):
        batch = points[i : i + batch_size]

        # Build envelope (bounding box) from batch points for spatial filter
        lngs = [p[1] for p in batch]
        lats = [p[0] for p in batch]
        envelope = f"{min(lngs)},{min(lats)},{max(lngs)},{max(lats)}"

        params = {
            "geometry": envelope,
            "geometryType": "esriGeometryEnvelope",
            "spatialRel": "esriSpatialRelIntersects",
            "inSR": "4326",
            "outFields": "GEOID",
            "returnGeometry": "false",
            "outSR": "4326",
            "f": "json",
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(TIGERWEB_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
                for feat in data.get("features", []):
                    geoid = feat.get("attributes", {}).get("GEOID", "")
                    if geoid:
                        zips.add(geoid)
        except Exception:
            pass  # Silently skip failed batches

    return sorted(zips)


async def get_zip_boundaries(zip_codes: list[str]) -> dict[str, Any]:
    """Return a GeoJSON FeatureCollection of ZCTA boundary polygons.

    Results are cached in-memory with a 24-hour TTL.
    Requests are batched in groups of 50 (API WHERE clause limit).
    """
    if not zip_codes:
        return {"type": "FeatureCollection", "features": []}

    # Deduplicate and normalise
    unique_zips = sorted(set(z.strip() for z in zip_codes if z.strip()))

    # Split into cached vs uncached
    features: list[dict[str, Any]] = []
    to_fetch: list[str] = []

    for z in unique_zips:
        if z in _cache and _is_fresh(_cache[z][1]):
            features.append(_cache[z][0])
        else:
            to_fetch.append(z)

    # Fetch uncached in batches of 50
    batch_size = 50
    for i in range(0, len(to_fetch), batch_size):
        batch = to_fetch[i : i + batch_size]
        batch_features = await _fetch_batch(batch)
        now = time.time()
        for feat in batch_features:
            zip_code = feat.get("properties", {}).get("GEOID", "")
            _cache[zip_code] = (feat, now)
            features.append(feat)

    return {"type": "FeatureCollection", "features": features}
