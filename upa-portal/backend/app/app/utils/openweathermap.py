#!/usr/bin/env python

"""OpenWeatherMap One Call 3.0 alerts — fallback weather alert source.

Used when NWS returns no alerts for the target area. OWM provides
government-sourced weather alerts via its One Call API.

Requires an API key stored in settings.OPENWEATHERMAP_API_KEY.
Reference: https://openweathermap.org/api/one-call-3#data
"""

import json
import re
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.core.log import logger

OWM_ONECALL_URL = "https://api.openweathermap.org/data/3.0/onecall"

# Probe points: major TX metro areas (lat, lon, state, county)
_PROBE_POINTS: list[tuple[float, float, str, str]] = [
    (32.78, -96.80, "TX", "Dallas"),
    (32.75, -97.33, "TX", "Tarrant"),
    (33.02, -96.70, "TX", "Collin"),
    (33.21, -97.13, "TX", "Denton"),
    (29.76, -95.37, "TX", "Harris"),
]

# Map OWM event strings to our normalized types
_OWM_EVENT_TYPE_MAP: dict[str, str] = {
    "hail": "hail",
    "thunderstorm": "hail",
    "severe thunderstorm": "hail",
    "tornado": "tornado",
    "wind": "wind",
    "high wind": "wind",
    "extreme wind": "wind",
    "hurricane": "hurricane",
    "tropical storm": "hurricane",
    "flood": "wind",  # closest match
    "flash flood": "wind",
}

_OWM_SEVERITY_MAP: dict[str, str] = {
    "extreme": "extreme",
    "severe": "severe",
    "moderate": "high",
    "minor": "moderate",
    "advisory": "moderate",
    "watch": "moderate",
    "warning": "severe",
}


def _classify_event(event_name: str) -> str:
    """Map an OWM alert event name to our normalized event type."""
    lower = event_name.lower()
    for keyword, etype in _OWM_EVENT_TYPE_MAP.items():
        if keyword in lower:
            return etype
    return "wind"  # safe default for unknown severe weather


def _classify_severity(event_name: str, tags: list[str] | None = None) -> str:
    """Derive severity from event name and tags."""
    lower = event_name.lower()
    for keyword, sev in _OWM_SEVERITY_MAP.items():
        if keyword in lower:
            return sev
    # Check tags
    for tag in (tags or []):
        tag_lower = tag.lower()
        for keyword, sev in _OWM_SEVERITY_MAP.items():
            if keyword in tag_lower:
                return sev
    return "moderate"


def _extract_wind_speed(description: str) -> tuple[float | None, float | None]:
    """Extract wind speed and gust from description text."""
    wind = None
    gust = None
    wind_match = re.search(r"winds?\s*(?:of\s*)?(\d+)\s*mph", description, re.IGNORECASE)
    if wind_match:
        wind = float(wind_match.group(1))
    gust_match = re.search(r"gusts?\s*(?:to\s*|of\s*)?(\d+)\s*mph", description, re.IGNORECASE)
    if gust_match:
        gust = float(gust_match.group(1))
    return wind, gust


def _extract_hail_size(description: str) -> float | None:
    """Extract hail size in inches from description text."""
    match = re.search(r"(\d+\.?\d*)\s*inch\s*hail", description, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def fetch_owm_alerts() -> list[dict]:
    """Fetch weather alerts from OpenWeatherMap for probe points.

    Returns a list of StormEvent-compatible dicts, deduplicated by alert event
    name + sender (since the same alert may cover multiple probe points).
    """
    api_key = settings.OPENWEATHERMAP_API_KEY
    if not api_key:
        logger.debug("OpenWeatherMap API key not configured — skipping OWM fetch.")
        return []

    seen_ids: set[str] = set()
    events: list[dict] = []

    for lat, lon, state, county in _PROBE_POINTS:
        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.get(
                    OWM_ONECALL_URL,
                    params={
                        "lat": lat,
                        "lon": lon,
                        "appid": api_key,
                        "exclude": "minutely,hourly,daily,current",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning("OWM fetch failed for (%.2f, %.2f): %s", lat, lon, exc)
            continue

        alerts = data.get("alerts", [])
        for alert in alerts:
            event_name = alert.get("event", "Unknown")
            sender = alert.get("sender_name", "")
            # Dedup key: event + sender + start time
            dedup_key = f"{event_name}|{sender}|{alert.get('start', '')}"
            if dedup_key in seen_ids:
                continue
            seen_ids.add(dedup_key)

            event_type = _classify_event(event_name)
            severity = _classify_severity(event_name, alert.get("tags"))
            description = alert.get("description", "") or ""

            start_ts = alert.get("start")
            end_ts = alert.get("end")
            reported_at = (
                datetime.fromtimestamp(start_ts, tz=timezone.utc)
                if start_ts
                else datetime.now(timezone.utc)
            )
            expires_at = (
                datetime.fromtimestamp(end_ts, tz=timezone.utc)
                if end_ts
                else None
            )

            external_id = f"owm-{dedup_key}"

            event_dict: dict = {
                "event_type": event_type,
                "title": f"{event_name} ({sender})"[:200],
                "description": description[:2000] if description else None,
                "severity": severity,
                "latitude": lat,
                "longitude": lon,
                "radius_miles": 15.0,
                "state": state,
                "county": county,
                "zip_codes": None,
                "reported_at": reported_at,
                "expires_at": expires_at,
                "source": f"OpenWeatherMap {sender}"[:100],
                "is_active": True,
                "external_id": external_id[:200],
                "data_source": "openweathermap",
            }

            # Type-specific fields
            if event_type == "hail":
                event_dict["hail_size_inches"] = _extract_hail_size(description)
            elif event_type == "wind":
                wind, gust = _extract_wind_speed(description)
                event_dict["wind_speed_mph"] = wind
                event_dict["gust_speed_mph"] = gust

            events.append(event_dict)

    logger.info("OWM alerts: fetched %d alerts from %d probe points.", len(events), len(_PROBE_POINTS))
    return events
