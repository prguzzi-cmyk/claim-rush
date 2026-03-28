#!/usr/bin/env python

"""Philadelphia Carto SQL API client for crime data."""

from datetime import datetime, timezone

import httpx

from app.core.log import logger
from app.utils.crime_type_mapping import (
    compute_claim_relevance,
    compute_severity,
    normalize_incident_type,
)

# Insurance-relevant Philadelphia crime types
PHILLY_RELEVANT_CODES = (
    "Burglary Residential",
    "Burglary Non-Residential",
    "Theft from Vehicle",
    "Thefts",
    "Other Thefts",
    "Vandalism/Criminal Mischief",
    "Motor Vehicle Theft",
    "Arson",
    "Robbery No Firearm",
    "Robbery Firearm",
)


def fetch_philly_crime(
    endpoint_url: str,
    since_datetime: datetime | None = None,
    limit: int = 5000,
) -> list[dict]:
    """
    Fetch insurance-relevant crime data from Philadelphia's Carto SQL API.

    Endpoint: phl.carto.com/api/v2/sql
    Table: incidents_part1_part2
    """
    url = endpoint_url.rstrip("/")

    codes_str = ", ".join(f"'{c}'" for c in PHILLY_RELEVANT_CODES)
    where_parts = [f"text_general_code IN ({codes_str})"]

    if since_datetime:
        date_str = since_datetime.strftime("%Y-%m-%d")
        where_parts.append(f"dispatch_date >= '{date_str}'")

    where_clause = " AND ".join(where_parts)
    sql = (
        f"SELECT * FROM incidents_part1_part2 "
        f"WHERE {where_clause} "
        f"ORDER BY dispatch_date DESC "
        f"LIMIT {limit}"
    )

    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(url, params={"q": sql})
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.error(f"Philadelphia Carto crime fetch failed: {exc}")
        return []

    rows = data.get("rows", [])
    if not isinstance(rows, list):
        return []

    return _normalize_philly(rows)


def _normalize_philly(rows: list[dict]) -> list[dict]:
    """Normalize Philadelphia crime data to common crime incident format."""
    incidents = []
    for record in rows:
        external_id = str(record.get("objectid", ""))
        if not external_id:
            continue

        raw_type = record.get("text_general_code", "")
        incident_type = normalize_incident_type(raw_type, "philly_carto")
        if not incident_type:
            continue

        severity = compute_severity(incident_type, None)
        address = record.get("location_block", "")
        has_address = bool(address)
        relevance = compute_claim_relevance(incident_type, severity, has_address)

        occurred_at = _parse_philly_datetime(
            record.get("dispatch_date"),
            record.get("dispatch_time"),
        )

        incidents.append({
            "external_id": external_id,
            "incident_type": incident_type,
            "raw_incident_type": str(raw_type)[:255],
            "occurred_at": occurred_at,
            "reported_at": occurred_at,
            "address": str(address)[:500] if address else None,
            "city": "Philadelphia",
            "state": "PA",
            "zip_code": None,
            "county": "Philadelphia",
            "latitude": _safe_float(record.get("lat")),
            "longitude": _safe_float(record.get("lng")),
            "severity": severity,
            "claim_relevance_score": relevance,
            "estimated_loss": None,
            "property_type": None,
            "description": (
                f"{raw_type}. District: {record.get('dc_dist', '')}. "
                f"UCR Code: {record.get('ucr_general', '')}"
            )[:500],
            "source_freshness": "near_real_time",
            "is_mock": False,
        })

    return incidents


def _parse_philly_datetime(
    date_val: str | None, time_val: str | None
) -> datetime | None:
    if not date_val:
        return None
    try:
        dt = datetime.fromisoformat(str(date_val).replace("Z", "+00:00"))
        if time_val:
            try:
                parts = str(time_val).split(":")
                dt = dt.replace(hour=int(parts[0]), minute=int(parts[1]))
            except (ValueError, IndexError):
                pass
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except (ValueError, TypeError):
        return None


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
