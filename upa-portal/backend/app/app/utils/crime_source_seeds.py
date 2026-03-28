#!/usr/bin/env python

"""Default seed data for crime data source configurations."""

from uuid import UUID

# Deterministic UUIDs for seed data
CRIME_SOURCE_SEEDS = [
    {
        "id": UUID("00000000-0000-4000-b000-000000000001"),
        "source_type": "socrata",
        "name": "Chicago Open Crime Data",
        "endpoint_url": "https://data.cityofchicago.org",
        "api_key": None,
        "dataset_id": "ijzp-q8t2",
        "poll_interval_seconds": 900,
        "last_record_count": 0,
        "connection_status": "pending",
        "freshness_label": "near_real_time",
        "enabled": True,
        "extra_config": None,
    },
    {
        "id": UUID("00000000-0000-4000-b000-000000000002"),
        "source_type": "carto",
        "name": "Philadelphia Crime Data",
        "endpoint_url": "https://phl.carto.com/api/v2/sql",
        "api_key": None,
        "dataset_id": None,
        "poll_interval_seconds": 900,
        "last_record_count": 0,
        "connection_status": "pending",
        "freshness_label": "near_real_time",
        "enabled": True,
        "extra_config": None,
    },
    {
        "id": UUID("00000000-0000-4000-b000-000000000003"),
        "source_type": "fbi_api",
        "name": "FBI UCR Crime Stats",
        "endpoint_url": "https://api.usa.gov/crime/fbi/sapi",
        "api_key": None,
        "dataset_id": None,
        "poll_interval_seconds": 86400,
        "last_record_count": 0,
        "connection_status": "pending",
        "freshness_label": "historical",
        "enabled": True,
        "extra_config": None,
    },
    {
        "id": UUID("00000000-0000-4000-b000-000000000004"),
        "source_type": "mock",
        "name": "Mock Crime Feed",
        "endpoint_url": None,
        "api_key": None,
        "dataset_id": None,
        "poll_interval_seconds": 0,
        "last_record_count": 0,
        "connection_status": "mock",
        "freshness_label": None,
        "enabled": False,
        "extra_config": None,
    },
]
