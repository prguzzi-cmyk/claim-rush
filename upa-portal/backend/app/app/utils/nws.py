#!/usr/bin/env python

"""HTTP client for the National Weather Service (NWS) alerts API.

The NWS API is free and requires no API key — only a User-Agent header.
Reference: https://api.weather.gov/alerts/active
"""

import json
import re
from datetime import datetime, timezone

import httpx

from app.core.log import logger

NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"
USER_AGENT = "(UPA Portal Storm Intelligence, ops@upa-portal.com)"

# Map NWS event names to our event types
NWS_EVENT_TYPE_MAP: dict[str, str] = {
    # Hail
    "Hail": "hail",
    "Severe Thunderstorm Warning": "hail",
    "Severe Thunderstorm Watch": "hail",
    # Tornado
    "Tornado Warning": "tornado",
    "Tornado Watch": "tornado",
    # Wind
    "High Wind Warning": "wind",
    "High Wind Watch": "wind",
    "Wind Advisory": "wind",
    "Extreme Wind Warning": "wind",
    "Severe Weather Statement": "wind",
    "Lake Wind Advisory": "wind",
    "Brisk Wind Advisory": "wind",
    "Gale Warning": "wind",
    "Gale Watch": "wind",
    "Hazardous Seas Warning": "wind",
    # Hurricane / Tropical
    "Hurricane Warning": "hurricane",
    "Hurricane Watch": "hurricane",
    "Hurricane Local Statement": "hurricane",
    "Tropical Storm Warning": "hurricane",
    "Tropical Storm Watch": "hurricane",
    "Storm Surge Warning": "hurricane",
    "Storm Surge Watch": "hurricane",
    # Flooding — mapped to "flooding" (property damage potential)
    "Flood Warning": "flooding",
    "Flash Flood Warning": "flooding",
    "Flood Watch": "flooding",
    "Flood Advisory": "flooding",
    # Winter storms — mapped to "wind" (roof/structure damage)
    "Winter Storm Warning": "wind",
    "Winter Storm Watch": "wind",
    "Winter Weather Advisory": "wind",
    "Ice Storm Warning": "wind",
    # Fire weather — mapped to "fire" (property loss)
    "Red Flag Warning": "fire",
    "Fire Weather Watch": "fire",
    # Heat — extreme heat can cause property damage (AC failures, power grid)
    "Extreme Heat Warning": "wind",
    "Heat Advisory": "wind",
    # Lightning / Thunderstorm
    "Special Weather Statement": "lightning",
    "Special Marine Warning": "lightning",
    "Lightning": "lightning",
}

# Severity mapping: NWS severity → our severity levels
NWS_SEVERITY_MAP: dict[str, str] = {
    "Extreme": "extreme",
    "Severe": "severe",
    "Moderate": "high",
    "Minor": "moderate",
    "Unknown": "low",
}


def _parse_state_county(area_desc: str) -> tuple[str, str]:
    """Extract state and county from NWS areaDesc like 'Harris, TX'."""
    parts = [p.strip() for p in area_desc.split(";")]
    # Take the first area description segment
    first = parts[0] if parts else area_desc
    # Try to match "County, ST" pattern
    match = re.search(r"([A-Za-z\s]+),\s*([A-Z]{2})", first)
    if match:
        return match.group(2), match.group(1).strip()
    # Fallback: try to find two-letter state code
    state_match = re.search(r"\b([A-Z]{2})\b", first)
    state = state_match.group(1) if state_match else ""
    county = first.replace(state, "").strip().rstrip(",").strip() if state else first
    return state, county


def _extract_zip_codes(description: str) -> list[str]:
    """Pull zip codes from NWS description text."""
    return re.findall(r"\b(\d{5})\b", description or "")


def _extract_hail_size(description: str) -> float | None:
    """Extract hail size in inches from description."""
    match = re.search(r"(\d+\.?\d*)\s*inch\s*hail", description or "", re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def _extract_wind_speed(description: str) -> tuple[float | None, float | None]:
    """Extract wind speed and gust from description."""
    wind = None
    gust = None
    wind_match = re.search(r"winds?\s*(?:of\s*)?(\d+)\s*mph", description or "", re.IGNORECASE)
    if wind_match:
        wind = float(wind_match.group(1))
    gust_match = re.search(r"gusts?\s*(?:to\s*|of\s*)?(\d+)\s*mph", description or "", re.IGNORECASE)
    if gust_match:
        gust = float(gust_match.group(1))
    return wind, gust


def _get_centroid(geometry: dict | None) -> tuple[float, float] | None:
    """Compute centroid from GeoJSON geometry (Polygon or Point)."""
    if not geometry:
        return None
    geo_type = geometry.get("type")
    coords = geometry.get("coordinates")
    if not coords:
        return None

    if geo_type == "Point":
        return (coords[1], coords[0])  # GeoJSON is [lng, lat]

    if geo_type == "Polygon":
        ring = coords[0]
        if not ring:
            return None
        lats = [c[1] for c in ring]
        lngs = [c[0] for c in ring]
        return (sum(lats) / len(lats), sum(lngs) / len(lngs))

    if geo_type == "MultiPolygon":
        all_lats = []
        all_lngs = []
        for poly in coords:
            ring = poly[0] if poly else []
            for c in ring:
                all_lats.append(c[1])
                all_lngs.append(c[0])
        if all_lats:
            return (sum(all_lats) / len(all_lats), sum(all_lngs) / len(all_lngs))

    return None


def fetch_nws_storm_alerts() -> list[dict]:
    """
    Fetch active NWS alerts and normalize them to StormEvent-compatible dicts.

    Returns
    -------
    list[dict]
        Each dict has keys matching StormEventCreate fields.
    """
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(
                NWS_ALERTS_URL,
                headers={"User-Agent": USER_AGENT, "Accept": "application/geo+json"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.error(f"NWS API request failed: {exc}")
        return []

    features = data.get("features", [])
    events: list[dict] = []

    for feature in features:
        props = feature.get("properties", {})
        nws_event = props.get("event", "")

        # Only process events we know how to map
        event_type = NWS_EVENT_TYPE_MAP.get(nws_event)
        if not event_type:
            continue

        # Get coordinates
        geometry = feature.get("geometry")
        centroid = _get_centroid(geometry)
        if not centroid:
            # Fallback: skip events without geometry
            continue

        latitude, longitude = centroid
        area_desc = props.get("areaDesc", "")
        state, county = _parse_state_county(area_desc)
        if not state:
            continue

        description = props.get("description", "") or ""
        headline = props.get("headline", "") or props.get("event", "")
        severity = NWS_SEVERITY_MAP.get(props.get("severity", "Unknown"), "low")
        external_id = props.get("id", "")

        # Parse dates
        reported_at = None
        effective = props.get("effective") or props.get("sent")
        if effective:
            try:
                reported_at = datetime.fromisoformat(effective.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                reported_at = datetime.now(timezone.utc)

        expires_at = None
        expires_str = props.get("expires")
        if expires_str:
            try:
                expires_at = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass

        zip_codes = _extract_zip_codes(description)

        event_dict: dict = {
            "event_type": event_type,
            "title": headline[:200],
            "description": description[:2000] if description else None,
            "severity": severity,
            "latitude": latitude,
            "longitude": longitude,
            "radius_miles": 10.0,  # default
            "state": state[:2],
            "county": county[:100],
            "zip_codes": json.dumps(zip_codes) if zip_codes else None,
            "reported_at": reported_at,
            "expires_at": expires_at,
            "source": f"NWS {props.get('senderName', '')}".strip()[:100],
            "is_active": True,
            "external_id": external_id[:200],
            "data_source": "nws",
        }

        # Type-specific fields
        if event_type == "hail":
            event_dict["hail_size_inches"] = _extract_hail_size(description)
        elif event_type == "wind":
            wind, gust = _extract_wind_speed(description)
            event_dict["wind_speed_mph"] = wind
            event_dict["gust_speed_mph"] = gust

        events.append(event_dict)

    logger.info(f"NWS API: fetched {len(events)} relevant alerts from {len(features)} total features.")
    return events
