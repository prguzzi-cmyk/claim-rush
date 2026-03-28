#!/usr/bin/env python

"""Fetch and parse SPC (Storm Prediction Center) filtered storm reports CSV."""

import hashlib
import io
from datetime import datetime, timezone

import httpx

from app.core.log import logger

SPC_CSV_URL = "https://www.spc.noaa.gov/climo/reports/today_filtered.csv"
USER_AGENT = "(UPA Portal Storm Intelligence, ops@upa-portal.com)"

# Knots → mph conversion factor
KNOTS_TO_MPH = 1.15078


def _hash_external_id(date_str: str, lat: float, lon: float, event_type: str, magnitude: float) -> str:
    """Create a deterministic external_id from report fields for dedup."""
    raw = f"{date_str}|{lat:.2f}|{lon:.2f}|{event_type}|{magnitude:.2f}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _derive_severity(event_type: str, magnitude: float) -> str:
    """Derive severity from storm type + magnitude."""
    if event_type == "tornado":
        return "extreme"
    if event_type == "hail":
        if magnitude >= 2.0:
            return "extreme"
        if magnitude >= 1.5:
            return "severe"
        if magnitude >= 1.0:
            return "high"
        if magnitude >= 0.75:
            return "moderate"
        return "low"
    if event_type == "wind":
        if magnitude >= 100:
            return "extreme"
        if magnitude >= 80:
            return "severe"
        if magnitude >= 58:
            return "high"
        if magnitude >= 40:
            return "moderate"
        return "low"
    return "low"


def _parse_time(time_str: str) -> datetime | None:
    """Parse SPC HHMM time string to a UTC datetime for today."""
    try:
        time_str = time_str.strip()
        if len(time_str) == 4 and time_str.isdigit():
            hour = int(time_str[:2])
            minute = int(time_str[2:])
            now = datetime.now(timezone.utc)
            return now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    except (ValueError, TypeError):
        pass
    return None


def fetch_spc_storm_reports() -> list[dict]:
    """Fetch today's SPC filtered storm reports CSV and return StormEventCreate-compatible dicts."""
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(
                SPC_CSV_URL,
                headers={"User-Agent": USER_AGENT},
            )
            resp.raise_for_status()
            csv_text = resp.text
    except Exception as exc:
        logger.error(f"SPC CSV request failed: {exc}")
        return []

    events: list[dict] = []
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    current_section: str | None = None

    for line in csv_text.splitlines():
        line = line.strip()
        if not line:
            continue

        # Detect section headers by looking for known first-column names
        lower = line.lower()
        if lower.startswith("time,f_scale") or lower.startswith("time,f-scale"):
            current_section = "tornado"
            continue
        if lower.startswith("time,speed"):
            current_section = "wind"
            continue
        if lower.startswith("time,size"):
            current_section = "hail"
            continue

        if current_section is None:
            continue

        parts = line.split(",")
        if len(parts) < 8:
            continue

        # Skip header-like rows
        if parts[0].lower() == "time":
            continue

        try:
            time_str = parts[0].strip()
            reported_at = _parse_time(time_str)
            if not reported_at:
                continue

            magnitude_raw = parts[1].strip()
            if not magnitude_raw or magnitude_raw == "UNK":
                magnitude_raw = "0"
            magnitude_val = float(magnitude_raw)

            # Location info: parts vary but typically: Time,Mag,Location,County,State,Lat,Lon,Comment
            # SPC CSV columns: Time, F_Scale/Speed/Size, Location, County, State, Lat, Lon, Comments
            location = parts[2].strip() if len(parts) > 2 else ""
            county = parts[3].strip() if len(parts) > 3 else ""
            state = parts[4].strip() if len(parts) > 4 else ""
            lat_str = parts[5].strip() if len(parts) > 5 else ""
            lon_str = parts[6].strip() if len(parts) > 6 else ""

            if not lat_str or not lon_str:
                continue
            latitude = float(lat_str)
            longitude = float(lon_str)
            # SPC longitudes for the US are typically positive but represent west; negate if positive
            if longitude > 0:
                longitude = -longitude

            if not state or len(state) > 2:
                continue

            # Convert magnitudes based on section type
            event_type = current_section
            hail_size_inches: float | None = None
            wind_speed_mph: float | None = None

            if event_type == "hail":
                # Size is in hundredths of inches (e.g. 175 = 1.75")
                hail_size_inches = magnitude_val / 100.0
                magnitude_for_severity = hail_size_inches
            elif event_type == "wind":
                # Speed in knots → mph
                wind_speed_mph = magnitude_val * KNOTS_TO_MPH
                magnitude_for_severity = wind_speed_mph
            else:
                # Tornado: F_Scale is the magnitude
                magnitude_for_severity = magnitude_val

            severity = _derive_severity(event_type, magnitude_for_severity)
            external_id = _hash_external_id(today_str, latitude, longitude, event_type, magnitude_val)

            comment = ",".join(parts[7:]).strip() if len(parts) > 7 else ""
            title_mag = ""
            if event_type == "hail" and hail_size_inches:
                title_mag = f'{hail_size_inches:.2f}" Hail'
            elif event_type == "wind" and wind_speed_mph:
                title_mag = f"{wind_speed_mph:.0f} mph Wind"
            elif event_type == "tornado":
                title_mag = f"Tornado (F{int(magnitude_val)})" if magnitude_val > 0 else "Tornado"

            title = f"{title_mag} — {county} County, {state}"[:200]

            event_dict: dict = {
                "event_type": event_type,
                "title": title,
                "description": comment[:2000] if comment else None,
                "severity": severity,
                "latitude": latitude,
                "longitude": longitude,
                "radius_miles": 5.0,
                "state": state[:2],
                "county": county[:100],
                "zip_codes": None,
                "reported_at": reported_at,
                "expires_at": None,
                "source": "SPC Storm Reports",
                "is_active": True,
                "external_id": external_id,
                "data_source": "spc",
            }

            if event_type == "hail":
                event_dict["hail_size_inches"] = hail_size_inches
            elif event_type == "wind":
                event_dict["wind_speed_mph"] = wind_speed_mph
            elif event_type == "tornado":
                event_dict["wind_speed_mph"] = None
                event_dict["hail_size_inches"] = None

            events.append(event_dict)

        except (ValueError, IndexError) as exc:
            logger.debug(f"SPC CSV: skipping malformed row: {line!r} ({exc})")
            continue

    logger.info(f"SPC CSV: parsed {len(events)} storm reports.")
    return events
