#!/usr/bin/env python

"""NASA FIRMS (Fire Information for Resource Management System) API client."""

import csv
import io
from datetime import datetime, timezone

import httpx

from app.core.log import logger

FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# Continental US bounding box: west, south, east, north
US_BBOX = "-125,24,-66,50"


def fetch_firms_hotspots(
    api_key: str,
    area: str = US_BBOX,
    days: int = 1,
    source: str = "VIIRS_SNPP_NRT",
) -> list[dict]:
    """
    Fetch satellite-detected fire hotspots from NASA FIRMS.

    Parameters
    ----------
    api_key : str
        NASA FIRMS MAP_KEY for API access.
    area : str
        Bounding box as "west,south,east,north" (default continental US).
    days : int
        Number of days of data to retrieve (1-5).
    source : str
        Satellite source (VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, MODIS_NRT).

    Returns
    -------
    list[dict]
        Normalized incident dicts.
    """
    if not api_key:
        logger.warning("FIRMS API key not configured, skipping fetch.")
        return []

    url = f"{FIRMS_BASE_URL}/{api_key}/{source}/{area}/{days}"

    try:
        with httpx.Client(timeout=60) as client:
            response = client.get(url)
            response.raise_for_status()
            text = response.text
    except Exception as exc:
        logger.error(f"FIRMS fetch failed: {exc}")
        return []

    if not text or text.startswith("<!") or "Error" in text[:200]:
        logger.error(f"FIRMS returned error response: {text[:200]}")
        return []

    return _parse_firms_csv(text)


def _parse_firms_csv(csv_text: str) -> list[dict]:
    """Parse FIRMS CSV response and normalize to common incident format."""
    reader = csv.DictReader(io.StringIO(csv_text))
    incidents = []

    for row in reader:
        lat = _safe_float(row.get("latitude"))
        lon = _safe_float(row.get("longitude"))
        if lat is None or lon is None:
            continue

        confidence = row.get("confidence", "").strip().lower()
        # Filter low confidence detections
        if confidence in ("l", "low"):
            continue

        acq_date = row.get("acq_date", "")
        acq_time = row.get("acq_time", "")
        satellite = row.get("satellite", "N")
        brightness = row.get("bright_ti4") or row.get("brightness", "")
        frp = row.get("frp", "")

        # Generate unique external_id
        external_id = f"{satellite}_{acq_date}_{lat:.4f}_{lon:.4f}"

        # Parse acquisition datetime
        received_at = _parse_acq_datetime(acq_date, acq_time)

        # Build description
        desc = f"Satellite Fire ({satellite})"
        if brightness:
            desc += f" Bright={brightness}"
        if frp:
            desc += f" FRP={frp}"
        desc = desc[:100]

        incidents.append({
            "external_id": external_id,
            "call_type": "SAT",
            "call_type_description": desc,
            "address": f"Lat {lat:.4f}, Lon {lon:.4f}",
            "latitude": lat,
            "longitude": lon,
            "received_at": received_at,
            "source_url": "https://firms.modaps.eosdis.nasa.gov/map",
        })

    return incidents


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _parse_acq_datetime(acq_date: str, acq_time: str) -> datetime | None:
    """Parse FIRMS date (YYYY-MM-DD) and time (HHMM) into datetime."""
    if not acq_date:
        return None
    try:
        time_str = acq_time.zfill(4) if acq_time else "0000"
        dt_str = f"{acq_date} {time_str[:2]}:{time_str[2:]}"
        return datetime.strptime(dt_str, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None
