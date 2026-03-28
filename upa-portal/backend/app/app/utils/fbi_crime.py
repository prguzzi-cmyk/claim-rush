#!/usr/bin/env python

"""FBI Crime Data Explorer API client + mock fallback."""

import random
from datetime import datetime, timezone
from uuid import uuid4

import httpx

from app.core.log import logger
from app.utils.crime_type_mapping import (
    compute_claim_relevance,
    compute_severity,
)


def fetch_fbi_aggregate_stats(
    endpoint_url: str,
    api_key: str | None = None,
) -> list[dict]:
    """
    FBI Crime Data Explorer API: api.usa.gov/crime/fbi/sapi/

    Returns aggregate state/national stats — NOT individual incidents.
    Generates synthetic summary records labeled is_mock=True, source_freshness="historical".
    """
    if not api_key:
        logger.info("FBI API key not configured; falling back to mock data.")
        return generate_fbi_mock_incidents()

    url = f"{endpoint_url.rstrip('/')}/api/estimates/national"
    params = {"API_KEY": api_key}

    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.error(f"FBI Crime Data Explorer fetch failed: {exc}. Falling back to mock.")
        return generate_fbi_mock_incidents()

    if not isinstance(data, (list, dict)):
        return generate_fbi_mock_incidents()

    # FBI API returns aggregate stats, not individual incidents
    # We convert these to summary records for trend scoring
    results = data.get("results", []) if isinstance(data, dict) else data
    if not results:
        return generate_fbi_mock_incidents()

    incidents = []
    for record in results[:50]:
        year = record.get("year", 2023)
        for offense_key, incident_type in [
            ("burglary", "burglary"),
            ("larceny", "theft"),
            ("motor_vehicle_theft", "theft"),
            ("arson", "property_damage"),
        ]:
            count = record.get(offense_key, 0)
            if not count:
                continue

            severity = compute_severity(incident_type, None)
            relevance = compute_claim_relevance(incident_type, severity, False)

            incidents.append({
                "external_id": f"fbi-{year}-{offense_key}",
                "incident_type": incident_type,
                "raw_incident_type": f"FBI UCR {offense_key} ({year})",
                "occurred_at": datetime(year, 1, 1, tzinfo=timezone.utc),
                "reported_at": datetime(year, 1, 1, tzinfo=timezone.utc),
                "address": None,
                "city": None,
                "state": record.get("state_abbr"),
                "zip_code": None,
                "county": None,
                "latitude": None,
                "longitude": None,
                "severity": severity,
                "claim_relevance_score": relevance,
                "estimated_loss": None,
                "property_type": None,
                "description": f"FBI UCR aggregate: {count:,} {offense_key} incidents reported in {year}",
                "source_freshness": "historical",
                "is_mock": True,
            })

    return incidents


def generate_fbi_mock_incidents() -> list[dict]:
    """
    Fallback: generate clearly labeled mock incidents
    with data_source="fbi_ucr_mock", is_mock=True.
    """
    mock_data = [
        {
            "type": "burglary",
            "raw": "FBI UCR Burglary Summary",
            "desc": "FBI UCR mock: National burglary trend indicator — ~1.1M reported annually",
            "state": "US",
        },
        {
            "type": "theft",
            "raw": "FBI UCR Larceny-Theft Summary",
            "desc": "FBI UCR mock: National larceny-theft trend indicator — ~4.6M reported annually",
            "state": "US",
        },
        {
            "type": "theft",
            "raw": "FBI UCR Motor Vehicle Theft Summary",
            "desc": "FBI UCR mock: National motor vehicle theft trend indicator — ~721K reported annually",
            "state": "US",
        },
        {
            "type": "property_damage",
            "raw": "FBI UCR Arson Summary",
            "desc": "FBI UCR mock: National arson trend indicator — ~38K reported annually",
            "state": "US",
        },
        {
            "type": "vandalism",
            "raw": "FBI UCR Property Crime Summary",
            "desc": "FBI UCR mock: National property crime trend indicator — ~6.9M reported annually",
            "state": "US",
        },
    ]

    incidents = []
    for item in mock_data:
        severity = compute_severity(item["type"], None)
        relevance = compute_claim_relevance(item["type"], severity, False)

        incidents.append({
            "external_id": f"fbi-mock-{uuid4().hex[:8]}",
            "incident_type": item["type"],
            "raw_incident_type": item["raw"][:255],
            "occurred_at": datetime.now(tz=timezone.utc),
            "reported_at": datetime.now(tz=timezone.utc),
            "address": None,
            "city": None,
            "state": item["state"],
            "zip_code": None,
            "county": None,
            "latitude": None,
            "longitude": None,
            "severity": severity,
            "claim_relevance_score": relevance,
            "estimated_loss": None,
            "property_type": None,
            "description": item["desc"],
            "source_freshness": "historical",
            "is_mock": True,
        })

    return incidents
