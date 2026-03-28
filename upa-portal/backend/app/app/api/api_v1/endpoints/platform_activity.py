"""Platform Activity Feed — aggregates recent events from multiple tables."""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, func, literal, literal_column, outerjoin, select, union_all
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db_session
from app.models.claim import Claim
from app.models.fire_incident import FireIncident
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.lead_owner_intelligence import LeadOwnerIntelligence
from app.models.user import User
from app.models.voice_call_log import VoiceCallLog
from app.schemas.platform_activity import PlatformActivityEvent, PlatformActivityResponse

router = APIRouter()

# Column set shared by all sub-queries
_COLS = [
    "id", "event_type", "icon", "color", "title",
    "detail", "location", "assigned_agent", "timestamp",
]


def _str(col):
    """Cast a column to text for UNION compatibility."""
    return func.cast(col, String).label("id")


@router.get(
    "/recent",
    summary="Recent Platform Activity",
    response_description="Aggregated activity events from the last N hours",
    response_model=PlatformActivityResponse,
)
def get_recent_activity(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
    hours: int = Query(default=24, ge=1, le=168),
    limit: int = Query(default=50, ge=1, le=200),
) -> PlatformActivityResponse:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Allocate slots: fire gets 40%, rest split equally among non-empty types
    fire_limit = max(limit * 2 // 5, 5)
    other_limit = max((limit - fire_limit) // 4, 5)

    # ── 1. Fire Incidents (capped) ──
    fire_q = (
        select(
            func.cast(FireIncident.id, String).label("id"),
            literal("fire_incident").label("event_type"),
            literal("local_fire_department").label("icon"),
            literal("#ff1744").label("color"),
            func.coalesce(
                FireIncident.call_type_description,
                FireIncident.call_type,
                literal("Fire Incident"),
            ).label("title"),
            func.coalesce(FireIncident.address, literal("Unknown location")).label("detail"),
            FireIncident.address.label("location"),
            literal(None, type_=String).label("assigned_agent"),
            func.cast(FireIncident.created_at, String).label("timestamp"),
        )
        .where(FireIncident.created_at >= cutoff)
        .order_by(FireIncident.created_at.desc())
        .limit(fire_limit)
    )

    # ── 2. Leads (with contact + assigned user) ──
    lead_q = (
        select(
            func.cast(Lead.id, String).label("id"),
            literal("lead_created").label("event_type"),
            literal("person_add").label("icon"),
            literal("#00e676").label("color"),
            func.concat(
                literal("New Lead — Ref #"),
                func.cast(Lead.ref_number, String),
            ).label("title"),
            func.coalesce(Lead.peril, literal("")).label("detail"),
            func.concat(
                func.coalesce(LeadContact.city_loss, literal("")),
                literal(", "),
                func.coalesce(LeadContact.state_loss, literal("")),
            ).label("location"),
            func.concat(
                func.coalesce(User.first_name, literal("")),
                literal(" "),
                func.coalesce(User.last_name, literal("")),
            ).label("assigned_agent"),
            func.cast(Lead.created_at, String).label("timestamp"),
        )
        .select_from(
            outerjoin(
                outerjoin(Lead, LeadContact, Lead.id == LeadContact.lead_id),
                User,
                Lead.assigned_to == User.id,
            )
        )
        .where(Lead.created_at >= cutoff)
        .order_by(Lead.created_at.desc())
        .limit(other_limit)
    )

    # ── 3. Skip Trace (Lead Owner Intelligence) ──
    skip_q = (
        select(
            func.cast(LeadOwnerIntelligence.id, String).label("id"),
            literal("skip_trace_completed").label("event_type"),
            literal("person_search").label("icon"),
            literal("#aa00ff").label("color"),
            func.concat(
                literal("Skip Trace — "),
                func.coalesce(LeadOwnerIntelligence.owner_first_name, literal("")),
                literal(" "),
                func.coalesce(LeadOwnerIntelligence.owner_last_name, literal("")),
            ).label("title"),
            func.coalesce(LeadOwnerIntelligence.lookup_status, literal("")).label("detail"),
            func.concat(
                func.coalesce(LeadOwnerIntelligence.owner_mailing_city, literal("")),
                literal(", "),
                func.coalesce(LeadOwnerIntelligence.owner_mailing_state, literal("")),
            ).label("location"),
            literal(None, type_=String).label("assigned_agent"),
            func.cast(LeadOwnerIntelligence.created_at, String).label("timestamp"),
        )
        .where(LeadOwnerIntelligence.created_at >= cutoff)
        .order_by(LeadOwnerIntelligence.created_at.desc())
        .limit(other_limit)
    )

    # ── 4. Voice Calls ──
    voice_q = (
        select(
            func.cast(VoiceCallLog.id, String).label("id"),
            literal("voice_call").label("event_type"),
            literal("phone_in_talk").label("icon"),
            literal("#00e5ff").label("color"),
            func.concat(
                literal("Voice Call — "),
                func.coalesce(VoiceCallLog.lead_name, literal("Unknown")),
            ).label("title"),
            func.coalesce(VoiceCallLog.status, literal("")).label("detail"),
            literal(None, type_=String).label("location"),
            literal(None, type_=String).label("assigned_agent"),
            func.cast(VoiceCallLog.created_at, String).label("timestamp"),
        )
        .where(VoiceCallLog.created_at >= cutoff)
        .order_by(VoiceCallLog.created_at.desc())
        .limit(other_limit)
    )

    # ── 5. Claims ──
    claim_q = (
        select(
            func.cast(Claim.id, String).label("id"),
            literal("claim_opened").label("event_type"),
            literal("assignment").label("icon"),
            literal("#2979ff").label("color"),
            func.concat(
                literal("Claim Opened — CLM-"),
                func.cast(Claim.ref_number, String),
            ).label("title"),
            func.coalesce(Claim.insurance_company, literal("")).label("detail"),
            literal(None, type_=String).label("location"),
            literal(None, type_=String).label("assigned_agent"),
            func.cast(Claim.created_at, String).label("timestamp"),
        )
        .where(Claim.created_at >= cutoff)
        .order_by(Claim.created_at.desc())
        .limit(other_limit)
    )

    # ── Merge pre-limited results, re-sort globally ──
    combined = union_all(fire_q, lead_q, skip_q, voice_q, claim_q).subquery()
    stmt = (
        select(combined)
        .order_by(combined.c.timestamp.desc())
        .limit(limit)
    )

    rows = db_session.execute(stmt).mappings().all()

    items = [
        PlatformActivityEvent(
            id=str(r["id"]),
            event_type=r["event_type"],
            icon=r["icon"],
            color=r["color"],
            title=r["title"] or "",
            detail=r["detail"] or "",
            location=(
                r["location"]
                if r["location"] and r["location"].strip(", ")
                else None
            ),
            assigned_agent=(
                r["assigned_agent"]
                if r["assigned_agent"] and r["assigned_agent"].strip()
                else None
            ),
            timestamp=(
                str(r["timestamp"])
                if r["timestamp"]
                else datetime.now(timezone.utc).isoformat()
            ),
        )
        for r in rows
    ]

    return PlatformActivityResponse(items=items, total=len(items))
