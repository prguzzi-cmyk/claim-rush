#!/usr/bin/env python

"""Socrata / SODA API client for city open data fire 911 dispatch feeds."""

import json
from datetime import datetime, timezone

import httpx

from app.core.log import logger


def fetch_socrata_incidents(
    endpoint_url: str,
    dataset_id: str,
    since_datetime: datetime | None = None,
    extra_config: str | None = None,
) -> list[dict]:
    """
    Fetch fire-related 911 dispatch incidents from a Socrata (SODA) open data API.

    Parameters
    ----------
    endpoint_url : str
        Base domain URL (e.g. ``https://data.seattle.gov``).
    dataset_id : str
        Socrata dataset identifier (e.g. ``kzjm-xkqj``).
    since_datetime : datetime | None
        Only fetch incidents after this datetime. If None, fetches recent data.
    extra_config : str | None
        JSON string with source-specific params like fire_type_field and fire_codes.

    Returns
    -------
    list[dict]
        Normalized incident dicts with keys: external_id, call_type, call_type_description,
        address, lat, lon, received_at.
    """
    config = {}
    if extra_config:
        try:
            config = json.loads(extra_config)
        except (json.JSONDecodeError, TypeError):
            pass

    fire_type_field = config.get("fire_type_field", "type")
    fire_codes = config.get("fire_codes", [])
    datetime_field = config.get("datetime_field", "datetime")

    url = f"{endpoint_url.rstrip('/')}/resource/{dataset_id}.json"
    params: dict = {"$limit": "1000", "$order": ":id DESC"}

    # Build SoQL where clause
    where_parts = []
    if since_datetime:
        iso_str = since_datetime.strftime("%Y-%m-%dT%H:%M:%S")
        where_parts.append(f"{datetime_field} > '{iso_str}'")

    if fire_codes:
        codes_str = " OR ".join(
            f"{fire_type_field} = '{code}'" for code in fire_codes
        )
        where_parts.append(f"({codes_str})")

    if where_parts:
        params["$where"] = " AND ".join(where_parts)

    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            raw_data = response.json()
    except Exception as exc:
        logger.error(f"Socrata fetch failed for {endpoint_url}/{dataset_id}: {exc}")
        return []

    if not isinstance(raw_data, list):
        return []

    return _normalize_socrata(raw_data, fire_type_field)


def _normalize_socrata(raw_data: list[dict], fire_type_field: str) -> list[dict]:
    """Normalize Socrata response records to common incident format."""
    incidents = []
    for record in raw_data:
        # Try common field names across different city datasets
        external_id = (
            record.get("cad_cdw_id")
            or record.get("cad_event_number")
            or record.get("incident_number")
            or record.get("case_number")
            or record.get("starfire_incident_id")
            or record.get("id")
            or record.get(":id")
            or ""
        )
        if not external_id:
            continue

        call_type_raw = record.get(fire_type_field, "")
        address = (
            record.get("address")
            or record.get("incident_address")
            or record.get("block_address")
            or record.get("block")
            or record.get("address_of_incident")
            or record.get("alarm_box_location")
            or ""
        )

        lat = _safe_float(
            record.get("latitude")
            or record.get("incident_latitude")
        )
        lon = _safe_float(
            record.get("longitude")
            or record.get("incident_longitude")
        )

        received_at_str = (
            record.get("datetime")
            or record.get("call_date_time")
            or record.get("incident_datetime")
            or record.get("alarm_datetime")
            or record.get("received_dttm")
            or record.get("date")
        )
        received_at = _parse_datetime(received_at_str)

        incidents.append({
            "external_id": str(external_id),
            "call_type": "911",
            "call_type_description": str(call_type_raw)[:100] if call_type_raw else "911 Dispatch Fire",
            "address": str(address)[:500] if address else None,
            "latitude": lat,
            "longitude": lon,
            "received_at": received_at,
        })

    return incidents


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
    # Try common Socrata floating timestamp format
    for fmt in ["%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y %I:%M:%S %p"]:
        try:
            return datetime.strptime(str(val), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None
