#!/usr/bin/env python

"""Reverse geocoding utility — lat/lng → (ZIP, county).

Uses the U.S. Census Geocoder Geographies endpoint, which is:

* free, no API key, no signup
* HTTP-only public service operated by the U.S. Census Bureau
* officially uncapped for reasonable use; in practice ~10–20 req/sec
  is safe per source IP
* returns ZIP Code Tabulation Areas (ZCTA5) — equivalent to USPS ZIPs
  for ~99% of populated addresses and the canonical Census-derived
  ZIP layer

We treat the call as best-effort: on any failure (timeout, 5xx, parse
error) we return :class:`GeocodeResult` with all fields ``None`` and
let callers proceed without enrichment. The PulsePoint ingestion path
must never fail because the Census API hiccupped.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Optional

import requests

from app.core.log import logger

CENSUS_GEOCODER_URL = (
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
)
DEFAULT_LAYERS = "2020 Census ZIP Code Tabulation Areas,Counties"
DEFAULT_TIMEOUT = 8.0  # seconds
COORD_DECIMALS = 4  # ~11m precision — sufficient for ZIP boundary


@dataclass(frozen=True)
class GeocodeResult:
    zip_code: str | None = None
    county: str | None = None

    @property
    def is_empty(self) -> bool:
        return self.zip_code is None and self.county is None


# In-process cache keyed by (rounded lat, rounded lng). Many fire incidents
# fire at the same address repeatedly — caching cuts API calls dramatically.
_cache: dict[tuple[float, float], GeocodeResult] = {}
_cache_lock = threading.Lock()
_session = requests.Session()


def _round_coord(value: float) -> float:
    return round(float(value), COORD_DECIMALS)


def reverse_geocode(
    latitude: float | None,
    longitude: float | None,
    *,
    timeout: float = DEFAULT_TIMEOUT,
    layers: str = DEFAULT_LAYERS,
) -> GeocodeResult:
    """Return a :class:`GeocodeResult` for the given coordinates.

    Returns an empty :class:`GeocodeResult` (all fields ``None``) on any
    error — never raises. Idempotent and cached: repeated calls for
    coordinates rounded to ``COORD_DECIMALS`` decimal places hit the
    in-process cache instead of the network.
    """
    if latitude is None or longitude is None:
        return GeocodeResult()

    try:
        lat_r = _round_coord(latitude)
        lng_r = _round_coord(longitude)
    except (TypeError, ValueError):
        return GeocodeResult()

    # Reject obvious sentinel coordinates that PulsePoint emits for
    # incidents without a known location, and any pair clearly outside
    # the U.S./territories envelope. Calling Census on these wastes a
    # request and pollutes the cache with empty results.
    if abs(lat_r) < 0.01 and abs(lng_r) < 0.01:
        return GeocodeResult()
    if not (15.0 <= lat_r <= 72.0):
        return GeocodeResult()
    if not (-180.0 <= lng_r <= -65.0):
        return GeocodeResult()

    key = (lat_r, lng_r)
    with _cache_lock:
        cached: Optional[GeocodeResult] = _cache.get(key)
    if cached is not None:
        return cached

    try:
        resp = _session.get(
            CENSUS_GEOCODER_URL,
            params={
                "x": lng_r,
                "y": lat_r,
                "benchmark": "Public_AR_Current",
                "vintage": "Current_Current",
                "format": "json",
                "layers": layers,
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        logger.warning(
            "[reverse_geocoder] Census lookup failed for (%s, %s): %s",
            lat_r,
            lng_r,
            exc,
        )
        # Cache the miss briefly with a temporary empty result so we don't
        # hammer the API on repeated failed lookups for the same coord.
        result = GeocodeResult()
        with _cache_lock:
            _cache[key] = result
        return result

    geos = (payload.get("result") or {}).get("geographies") or {}

    zcta_list = geos.get("2020 Census ZIP Code Tabulation Areas") or []
    counties = geos.get("Counties") or []

    zip_code = None
    if zcta_list:
        zip_code = zcta_list[0].get("ZCTA5") or zcta_list[0].get("BASENAME")

    county = None
    if counties:
        # Prefer the human-readable name with "County" suffix stripped so
        # "San Diego County" → "San Diego" matches our other county fields.
        raw_name = counties[0].get("NAME") or counties[0].get("BASENAME")
        if raw_name:
            county = raw_name.removesuffix(" County").strip()

    result = GeocodeResult(zip_code=zip_code, county=county)
    with _cache_lock:
        _cache[key] = result
    return result


def cache_size() -> int:
    """Return the current size of the in-process geocode cache."""
    with _cache_lock:
        return len(_cache)


def clear_cache() -> None:
    """Empty the in-process geocode cache. Primarily for tests/scripts."""
    with _cache_lock:
        _cache.clear()
