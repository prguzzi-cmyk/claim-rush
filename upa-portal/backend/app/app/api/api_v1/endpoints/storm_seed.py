#!/usr/bin/env python

"""Dev-only seed endpoint for storm events — populates the DB with mock data."""

import json
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps import get_current_active_user, get_db_session
from app.schemas.storm_event import StormEventCreate

router = APIRouter()


def _hours_ago(h: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=h)


def _hours_from_now(h: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=h)


SEED_EVENTS: list[dict] = [
    # === HAIL (15 events) ===
    {"event_type": "hail", "title": "Large Hail - Harris County", "description": "Golf ball sized hail reported in NW Houston suburbs", "severity": "severe", "latitude": 29.96, "longitude": -95.56, "radius_miles": 12, "state": "TX", "county": "Harris", "zip_codes": json.dumps(["77084", "77095", "77040"]), "source": "NWS Houston", "hail_size_inches": 1.75, "external_id": "seed-H001", "data_source": "seed"},
    {"event_type": "hail", "title": "Severe Hail - Tarrant County", "description": "Quarter to half-dollar hail across Fort Worth metro", "severity": "high", "latitude": 32.75, "longitude": -97.33, "radius_miles": 8, "state": "TX", "county": "Tarrant", "zip_codes": json.dumps(["76109", "76116", "76132"]), "source": "NWS Fort Worth", "hail_size_inches": 1.25, "external_id": "seed-H002", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail Storm - Oklahoma County", "description": "Ping pong ball hail across OKC metro", "severity": "severe", "latitude": 35.47, "longitude": -97.52, "radius_miles": 15, "state": "OK", "county": "Oklahoma", "zip_codes": json.dumps(["73112", "73120", "73132"]), "source": "NWS Norman", "hail_size_inches": 1.5, "external_id": "seed-H003", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Sedgwick County", "description": "Quarter size hail in Wichita area", "severity": "moderate", "latitude": 37.69, "longitude": -97.34, "radius_miles": 6, "state": "KS", "county": "Sedgwick", "zip_codes": json.dumps(["67212", "67205", "67209"]), "source": "NWS Wichita", "hail_size_inches": 1.0, "external_id": "seed-H004", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Lancaster County", "description": "Nickel to quarter hail near Lincoln", "severity": "moderate", "latitude": 40.81, "longitude": -96.70, "radius_miles": 5, "state": "NE", "county": "Lancaster", "zip_codes": json.dumps(["68516", "68510", "68521"]), "source": "NWS Omaha", "hail_size_inches": 0.88, "external_id": "seed-H005", "data_source": "seed"},
    {"event_type": "hail", "title": "Severe Hail - Dallas County", "description": "Baseball sized hail in eastern Dallas", "severity": "extreme", "latitude": 32.78, "longitude": -96.61, "radius_miles": 10, "state": "TX", "county": "Dallas", "zip_codes": json.dumps(["75228", "75218", "75238"]), "source": "NWS Fort Worth", "hail_size_inches": 2.75, "external_id": "seed-H006", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Tulsa County", "description": "Dime to quarter hail in south Tulsa", "severity": "moderate", "latitude": 36.08, "longitude": -95.92, "radius_miles": 7, "state": "OK", "county": "Tulsa", "zip_codes": json.dumps(["74136", "74133", "74145"]), "source": "NWS Tulsa", "hail_size_inches": 1.0, "external_id": "seed-H007", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Johnson County", "description": "Quarter hail in Overland Park area", "severity": "moderate", "latitude": 38.92, "longitude": -94.68, "radius_miles": 5, "state": "KS", "county": "Johnson", "zip_codes": json.dumps(["66212", "66210", "66213"]), "source": "NWS Kansas City", "hail_size_inches": 1.0, "external_id": "seed-H008", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Bexar County", "description": "Half-dollar hail in north San Antonio", "severity": "high", "latitude": 29.52, "longitude": -98.57, "radius_miles": 9, "state": "TX", "county": "Bexar", "zip_codes": json.dumps(["78230", "78240", "78248"]), "source": "NWS San Antonio", "hail_size_inches": 1.25, "external_id": "seed-H009", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Canadian County", "description": "Nickel hail west of OKC", "severity": "low", "latitude": 35.52, "longitude": -97.95, "radius_miles": 4, "state": "OK", "county": "Canadian", "zip_codes": json.dumps(["73099", "73036"]), "source": "NWS Norman", "hail_size_inches": 0.88, "external_id": "seed-H010", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Collin County", "description": "Quarter hail in Plano and McKinney", "severity": "high", "latitude": 33.10, "longitude": -96.68, "radius_miles": 8, "state": "TX", "county": "Collin", "zip_codes": json.dumps(["75024", "75069", "75070"]), "source": "NWS Fort Worth", "hail_size_inches": 1.0, "external_id": "seed-H011", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Douglas County", "description": "Small hail near Lawrence KS", "severity": "low", "latitude": 38.97, "longitude": -95.24, "radius_miles": 3, "state": "KS", "county": "Douglas", "zip_codes": json.dumps(["66044", "66049"]), "source": "NWS Topeka", "hail_size_inches": 0.75, "external_id": "seed-H012", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Cleveland County", "description": "Quarter to half-dollar hail in Norman", "severity": "moderate", "latitude": 35.22, "longitude": -97.44, "radius_miles": 6, "state": "OK", "county": "Cleveland", "zip_codes": json.dumps(["73069", "73072"]), "source": "NWS Norman", "hail_size_inches": 1.25, "external_id": "seed-H013", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Williamson County", "description": "Half-dollar hail near Round Rock TX", "severity": "high", "latitude": 30.51, "longitude": -97.68, "radius_miles": 7, "state": "TX", "county": "Williamson", "zip_codes": json.dumps(["78681", "78664", "78665"]), "source": "NWS Austin", "hail_size_inches": 1.25, "external_id": "seed-H014", "data_source": "seed"},
    {"event_type": "hail", "title": "Hail - Sarpy County", "description": "Quarter hail south of Omaha", "severity": "moderate", "latitude": 41.12, "longitude": -96.03, "radius_miles": 5, "state": "NE", "county": "Sarpy", "zip_codes": json.dumps(["68123", "68046", "68113"]), "source": "NWS Omaha", "hail_size_inches": 1.0, "external_id": "seed-H015", "data_source": "seed"},
    # === WIND (8 events) ===
    {"event_type": "wind", "title": "Damaging Winds - Lubbock County", "description": "70+ mph straight-line winds", "severity": "severe", "latitude": 33.57, "longitude": -101.85, "radius_miles": 18, "state": "TX", "county": "Lubbock", "zip_codes": json.dumps(["79416", "79407", "79424"]), "source": "NWS Lubbock", "wind_speed_mph": 72, "gust_speed_mph": 85, "external_id": "seed-W001", "data_source": "seed"},
    {"event_type": "wind", "title": "High Wind Warning - Amarillo", "description": "Sustained 50 mph winds with gusts to 70", "severity": "high", "latitude": 35.20, "longitude": -101.83, "radius_miles": 20, "state": "TX", "county": "Potter", "zip_codes": json.dumps(["79109", "79106", "79102"]), "source": "NWS Amarillo", "wind_speed_mph": 50, "gust_speed_mph": 70, "external_id": "seed-W002", "data_source": "seed"},
    {"event_type": "wind", "title": "Severe Thunderstorm Winds - Payne County", "description": "60 mph winds with damage reports", "severity": "high", "latitude": 36.12, "longitude": -97.06, "radius_miles": 10, "state": "OK", "county": "Payne", "zip_codes": json.dumps(["74074", "74075"]), "source": "NWS Norman", "wind_speed_mph": 60, "gust_speed_mph": 68, "external_id": "seed-W003", "data_source": "seed"},
    {"event_type": "wind", "title": "Wind Damage - Comanche County", "description": "Trees and power lines down from strong winds", "severity": "moderate", "latitude": 34.60, "longitude": -98.39, "radius_miles": 8, "state": "OK", "county": "Comanche", "zip_codes": json.dumps(["73501", "73505"]), "source": "NWS Norman", "wind_speed_mph": 55, "gust_speed_mph": 62, "external_id": "seed-W004", "data_source": "seed"},
    {"event_type": "wind", "title": "Derecho Event - Ellis County", "description": "Widespread wind damage from fast-moving line", "severity": "extreme", "latitude": 38.92, "longitude": -99.32, "radius_miles": 25, "state": "KS", "county": "Ellis", "zip_codes": json.dumps(["67601", "67631"]), "source": "NWS Dodge City", "wind_speed_mph": 80, "gust_speed_mph": 95, "external_id": "seed-W005", "data_source": "seed"},
    {"event_type": "wind", "title": "Wind Advisory - Hall County", "description": "Sustained winds 40-50 mph", "severity": "moderate", "latitude": 34.38, "longitude": -100.88, "radius_miles": 12, "state": "TX", "county": "Hall", "zip_codes": json.dumps(["79245"]), "source": "NWS Lubbock", "wind_speed_mph": 45, "gust_speed_mph": 55, "external_id": "seed-W006", "data_source": "seed"},
    {"event_type": "wind", "title": "Damaging Winds - Grady County", "description": "65 mph gusts with structural damage", "severity": "high", "latitude": 35.03, "longitude": -97.95, "radius_miles": 10, "state": "OK", "county": "Grady", "zip_codes": json.dumps(["73018", "73005"]), "source": "NWS Norman", "wind_speed_mph": 58, "gust_speed_mph": 65, "external_id": "seed-W007", "data_source": "seed"},
    {"event_type": "wind", "title": "Wind - Saline County", "description": "Gusty winds causing minor roof damage", "severity": "moderate", "latitude": 38.84, "longitude": -97.61, "radius_miles": 6, "state": "KS", "county": "Saline", "zip_codes": json.dumps(["67401"]), "source": "NWS Wichita", "wind_speed_mph": 48, "gust_speed_mph": 58, "external_id": "seed-W008", "data_source": "seed"},
    # === LIGHTNING (6 events) ===
    {"event_type": "lightning", "title": "Lightning Cluster - El Paso County", "description": "Intense CG lightning activity near Colorado Springs", "severity": "high", "latitude": 38.83, "longitude": -104.82, "radius_miles": 8, "state": "CO", "county": "El Paso", "zip_codes": json.dumps(["80907", "80918", "80920"]), "source": "NWS Pueblo", "strike_count": 342, "external_id": "seed-L001", "data_source": "seed"},
    {"event_type": "lightning", "title": "Lightning - Maricopa County", "description": "Monsoon-driven lightning storm over Phoenix metro", "severity": "severe", "latitude": 33.45, "longitude": -112.07, "radius_miles": 15, "state": "AZ", "county": "Maricopa", "zip_codes": json.dumps(["85004", "85008", "85016"]), "source": "NWS Phoenix", "strike_count": 518, "external_id": "seed-L002", "data_source": "seed"},
    {"event_type": "lightning", "title": "Lightning - Bernalillo County", "description": "Frequent CG strikes near Albuquerque", "severity": "moderate", "latitude": 35.08, "longitude": -106.65, "radius_miles": 10, "state": "NM", "county": "Bernalillo", "zip_codes": json.dumps(["87107", "87110", "87112"]), "source": "NWS Albuquerque", "strike_count": 185, "external_id": "seed-L003", "data_source": "seed"},
    {"event_type": "lightning", "title": "Lightning - Pima County", "description": "Active lightning cluster south of Tucson", "severity": "moderate", "latitude": 32.15, "longitude": -110.97, "radius_miles": 12, "state": "AZ", "county": "Pima", "zip_codes": json.dumps(["85710", "85730", "85748"]), "source": "NWS Tucson", "strike_count": 210, "external_id": "seed-L004", "data_source": "seed"},
    {"event_type": "lightning", "title": "Lightning - Denver County", "description": "Afternoon thunderstorm lightning over Denver", "severity": "high", "latitude": 39.74, "longitude": -104.99, "radius_miles": 6, "state": "CO", "county": "Denver", "zip_codes": json.dumps(["80202", "80204", "80211"]), "source": "NWS Boulder", "strike_count": 275, "external_id": "seed-L005", "data_source": "seed"},
    {"event_type": "lightning", "title": "Lightning - Santa Fe County", "description": "Dry thunderstorm lightning near Santa Fe", "severity": "low", "latitude": 35.69, "longitude": -105.94, "radius_miles": 5, "state": "NM", "county": "Santa Fe", "zip_codes": json.dumps(["87501", "87505"]), "source": "NWS Albuquerque", "strike_count": 95, "external_id": "seed-L006", "data_source": "seed"},
]


@router.post(
    "/seed",
    summary="Seed Storm Events (Dev Only)",
    response_description="Count of seeded events",
    status_code=status.HTTP_201_CREATED,
)
def seed_storm_events(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Insert ~29 mock storm events for development/staging. Idempotent via external_id."""
    count = 0
    for event_data in SEED_EVENTS:
        # Add reported_at times (staggered over the past 30 hours)
        idx = SEED_EVENTS.index(event_data)
        event_data_copy = {**event_data}
        event_data_copy["reported_at"] = _hours_ago(idx * 1 + 1)
        event_data_copy["expires_at"] = _hours_from_now(max(1, 6 - idx // 5))

        external_id = event_data_copy.get("external_id", "")
        # Check for existing
        existing = crud.storm_event.get_by_external_id(db_session, external_id=external_id)
        if existing:
            # Update the data_source check to match seed
            continue

        # Override get_by_external_id for seed data_source
        from sqlalchemy import and_, select
        from app.models.storm_event import StormEvent

        with db_session as session:
            stmt = select(StormEvent).where(
                and_(
                    StormEvent.external_id == external_id,
                    StormEvent.data_source == "seed",
                )
            )
            exists = session.scalar(stmt)

        if exists:
            continue

        create_data = StormEventCreate(**event_data_copy)
        crud.storm_event.create(db_session, obj_in=create_data)
        count += 1

    return {"seeded": count, "total_available": len(SEED_EVENTS)}
