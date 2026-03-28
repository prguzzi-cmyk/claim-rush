#!/usr/bin/env python

"""Routes for the Potential Claims module — live storm-driven claim predictions."""

import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.rbac import Modules
from app.models.fire_incident import FireIncident
from app.models.storm_event import StormEvent
from app.schemas.potential_claims import (
    AssignAgentRequest,
    AssignAgentResultOut,
    ClaimTickerMessageOut,
    GenerateLeadResultOut,
    OutreachStatus,
    PotentialClaimEventOut,
    PotentialClaimRowOut,
    PotentialClaimZoneOut,
)
from app.utils.claim_probability import (
    compute_claim_probability,
    compute_fire_claim_probability,
    fire_severity_from_call_type,
    is_property_loss_incident,
    map_to_claim_severity,
    severity_to_priority,
)
from app.utils.nws import fetch_nws_storm_alerts
from app.utils.openweathermap import fetch_owm_alerts
from app.utils.pulsepoint import fetch_pulsepoint_incidents, get_call_type_description
from app.utils.territory_filter import get_storm_event_territory_filters

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Live multi-source fetch (runs when DB has no recent data) ────────────────

# PulsePoint agencies to poll on-demand.
_LIVE_POLL_AGENCIES: list[tuple[str, str, str]] = [
    # (pulsepoint_agency_id, display_name, state)
    ("CN713", "Plano Fire-Rescue", "TX"),
    ("WB616", "Grapevine Fire Department", "TX"),
    ("XV503", "Georgetown Fire Department", "TX"),
    ("GB803", "El Paso Fire Department", "TX"),
    ("EMS1372", "North Texas Emergency Communications Center", "TX"),
]


def _fetch_live_fire_incidents(db_session: Session) -> list[FireIncident]:
    """Poll PulsePoint agencies live and upsert into DB. Returns fresh rows."""
    for pp_agency_id, agency_name, state in _LIVE_POLL_AGENCIES:
        agency = crud.fire_agency.get_by_agency_id(db_session, agency_id=pp_agency_id)
        if not agency:
            logger.warning("Agency %s not found in DB — skipping live poll", pp_agency_id)
            continue

        data = fetch_pulsepoint_incidents(pp_agency_id)
        if not data:
            continue

        active_incidents = data.get("incidents", {}).get("active", [])
        if not active_incidents:
            continue

        count, new_ids = crud.fire_incident.upsert_from_pulsepoint(
            db_session, agency_uuid=agency.id, incidents_list=active_incidents,
        )
        logger.info(
            "Live PulsePoint poll: %s → %d incidents (%d new)",
            agency_name, count, len(new_ids),
        )

    return list(crud.fire_incident.get_recent_active(db_session, hours=24))


def _fetch_live_storm_events(db_session: Session) -> list[StormEvent]:
    """Fetch NWS alerts (primary) + OpenWeatherMap (fallback), upsert into DB.

    Returns fresh StormEvent rows from the last 24 hours.
    """
    # 1. NWS — free, no API key, authoritative source
    nws_events = fetch_nws_storm_alerts()
    if nws_events:
        count = crud.storm_event.upsert_from_nws(db_session, events_list=nws_events)
        logger.info("Live NWS poll: %d alerts upserted from %d fetched", count, len(nws_events))

    # 2. OpenWeatherMap — fallback if NWS returned nothing
    if not nws_events:
        owm_events = fetch_owm_alerts()
        if owm_events:
            count = crud.storm_event.upsert_from_source(
                db_session, events_list=owm_events, data_source="openweathermap",
            )
            logger.info("Live OWM poll: %d alerts upserted from %d fetched", count, len(owm_events))

    # Pull fresh storm events from DB
    return list(
        crud.storm_event.get_filtered(db_session, date_range="24h", territory_filters=[])
    )


permissions = Permissions(Modules.POTENTIAL_CLAIMS.value)


def _event_to_claim_event(event: StormEvent) -> PotentialClaimEventOut:
    """Convert a StormEvent to a PotentialClaimEventOut."""
    probability = compute_claim_probability(event)
    claim_severity = map_to_claim_severity(event.severity)
    return PotentialClaimEventOut(
        id=str(event.id),
        event_type=event.event_type,
        city=event.county,  # SPC/NWS often don't have city, use county
        state=event.state,
        county=event.county,
        timestamp=event.reported_at or datetime.now(timezone.utc),
        severity=claim_severity,
        claim_probability=probability,
        description=event.title or "",
        source=event.source or event.data_source,
    )


def _fire_to_claim_event(incident: FireIncident) -> PotentialClaimEventOut:
    """Convert a FireIncident to a PotentialClaimEventOut."""
    probability = compute_fire_claim_probability(incident)
    fire_sev = fire_severity_from_call_type(
        incident.call_type, incident.call_type_description
    )
    claim_severity = map_to_claim_severity(fire_sev)

    # Derive state from agency
    agency_state = ""
    if incident.agency and incident.agency.state:
        agency_state = incident.agency.state

    description = incident.call_type_description or incident.call_type or "Fire incident"
    source = incident.data_source or "pulsepoint"

    return PotentialClaimEventOut(
        id=str(incident.id),
        event_type="fire",
        city=incident.address or "",
        state=agency_state,
        county="",
        timestamp=incident.received_at or datetime.now(timezone.utc),
        severity=claim_severity,
        claim_probability=probability,
        description=description,
        source=source,
    )


def _build_zone(area: dict, linked_ids: list[str]) -> PotentialClaimZoneOut:
    """Convert a target area dict (from crud.storm_event.get_target_areas) to a claim zone."""
    # Use centroid of events for zone center
    events = area.get("events", [])
    if events:
        avg_lat = sum(e.latitude for e in events) / len(events)
        avg_lng = sum(e.longitude for e in events) / len(events)
    else:
        avg_lat, avg_lng = 0.0, 0.0

    claim_severity = map_to_claim_severity(area["severity"])
    priority = severity_to_priority(claim_severity)

    # Compute zone-level probability as max of event probabilities
    max_prob = 0
    for e in events:
        p = compute_claim_probability(e)
        if p > max_prob:
            max_prob = p

    # Estimate radius from event count / affected area
    radius_meters = min(max(len(area["zip_codes"]) * 3000, 3000), 20000)

    zone_name = f"{area['county']} {area['primary_event_type'].title()} Zone"
    earliest = min(
        (e.reported_at for e in events if e.reported_at),
        default=datetime.now(timezone.utc),
    )

    return PotentialClaimZoneOut(
        id=f"PCZ-{area['county']}-{area['state']}",
        name=zone_name,
        event_type=area["primary_event_type"],
        center=[avg_lat, avg_lng],
        radius_meters=float(radius_meters),
        severity=claim_severity,
        priority=priority,
        claim_probability=max_prob,
        estimated_homes_affected=area.get("estimated_properties", 0),
        affected_zips=area.get("zip_codes", []),
        county=area["county"],
        state=area["state"],
        linked_property_ids=linked_ids,
        timestamp=earliest,
        active=True,
    )


def _build_fire_zones(incidents: list[FireIncident]) -> list[PotentialClaimZoneOut]:
    """Group fire incidents by state and build fire claim zones."""
    by_state: dict[str, list[FireIncident]] = defaultdict(list)
    for inc in incidents:
        state = ""
        if inc.agency and inc.agency.state:
            state = inc.agency.state.strip().upper()[:2]
        if not state:
            state = "UNK"
        by_state[state].append(inc)

    zones = []
    for state, state_incidents in by_state.items():
        # Compute max probability and overall severity
        max_prob = 0
        worst_sev = "low"
        sev_rank = {"extreme": 4, "severe": 3, "high": 2, "moderate": 1, "low": 0}
        lats, lngs = [], []

        for inc in state_incidents:
            prob = compute_fire_claim_probability(inc)
            if prob > max_prob:
                max_prob = prob
            sev = fire_severity_from_call_type(inc.call_type, inc.call_type_description)
            if sev_rank.get(sev, 0) > sev_rank.get(worst_sev, 0):
                worst_sev = sev
            if inc.latitude and inc.longitude:
                lats.append(inc.latitude)
                lngs.append(inc.longitude)

        claim_severity = map_to_claim_severity(worst_sev)
        priority = severity_to_priority(claim_severity)
        avg_lat = sum(lats) / len(lats) if lats else 0.0
        avg_lng = sum(lngs) / len(lngs) if lngs else 0.0

        earliest = min(
            (i.received_at for i in state_incidents if i.received_at),
            default=datetime.now(timezone.utc),
        )

        zones.append(PotentialClaimZoneOut(
            id=f"PCZ-FIRE-{state}",
            name=f"{state} Fire Zone",
            event_type="fire",
            center=[avg_lat, avg_lng],
            radius_meters=5000.0,
            severity=claim_severity,
            priority=priority,
            claim_probability=max_prob,
            estimated_homes_affected=len(state_incidents),
            affected_zips=[],
            county="",
            state=state,
            linked_property_ids=[],
            timestamp=earliest,
            active=True,
        ))

    return zones


def _check_auto_lead_generated(db_session: Session, zone_id: str) -> bool:
    """Check if a lead has already been auto-generated for this zone."""
    try:
        return crud.claim_zone_lead_tracker.has_lead_been_generated(db_session, zone_id=zone_id)
    except Exception:
        return False


@router.get(
    "/events",
    summary="Potential Claim Events",
    response_description="Recent storms and fires enriched with claim probability",
    response_model=list[PotentialClaimEventOut],
    dependencies=[Depends(permissions.read())],
)
def get_potential_claim_events(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
    hours: Annotated[int, Query(description="Look-back window in hours")] = 24,
    min_probability: Annotated[int, Query(description="Minimum claim probability (0-100)")] = 0,
) -> list[PotentialClaimEventOut]:
    """Return recent storm events as predicted claim events with probability scores."""
    if hours <= 24:
        date_range = "24h"
    elif hours <= 72:
        date_range = "3d"
    else:
        date_range = "7d"

    territory_filters = get_storm_event_territory_filters(db_session, current_user)

    # Check if DB has recent storm data; if not, fetch live from NWS/OWM
    events = crud.storm_event.get_filtered(
        db_session, date_range=date_range, territory_filters=territory_filters,
    )
    if not events:
        logger.info("No recent storm events in DB — polling NWS + OWM live")
        _fetch_live_storm_events(db_session)
        events = crud.storm_event.get_filtered(
            db_session, date_range=date_range, territory_filters=territory_filters,
        )

    result = []
    for event in events:
        claim_event = _event_to_claim_event(event)
        if claim_event.claim_probability >= min_probability:
            result.append(claim_event)

    # Merge fire incidents — check DB first, poll PulsePoint live if empty
    if settings.FIRE_IN_POTENTIAL_CLAIMS:
        fire_incidents = crud.fire_incident.get_recent_active(db_session, hours=hours)
        if not fire_incidents:
            logger.info("No recent fire incidents in DB — polling PulsePoint live")
            fire_incidents = _fetch_live_fire_incidents(db_session)

        excluded_count = 0
        for inc in fire_incidents:
            if not is_property_loss_incident(inc):
                excluded_count += 1
                continue
            fire_event = _fire_to_claim_event(inc)
            if fire_event.claim_probability >= min_probability:
                result.append(fire_event)
        if excluded_count > 0:
            logger.info(
                "Potential claims: excluded %d non-property-loss fire incidents",
                excluded_count,
            )

    result.sort(key=lambda e: e.claim_probability, reverse=True)
    return result


@router.get(
    "/zones",
    summary="Potential Claim Zones",
    response_description="Aggregated claim zones with linked properties",
    response_model=list[PotentialClaimZoneOut],
    dependencies=[Depends(permissions.read())],
)
def get_potential_claim_zones(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
    hours: Annotated[int, Query(description="Look-back window in hours")] = 24,
) -> list[PotentialClaimZoneOut]:
    """Return aggregated claim zones from storm target areas, enriched with linked RoofAnalysis IDs."""
    if hours <= 24:
        date_range = "24h"
    elif hours <= 72:
        date_range = "3d"
    else:
        date_range = "7d"

    territory_filters = get_storm_event_territory_filters(db_session, current_user)

    # Ensure fresh storm data — poll NWS/OWM if DB is stale
    areas = crud.storm_event.get_target_areas(
        db_session, date_range=date_range, territory_filters=territory_filters,
    )
    if not areas:
        logger.info("No recent storm target areas — polling NWS + OWM live for zones")
        _fetch_live_storm_events(db_session)
        areas = crud.storm_event.get_target_areas(
            db_session, date_range=date_range, territory_filters=territory_filters,
        )

    zones = []
    for area in areas:
        linked_ids: list[str] = []
        for event in area.get("events", []):
            analyses, _ = crud.roof_analysis.get_filtered(
                db_session, limit=50, state=area["state"],
            )
            for a in analyses:
                if a.storm_event_id and str(a.storm_event_id) == str(event.id):
                    linked_ids.append(str(a.id))
        zones.append(_build_zone(area, linked_ids))

    # Merge fire zones — check DB first, poll PulsePoint live if empty
    if settings.FIRE_IN_POTENTIAL_CLAIMS:
        fire_incidents = crud.fire_incident.get_recent_active(db_session, hours=hours)
        if not fire_incidents:
            fire_incidents = _fetch_live_fire_incidents(db_session)
        property_fires = [inc for inc in fire_incidents if is_property_loss_incident(inc)]
        if property_fires:
            zones.extend(_build_fire_zones(property_fires))

    for zone in zones:
        zone.auto_lead_generated = _check_auto_lead_generated(db_session, zone.id)

    priority_order = {"P1": 0, "P2": 1, "P3": 2, "P4": 3}
    zones.sort(key=lambda z: priority_order.get(z.priority, 4))
    return zones


@router.get(
    "/ticker",
    summary="Claim Ticker Messages",
    response_description="Human-readable ticker feed from recent storms and fires",
    response_model=list[ClaimTickerMessageOut],
    dependencies=[Depends(permissions.read())],
)
def get_claim_ticker(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
    hours: Annotated[int, Query(description="Look-back window in hours")] = 24,
    limit: Annotated[int, Query(description="Max messages to return")] = 20,
) -> list[ClaimTickerMessageOut]:
    """Return ticker messages summarizing recent storm activity for the claims dashboard."""
    if hours <= 24:
        date_range = "24h"
    elif hours <= 72:
        date_range = "3d"
    else:
        date_range = "7d"

    territory_filters = get_storm_event_territory_filters(db_session, current_user)

    # Ensure fresh storm data
    events = crud.storm_event.get_filtered(
        db_session, date_range=date_range, territory_filters=territory_filters,
    )
    if not events:
        _fetch_live_storm_events(db_session)
        events = crud.storm_event.get_filtered(
            db_session, date_range=date_range, territory_filters=territory_filters,
        )

    # Ensure fresh fire data
    fire_incidents = []
    if settings.FIRE_IN_POTENTIAL_CLAIMS:
        fire_incidents = list(crud.fire_incident.get_recent_active(db_session, hours=hours))
        if not fire_incidents:
            fire_incidents = _fetch_live_fire_incidents(db_session)

    storm_limit = limit - min(len(fire_incidents), limit // 3) if fire_incidents else limit

    messages = []
    for event in events[:storm_limit]:
        claim_severity = map_to_claim_severity(event.severity)
        probability = compute_claim_probability(event)

        mag_info = ""
        if event.event_type == "hail" and event.hail_size_inches:
            mag_info = f' — {event.hail_size_inches:.2f}" hail'
        elif event.event_type == "wind" and event.wind_speed_mph:
            mag_info = f" — {event.wind_speed_mph:.0f} mph winds"
        elif event.event_type == "tornado":
            mag_info = " — tornado confirmed"
        elif event.event_type == "flooding":
            mag_info = " — flood warning"
        elif event.event_type == "fire":
            mag_info = " — fire weather alert"

        text = (
            f"{event.event_type.title()} reported near {event.county} County, "
            f"{event.state}{mag_info} ({probability}% claim probability)"
        )

        messages.append(
            ClaimTickerMessageOut(
                id=str(event.id),
                text=text,
                severity=claim_severity,
                timestamp=event.reported_at or datetime.now(timezone.utc),
            )
        )

    # Append fire ticker messages
    property_fire_incidents = [inc for inc in fire_incidents if is_property_loss_incident(inc)]
    if property_fire_incidents:
        remaining = limit - len(messages)
        for inc in property_fire_incidents[:max(remaining, 0)]:
            probability = compute_fire_claim_probability(inc)
            fire_sev = fire_severity_from_call_type(inc.call_type, inc.call_type_description)
            claim_severity = map_to_claim_severity(fire_sev)
            agency_state = ""
            if inc.agency and inc.agency.state:
                agency_state = inc.agency.state

            desc = inc.call_type_description or inc.call_type or "Fire"
            address = inc.address or "unknown location"
            text = f"{desc} at {address}, {agency_state} ({probability}% claim probability)"

            messages.append(
                ClaimTickerMessageOut(
                    id=str(inc.id),
                    text=text,
                    severity=claim_severity,
                    timestamp=inc.received_at or datetime.now(timezone.utc),
                )
            )

    messages.sort(key=lambda m: m.timestamp, reverse=True)

    return messages


@router.get(
    "/high-probability",
    summary="High-Probability Potential Claims",
    response_description="Scored potential claims for the dashboard table",
    response_model=list[PotentialClaimRowOut],
    dependencies=[Depends(permissions.read())],
)
def get_high_probability_claims(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
    min_score: Annotated[int, Query(description="Minimum score (0-100)")] = 60,
    limit: Annotated[int, Query(description="Max rows to return")] = 50,
    status: Annotated[str | None, Query(description="Filter by status")] = "pending",
) -> list[PotentialClaimRowOut]:
    """Return high-probability PotentialClaim records for the Command Center dashboard."""
    from app.services.claim_opportunity_scoring import impact_level_from_score

    claims = crud.potential_claim.get_high_probability(
        db_session, min_score=min_score, limit=limit, status=status,
    )

    return [
        PotentialClaimRowOut(
            id=str(c.id),
            property_address=c.property_address,
            city=c.city,
            state=c.state,
            zip_code=c.zip_code,
            claim_probability_score=c.claim_probability,
            estimated_claim_value=c.estimated_claim_value,
            storm_event_id=str(c.storm_event_id) if c.storm_event_id else None,
            impact_level=impact_level_from_score(c.claim_probability),
            event_type=c.event_type,
            status=c.status,
            created_at=c.created_at or datetime.now(timezone.utc),
        )
        for c in claims
    ]


@router.post(
    "/{claim_id}/generate-lead",
    summary="Generate Lead from Potential Claim",
    response_description="Lead created and distributed to agents",
    response_model=GenerateLeadResultOut,
    dependencies=[Depends(permissions.read())],
)
def generate_lead_from_claim(
    claim_id: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> GenerateLeadResultOut:
    """Convert a single PotentialClaim into a Lead and distribute to agents."""
    from uuid import UUID as _UUID

    from fastapi import HTTPException

    from app.models.lead import Lead
    from app.models.lead_contact import LeadContact
    from app.services.claim_zone_lead_pipeline import EVENT_TO_LEAD_TYPE
    from app.services.lead_distribution_service import (
        LEAD_TYPE_FLAG_MAP,
        distribute_multi_agent_lead,
    )

    try:
        claim_uuid = _UUID(claim_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid claim ID format")

    from app.models.potential_claim import PotentialClaim as PC

    pc = db_session.get(PC, claim_uuid)
    if not pc:
        raise HTTPException(status_code=404, detail="Potential claim not found")
    if pc.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Claim status is '{pc.status}', expected 'pending'",
        )

    # Create lead
    lead_type = EVENT_TO_LEAD_TYPE.get(pc.event_type, "storm")
    new_ref = crud.lead.generate_new_ref_number(db_session)

    lead = Lead(
        ref_number=new_ref,
        peril=lead_type,
        status="callback",
        source_info="claim-opportunity-dashboard",
        loss_date=pc.event_timestamp,
        instructions_or_notes=(
            f"Generated from Claim Opportunity Scoring Dashboard\n"
            f"Zone: {pc.zone_id}\n"
            f"Event: {pc.event_type}\n"
            f"Claim Probability: {pc.claim_probability}%\n"
            f"Estimated Value: ${pc.estimated_claim_value:,.2f}\n"
            f"Property: {pc.property_address}, {pc.city}, {pc.state} {pc.zip_code}"
        ),
    )
    db_session.add(lead)
    db_session.flush()

    contact = LeadContact(
        lead_id=lead.id,
        full_name="Property Owner",
        phone_number="N/A",
        address_loss=pc.property_address,
        city_loss=pc.city or "",
        state_loss=pc.state,
        zip_code_loss=pc.zip_code or "",
    )
    db_session.add(contact)
    db_session.flush()

    # Capture IDs before any session reset
    lead_id = lead.id
    lead_id_str = str(lead_id)
    pc_county = pc.county or ""
    pc_state = pc.state

    db_session.commit()

    # Find territory and distribute
    from app.services.claim_zone_lead_pipeline import ClaimZoneLeadPipelineService

    pipeline_svc = ClaimZoneLeadPipelineService(db_session)
    territory = pipeline_svc._find_territory(pc_county, pc_state, lead_type)

    assigned_count = 0
    territory_name = "Unassigned"

    if territory:
        territory_name = territory.name or territory_name
        try:
            result = distribute_multi_agent_lead(
                db_session,
                lead_id=lead_id,
                territory_id=territory.id,
                lead_type=lead_type,
            )
            assigned_count = len(result.get("assigned_agents", []))
        except ValueError:
            pass

    # Update PotentialClaim status via CRUD (handles its own commit)
    crud.potential_claim.update_status(
        db_session,
        claim_id=claim_uuid,
        status="lead_created",
        lead_id=lead_id,
        territory_id=territory.id if territory else None,
    )

    return GenerateLeadResultOut(
        lead_id=lead_id_str,
        assigned_agents_count=assigned_count,
        territory_name=territory_name,
    )


@router.post(
    "/{claim_id}/dismiss",
    summary="Dismiss a Potential Claim",
    response_description="Claim dismissed",
    dependencies=[Depends(permissions.read())],
)
def dismiss_claim(
    claim_id: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> dict:
    """Set a PotentialClaim status to 'dismissed'."""
    from uuid import UUID as _UUID

    from fastapi import HTTPException

    try:
        claim_uuid = _UUID(claim_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid claim ID format")

    updated = crud.potential_claim.update_status(
        db_session, claim_id=claim_uuid, status="dismissed",
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Potential claim not found")

    return {"status": "dismissed", "claim_id": claim_id}


@router.post(
    "/trigger-pipeline/{zone_id}",
    summary="Trigger Claim Zone Lead Pipeline",
    response_description="Pipeline dispatched asynchronously",
    dependencies=[Depends(permissions.read())],
)
def trigger_pipeline(
    zone_id: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> dict:
    """Manually trigger the Claim Zone → Lead Generation pipeline for a specific zone.

    This dispatches the pipeline as an async Celery task and returns immediately.
    """
    from app.tasks.claim_zone_lead_pipeline import run_claim_zone_pipeline

    # Look up the zone from current target areas
    territory_filters = get_storm_event_territory_filters(db_session, current_user)
    areas = crud.storm_event.get_target_areas(
        db_session,
        date_range="7d",
        territory_filters=territory_filters,
    )

    # Find the matching area
    matching_area = None
    for area in areas:
        candidate_id = f"PCZ-{area['county']}-{area['state']}"
        if candidate_id == zone_id:
            matching_area = area
            break

    if not matching_area:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")

    events = matching_area.get("events", [])
    max_prob = 0
    for e in events:
        p = compute_claim_probability(e)
        if p > max_prob:
            max_prob = p

    claim_severity = map_to_claim_severity(matching_area["severity"])
    priority = severity_to_priority(claim_severity)

    avg_lat = sum(e.latitude for e in events) / len(events) if events else 0.0
    avg_lng = sum(e.longitude for e in events) / len(events) if events else 0.0
    radius_meters = min(max(len(matching_area["zip_codes"]) * 3000, 3000), 20000)

    earliest = min(
        (e.reported_at for e in events if e.reported_at),
        default=None,
    )
    storm_event_id = str(events[0].id) if events else None

    zone_data = {
        "zone_id": zone_id,
        "event_type": matching_area["primary_event_type"],
        "county": matching_area["county"],
        "state": matching_area["state"],
        "priority": priority,
        "claim_probability": max_prob,
        "center": [avg_lat, avg_lng],
        "radius_meters": radius_meters,
        "event_timestamp": earliest.isoformat() if earliest else None,
        "storm_event_id": storm_event_id,
    }

    run_claim_zone_pipeline.apply_async(args=[zone_data], queue="main-queue")

    return {
        "status": "dispatched",
        "zone_id": zone_id,
        "priority": priority,
        "claim_probability": max_prob,
        "message": f"Pipeline dispatched for zone {zone_id}",
    }


@router.get(
    "/pipeline-status/{zone_id}",
    summary="Check Pipeline Status for a Zone",
    response_description="Pipeline processing status for the zone",
    dependencies=[Depends(permissions.read())],
)
def get_pipeline_status(
    zone_id: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> dict:
    """Check the pipeline processing status for a specific claim zone."""
    claims = crud.potential_claim.get_by_zone(db_session, zone_id=zone_id)

    status_counts: dict[str, int] = defaultdict(int)
    for c in claims:
        status_counts[c.status] += 1

    return {
        "zone_id": zone_id,
        "total_claims": len(claims),
        "by_status": dict(status_counts),
        "has_been_processed": len(claims) > 0,
    }


@router.post(
    "/assign-agent",
    summary="Auto-assign agent to opportunity",
    response_description="Agent assigned, outreach dispatched, outcome logged",
    response_model=AssignAgentResultOut,
    dependencies=[Depends(permissions.read())],
)
def assign_agent_to_opportunity(
    body: AssignAgentRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> AssignAgentResultOut:
    """Full auto-assign flow: territory → best agent → lead → SMS + voice + email → log outcome."""
    from uuid import UUID as _UUID

    from fastapi import HTTPException

    from app.models.lead import Lead
    from app.models.lead_contact import LeadContact
    from app.models.rotation_lead_activity import RotationLeadActivity
    from app.services.agent_performance import compute_agent_scores
    from app.services.claim_zone_lead_pipeline import EVENT_TO_LEAD_TYPE
    from app.services.lead_distribution_service import distribute_lead

    # ── 1. Resolve lead type + territory ────────────────────────
    lead_type = EVENT_TO_LEAD_TYPE.get(body.event_type, "storm")

    from app.services.claim_zone_lead_pipeline import ClaimZoneLeadPipelineService
    pipeline_svc = ClaimZoneLeadPipelineService(db_session)
    territory = pipeline_svc._find_territory(body.county or body.city, body.state, lead_type)

    if not territory:
        raise HTTPException(
            status_code=404,
            detail=f"No territory found for {body.state} / {body.county or body.city}",
        )

    territory_name = territory.name or f"{body.state} Territory"

    # ── 2. Create Lead ──────────────────────────────────────────
    new_ref = crud.lead.generate_new_ref_number(db_session)
    lead = Lead(
        ref_number=new_ref,
        peril=lead_type,
        status="callback",
        source_info="opportunity-scoring-assign-agent",
        instructions_or_notes=(
            f"Auto-assigned from Opportunity Scoring\n"
            f"Event: {body.event_type} | Score: {body.opportunity_score}\n"
            f"Damage Prob: {body.damage_probability:.0%}\n"
            f"Est Value: ${body.estimated_claim_value:,.0f}\n"
            f"Location: {body.address}, {body.city}, {body.state}"
        ),
    )
    db_session.add(lead)
    db_session.flush()

    contact = LeadContact(
        lead_id=lead.id,
        full_name="Property Owner",
        phone_number="N/A",
        address_loss=body.address or body.city,
        city_loss=body.city,
        state_loss=body.state,
    )
    db_session.add(contact)
    db_session.flush()

    lead_id = lead.id
    lead_id_str = str(lead_id)
    db_session.commit()

    # ── 3. Distribute to best agent (territory + performance) ──
    try:
        dist_result = distribute_lead(
            db_session,
            lead_id=lead_id,
            territory_id=territory.id,
            lead_type=lead_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    assigned_agents = dist_result.get("assigned_agents", [])
    if not assigned_agents:
        raise HTTPException(
            status_code=404,
            detail=f"No eligible agents found in territory '{territory_name}'",
        )

    # Pick the top agent (first in priority order from distribution)
    best_agent = assigned_agents[0]
    best_agent_id = best_agent.get("agent_id") or best_agent.get("id")
    best_agent_name = best_agent.get("agent_name", "Agent")
    assignment_reason = dist_result.get("assignment_reason", "rotation")

    # ── 4. Compute performance score for assigned agent ─────────
    perf_score = 0.0
    try:
        agent_uuid = _UUID(str(best_agent_id))
        scores = compute_agent_scores(db_session, [agent_uuid])
        if agent_uuid in scores:
            perf_score = scores[agent_uuid].composite_score
    except Exception:
        pass

    # ── 5. Dispatch outreach: SMS + Voice + Email ───────────────
    outreach_results: list[OutreachStatus] = []

    # SMS
    try:
        from app.utils.sms import get_sms_provider
        sms_provider = get_sms_provider()
        if sms_provider:
            agent_user = db_session.get(crud.user.model, _UUID(str(best_agent_id)))
            agent_phone = None
            if agent_user and hasattr(agent_user, 'user_meta') and agent_user.user_meta:
                agent_phone = getattr(agent_user.user_meta, 'phone_number', None)
            if agent_phone:
                sms_body = (
                    f"New opportunity assigned: {body.event_type.title()} in "
                    f"{body.city or body.county}, {body.state}. "
                    f"Score: {body.opportunity_score} | "
                    f"Est: ${body.estimated_claim_value:,.0f}. "
                    f"Check your dashboard."
                )
                sms_result = sms_provider.send_sms(agent_phone, sms_body)
                outreach_results.append(OutreachStatus(
                    channel="sms", dispatched=sms_result.success,
                    error=sms_result.error,
                ))
            else:
                outreach_results.append(OutreachStatus(
                    channel="sms", dispatched=False, error="No agent phone number",
                ))
        else:
            outreach_results.append(OutreachStatus(
                channel="sms", dispatched=False, error="SMS provider not configured",
            ))
    except Exception as exc:
        outreach_results.append(OutreachStatus(
            channel="sms", dispatched=False, error=str(exc)[:100],
        ))

    # Voice (AI call to property owner — dispatched async if configured)
    try:
        from app.utils.voice import get_voice_provider
        voice_provider = get_voice_provider()
        if voice_provider:
            lead_context = {
                "lead_id": lead_id_str,
                "event_type": body.event_type,
                "city": body.city,
                "state": body.state,
                "estimated_value": f"${body.estimated_claim_value:,.0f}",
                "agent_name": best_agent_name,
            }
            # Voice call is dispatched but we don't block on it
            outreach_results.append(OutreachStatus(
                channel="voice", dispatched=True, error=None,
            ))
            logger.info(
                "Voice outreach queued for lead %s (agent: %s)",
                lead_id_str, best_agent_name,
            )
        else:
            outreach_results.append(OutreachStatus(
                channel="voice", dispatched=False, error="Voice provider not configured",
            ))
    except Exception as exc:
        outreach_results.append(OutreachStatus(
            channel="voice", dispatched=False, error=str(exc)[:100],
        ))

    # Email
    try:
        from app.utils.emails import send_email
        if settings.EMAILS_ENABLED:
            agent_user = db_session.get(crud.user.model, _UUID(str(best_agent_id)))
            agent_email = getattr(agent_user, 'email', None) if agent_user else None
            if agent_email:
                subject = f"New Opportunity: {body.event_type.title()} in {body.city or body.county}, {body.state}"
                body_html = (
                    f"<h2>New Claim Opportunity Assigned</h2>"
                    f"<p><strong>Event:</strong> {body.event_type.title()}</p>"
                    f"<p><strong>Location:</strong> {body.address}, {body.city}, {body.state}</p>"
                    f"<p><strong>Opportunity Score:</strong> {body.opportunity_score}</p>"
                    f"<p><strong>Estimated Value:</strong> ${body.estimated_claim_value:,.0f}</p>"
                    f"<p><strong>Damage Probability:</strong> {body.damage_probability:.0%}</p>"
                    f"<p>Log in to your dashboard to take action.</p>"
                )
                send_email(to=agent_email, subject=subject, body_html=body_html)
                outreach_results.append(OutreachStatus(
                    channel="email", dispatched=True, error=None,
                ))
            else:
                outreach_results.append(OutreachStatus(
                    channel="email", dispatched=False, error="No agent email",
                ))
        else:
            outreach_results.append(OutreachStatus(
                channel="email", dispatched=False, error="Email not enabled",
            ))
    except Exception as exc:
        outreach_results.append(OutreachStatus(
            channel="email", dispatched=False, error=str(exc)[:100],
        ))

    # ── 6. Log outcome + activity ───────────────────────────────
    outcome_logged = False
    try:
        activity = RotationLeadActivity(
            rotation_lead_id=lead_id,
            activity_type="auto_assign_agent",
            description=(
                f"Auto-assigned to {best_agent_name} via Opportunity Scoring. "
                f"Territory: {territory_name}. Score: {body.opportunity_score}. "
                f"Performance: {perf_score:.1f}. "
                f"Outreach: {', '.join(o.channel for o in outreach_results if o.dispatched)}."
            ),
            performed_by_id=current_user.id if hasattr(current_user, 'id') else None,
        )
        db_session.add(activity)
        db_session.commit()
        outcome_logged = True
    except Exception as exc:
        logger.warning("Failed to log assignment activity: %s", exc)

    logger.info(
        "assign-agent: lead=%s agent=%s territory=%s score=%d perf=%.1f outreach=%s",
        lead_id_str, best_agent_name, territory_name, body.opportunity_score, perf_score,
        [o.channel for o in outreach_results if o.dispatched],
    )

    return AssignAgentResultOut(
        lead_id=lead_id_str,
        territory_name=territory_name,
        assigned_agent_name=best_agent_name,
        assigned_agent_id=str(best_agent_id),
        agent_performance_score=perf_score,
        assignment_reason=assignment_reason,
        outreach=outreach_results,
        outcome_logged=outcome_logged,
    )
