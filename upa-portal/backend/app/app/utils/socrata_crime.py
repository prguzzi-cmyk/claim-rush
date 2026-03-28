#!/usr/bin/env python

"""Socrata / SODA API client for city open data crime feeds."""

import json
from datetime import datetime, timezone

import httpx

from app.core.log import logger
from app.utils.crime_type_mapping import (
    compute_claim_relevance,
    compute_severity,
    normalize_incident_type,
)

# Insurance-relevant Chicago primary_type values
CHICAGO_CRIME_TYPES = (
    "BURGLARY",
    "THEFT",
    "MOTOR VEHICLE THEFT",
    "CRIMINAL DAMAGE",
    "CRIMINAL TRESPASS",
    "ARSON",
    "ROBBERY",
)


def fetch_chicago_crime(
    endpoint_url: str,
    dataset_id: str,
    since_datetime: datetime | None = None,
    limit: int = 5000,
) -> list[dict]:
    """
    Fetch insurance-relevant crime incidents from Chicago Socrata open data.

    Dataset: data.cityofchicago.org/resource/ijzp-q8t2.json
    """
    url = f"{endpoint_url.rstrip('/')}/resource/{dataset_id}.json"

    types_str = ", ".join(f"'{t}'" for t in CHICAGO_CRIME_TYPES)
    where_parts = [f"primary_type IN ({types_str})"]

    if since_datetime:
        iso_str = since_datetime.strftime("%Y-%m-%dT%H:%M:%S")
        where_parts.append(f"date > '{iso_str}'")

    params = {
        "$where": " AND ".join(where_parts),
        "$limit": str(limit),
        "$order": "date DESC",
    }

    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            raw_data = response.json()
    except Exception as exc:
        logger.error(f"Chicago Socrata crime fetch failed: {exc}")
        return []

    if not isinstance(raw_data, list):
        return []

    return _normalize_chicago(raw_data)


def _normalize_chicago(raw_data: list[dict]) -> list[dict]:
    """Normalize Chicago crime data to common crime incident format."""
    incidents = []
    for record in raw_data:
        external_id = record.get("id") or record.get("case_number") or ""
        if not external_id:
            continue

        raw_type = record.get("primary_type", "")
        incident_type = normalize_incident_type(raw_type, "chicago_socrata")
        if not incident_type:
            continue

        estimated_loss = None  # Chicago dataset doesn't provide loss estimates
        severity = compute_severity(incident_type, estimated_loss)
        address = record.get("block", "")
        has_address = bool(address)
        relevance = compute_claim_relevance(incident_type, severity, has_address)

        occurred_at = _parse_datetime(record.get("date"))

        incidents.append({
            "external_id": str(external_id),
            "incident_type": incident_type,
            "raw_incident_type": str(raw_type)[:255],
            "occurred_at": occurred_at,
            "reported_at": occurred_at,
            "address": str(address)[:500] if address else None,
            "city": "Chicago",
            "state": "IL",
            "zip_code": None,
            "county": "Cook",
            "latitude": _safe_float(record.get("latitude")),
            "longitude": _safe_float(record.get("longitude")),
            "severity": severity,
            "claim_relevance_score": relevance,
            "estimated_loss": estimated_loss,
            "property_type": _infer_property_type(record.get("location_description", "")),
            "description": (
                f"{raw_type}: {record.get('description', '')}. "
                f"Location: {record.get('location_description', '')}. "
                f"District: {record.get('district', '')}"
            )[:500],
            "source_freshness": "near_real_time",
            "is_mock": False,
        })

    return incidents


def fetch_socrata_crime_generic(
    endpoint_url: str,
    dataset_id: str,
    since_datetime: datetime | None = None,
    extra_config: str | None = None,
    limit: int = 5000,
) -> list[dict]:
    """Generic Socrata crime fetcher for other cities using extra_config for field mapping."""
    config = {}
    if extra_config:
        try:
            config = json.loads(extra_config)
        except (json.JSONDecodeError, TypeError):
            pass

    crime_type_field = config.get("crime_type_field", "primary_type")
    datetime_field = config.get("datetime_field", "date")
    city_name = config.get("city_name", "Unknown")
    state_code = config.get("state_code", "")
    county_name = config.get("county_name", "")

    url = f"{endpoint_url.rstrip('/')}/resource/{dataset_id}.json"
    params: dict = {"$limit": str(limit), "$order": ":id DESC"}

    where_parts = []
    if since_datetime:
        iso_str = since_datetime.strftime("%Y-%m-%dT%H:%M:%S")
        where_parts.append(f"{datetime_field} > '{iso_str}'")
    if where_parts:
        params["$where"] = " AND ".join(where_parts)

    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            raw_data = response.json()
    except Exception as exc:
        logger.error(f"Socrata crime fetch failed for {endpoint_url}: {exc}")
        return []

    if not isinstance(raw_data, list):
        return []

    incidents = []
    for record in raw_data:
        external_id = (
            record.get("id") or record.get("case_number")
            or record.get("incident_number") or record.get(":id") or ""
        )
        if not external_id:
            continue

        raw_type = record.get(crime_type_field, "")
        incident_type = normalize_incident_type(raw_type, "chicago_socrata")
        if not incident_type:
            continue

        severity = compute_severity(incident_type, None)
        address = record.get("block") or record.get("address") or ""
        relevance = compute_claim_relevance(incident_type, severity, bool(address))

        incidents.append({
            "external_id": str(external_id),
            "incident_type": incident_type,
            "raw_incident_type": str(raw_type)[:255],
            "occurred_at": _parse_datetime(record.get(datetime_field)),
            "reported_at": _parse_datetime(record.get(datetime_field)),
            "address": str(address)[:500] if address else None,
            "city": city_name,
            "state": state_code,
            "zip_code": None,
            "county": county_name,
            "latitude": _safe_float(record.get("latitude")),
            "longitude": _safe_float(record.get("longitude")),
            "severity": severity,
            "claim_relevance_score": relevance,
            "estimated_loss": None,
            "property_type": None,
            "description": f"{raw_type}: {record.get('description', '')}"[:500],
            "source_freshness": "near_real_time",
            "is_mock": False,
        })

    return incidents


def _infer_property_type(location_desc: str) -> str | None:
    """Attempt to infer property type from Chicago location_description field."""
    loc = location_desc.lower()
    if any(w in loc for w in ("residence", "apartment", "house", "home", "condo")):
        return "residential"
    if any(w in loc for w in ("store", "office", "restaurant", "bar", "shop", "commercial")):
        return "commercial"
    if any(w in loc for w in ("warehouse", "factory", "construction", "industrial")):
        return "industrial"
    if any(w in loc for w in ("vehicle", "parking", "car", "auto")):
        return "vehicle"
    return None


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _parse_datetime(val) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        pass
    for fmt in ["%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y %I:%M:%S %p"]:
        try:
            return datetime.strptime(str(val), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None
