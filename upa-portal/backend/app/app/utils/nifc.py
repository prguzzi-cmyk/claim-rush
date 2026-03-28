#!/usr/bin/env python

"""NIFC ArcGIS REST API client for active wildland fire incidents."""

from datetime import datetime, timezone

import httpx

from app.core.log import logger

NIFC_DEFAULT_URL = (
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
    "WFIGS_Incident_Locations_Current/FeatureServer/0/query"
)


def fetch_nifc_incidents(endpoint_url: str | None = None) -> list[dict]:
    """
    Fetch all current wildland fire incidents from the NIFC ArcGIS REST API.

    Parameters
    ----------
    endpoint_url : str | None
        Override for the default NIFC query endpoint.

    Returns
    -------
    list[dict]
        Normalized incident dicts with keys: external_id, call_type, call_type_description,
        address, latitude, longitude, received_at, source_url.
    """
    url = endpoint_url or NIFC_DEFAULT_URL
    params = {
        "where": "1=1",
        "outFields": "*",
        "f": "json",
        "resultRecordCount": "2000",
    }

    try:
        with httpx.Client(timeout=60) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.error(f"NIFC fetch failed: {exc}")
        return []

    features = data.get("features", [])
    if not features:
        return []

    return _normalize_nifc(features)


def _normalize_nifc(features: list[dict]) -> list[dict]:
    """Normalize NIFC ArcGIS feature records to common incident format."""
    incidents = []
    for feature in features:
        attrs = feature.get("attributes", {})

        irwin_id = attrs.get("IrwinID") or attrs.get("GlobalID")
        if not irwin_id:
            continue

        incident_name = attrs.get("IncidentName", "")
        poo_state = attrs.get("POOState", "")
        poo_city = attrs.get("POOCity", "")
        incident_size = attrs.get("IncidentSize")
        pct_contained = attrs.get("PercentContained")

        lat = _safe_float(attrs.get("InitialLatitude"))
        lon = _safe_float(attrs.get("InitialLongitude"))

        # Fallback to geometry if no lat/lon in attributes
        if lat is None or lon is None:
            geometry = feature.get("geometry", {})
            if geometry:
                if lon is None:
                    lon = _safe_float(geometry.get("x"))
                if lat is None:
                    lat = _safe_float(geometry.get("y"))

        # Parse discovery datetime (epoch milliseconds)
        discovery_ts = attrs.get("FireDiscoveryDateTime")
        received_at = _parse_epoch_ms(discovery_ts)

        # Build address from available fields
        address_parts = [p for p in [incident_name, poo_city, poo_state] if p]
        address = ", ".join(address_parts) if address_parts else None

        # Description
        desc = f"Wildland Fire: {incident_name}"
        if incident_size is not None:
            desc += f" ({incident_size:.0f} acres"
            if pct_contained is not None:
                desc += f", {pct_contained:.0f}% contained"
            desc += ")"

        incidents.append({
            "external_id": str(irwin_id),
            "call_type": "WF",
            "call_type_description": desc[:100],
            "address": address[:500] if address else None,
            "latitude": lat,
            "longitude": lon,
            "received_at": received_at,
            "source_url": f"https://inciweb.wildfire.gov",
        })

    return incidents


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _parse_epoch_ms(val) -> datetime | None:
    if val is None:
        return None
    try:
        return datetime.fromtimestamp(int(val) / 1000, tz=timezone.utc)
    except (ValueError, TypeError, OSError):
        return None
