#!/usr/bin/env python

"""Routes for the Lead Intake admin view."""

import logging
import traceback
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.models.fire_incident import FireIncident
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.lead_distribution import LeadDistributionHistory
from app.models.territory import Territory, UserTerritory
from app.schemas.lead_intake import (
    LeadIntakeRecord,
    ManualLeadIntakeRequest,
    ManualLeadIntakeResponse,
)
from app.services.lead_distribution_service import distribute_lead, LEAD_TYPE_FLAG_MAP

logger = logging.getLogger(__name__)

router = APIRouter()

permissions = Permissions(Modules.FIRE_INCIDENT.value)
lead_permissions = Permissions(Modules.LEAD.value)


@router.get(
    "",
    summary="List Lead Intake Records",
    response_description="Paginated list of fire incidents with lead/territory info",
    dependencies=[Depends(permissions.read())],
)
def list_intake_records(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Page size")] = 25,
    status_filter: Annotated[
        str, Query(description="Filter: all, converted, pending, skipped")
    ] = "all",
    source_filter: Annotated[
        str, Query(description="Filter: all, pulsepoint, manual")
    ] = "all",
    date_from: Annotated[datetime | None, Query(description="Start date filter")] = None,
    date_to: Annotated[datetime | None, Query(description="End date filter")] = None,
) -> Any:
    """List fire incidents with associated lead and territory information."""

    # Base query: FireIncident with outer-join to Lead
    stmt = (
        select(FireIncident)
        .outerjoin(Lead, FireIncident.lead_id == Lead.id)
        .options(
            joinedload(FireIncident.agency),
            joinedload(FireIncident.lead),
        )
    )

    # Status filters
    if status_filter == "converted":
        stmt = stmt.where(FireIncident.lead_id.isnot(None))
    elif status_filter == "pending":
        stmt = stmt.where(
            FireIncident.auto_lead_attempted == False,
            FireIncident.lead_id.is_(None),
        )
    elif status_filter == "skipped":
        stmt = stmt.where(
            FireIncident.auto_lead_attempted == True,
            FireIncident.lead_id.is_(None),
        )

    # Source filter
    if source_filter != "all":
        stmt = stmt.where(FireIncident.data_source == source_filter)

    # Date filters
    if date_from:
        stmt = stmt.where(FireIncident.created_at >= date_from)
    if date_to:
        stmt = stmt.where(FireIncident.created_at <= date_to)

    # Count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db_session.execute(count_stmt).scalar() or 0

    # Paginate
    offset = (page - 1) * size
    stmt = stmt.order_by(FireIncident.created_at.desc()).offset(offset).limit(size)
    incidents = db_session.execute(stmt).scalars().unique().all()

    # Build response records
    items = []
    for incident in incidents:
        # Territory info via distribution history
        territory_id = None
        territory_name = None
        if incident.lead_id:
            dist = db_session.execute(
                select(LeadDistributionHistory)
                .options(joinedload(LeadDistributionHistory.territory))
                .where(LeadDistributionHistory.lead_id == incident.lead_id)
                .limit(1)
            ).scalar_one_or_none()
            if dist and dist.territory:
                territory_id = dist.territory.id
                territory_name = dist.territory.name

        # State from agency
        state = None
        if incident.agency and incident.agency.state:
            state = incident.agency.state

        # Lead ref string
        lead_ref_string = None
        lead_status = None
        if incident.lead:
            lead_ref_string = f"REF-{incident.lead.ref_number}"
            lead_status = incident.lead.status

        items.append(
            LeadIntakeRecord(
                incident_id=incident.id,
                call_type=incident.call_type,
                call_type_description=incident.call_type_description,
                address=incident.address,
                latitude=incident.latitude,
                longitude=incident.longitude,
                incident_time=incident.received_at,
                source=incident.data_source or "unknown",
                is_active=incident.is_active,
                lead_id=incident.lead_id,
                lead_ref_string=lead_ref_string,
                lead_status=lead_status,
                territory_id=territory_id,
                territory_name=territory_name,
                state=state,
                auto_lead_attempted=incident.auto_lead_attempted,
                auto_lead_skipped_reason=incident.auto_lead_skipped_reason,
                created_at=incident.created_at,
            )
        )

    return {"items": items, "total": total}


@router.post(
    "/manual",
    summary="Create Manual Test Lead",
    response_description="Created lead with distribution info",
    status_code=status.HTTP_201_CREATED,
    response_model=ManualLeadIntakeResponse,
    dependencies=[Depends(lead_permissions.create())],
)
def create_manual_lead(
    body: ManualLeadIntakeRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a test lead manually with automatic territory matching and distribution."""

    # ── Diagnostic: log incoming payload ──
    logger.info(
        "[manual-lead] payload: incident_type=%s address=%s city=%s state=%s "
        "zip_code=%s county=%s full_name=%s phone=%s auto_distribute=%s",
        body.incident_type, body.address, body.city, body.state,
        body.zip_code, body.county, body.full_name, body.phone_number,
        body.auto_distribute,
    )

    # Validate incident_type is a known lead type
    if body.incident_type not in LEAD_TYPE_FLAG_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid incident_type '{body.incident_type}'. Must be one of: {', '.join(LEAD_TYPE_FLAG_MAP.keys())}",
        )

    try:
        # Generate ref number
        new_ref = crud.lead.generate_new_ref_number(db_session)
        logger.info("[manual-lead] generated ref_number=%s", new_ref)

        # Create Lead
        lead = Lead(
            ref_number=new_ref,
            peril=body.incident_type,
            status="callback",
            source_info=body.source,
            instructions_or_notes=f"Manual test lead created by {current_user.first_name} {current_user.last_name}",
        )
        db_session.add(lead)
        db_session.flush()
        lead_id = lead.id
        lead_ref_number = lead.ref_number
        logger.info("[manual-lead] lead flushed id=%s ref=%s", lead_id, lead_ref_number)

        # Create LeadContact
        contact = LeadContact(
            lead_id=lead_id,
            full_name=body.full_name,
            phone_number=body.phone_number,
            address_loss=body.address,
            city_loss=body.city,
            state_loss=body.state,
            zip_code_loss=body.zip_code,
        )
        db_session.add(contact)
        db_session.commit()
        logger.info("[manual-lead] lead + contact committed")

        lead_ref_string = f"REF-{lead_ref_number}"

        # Find territory
        state_code = body.state.strip().upper()[:2]
        territory = _find_territory(db_session, state_code, body.county, body.incident_type)

        territory_id = territory.id if territory else None
        territory_name = territory.name if territory else None
        logger.info("[manual-lead] territory match: id=%s name=%s", territory_id, territory_name)

        # Distribute if requested
        distributed = False
        assigned_agents: list[dict] = []

        if body.auto_distribute and territory:
            try:
                result = distribute_lead(
                    db_session,
                    lead_id=lead_id,
                    territory_id=territory.id,
                    lead_type=body.incident_type,
                )
                distributed = True
                assigned_agents = result.get("assigned_agents", [])
                logger.info(
                    "[manual-lead] distributed to %d agents in territory %s",
                    len(assigned_agents), territory_name,
                )

                # Fire notification delivery for each assigned agent
                try:
                    from app.core.celery_app import celery_app

                    for agent_info in assigned_agents:
                        celery_app.send_task(
                            "app.tasks.lead_delivery.deliver_lead_assignment",
                            args=[str(lead_id), agent_info["agent_id"], str(territory.id), body.incident_type],
                        )
                except Exception as celery_err:
                    logger.warning("[manual-lead] celery delivery failed (non-fatal): %s", celery_err)
            except Exception as dist_err:
                logger.error("[manual-lead] distribution failed: %s", dist_err)

        return ManualLeadIntakeResponse(
            lead_id=lead_id,
            lead_ref_string=lead_ref_string,
            territory_id=territory_id,
            territory_name=territory_name,
            distributed=distributed,
            assigned_agents=assigned_agents,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "[manual-lead] UNHANDLED EXCEPTION:\n%s",
            traceback.format_exc(),
        )
        db_session.rollback()
        return JSONResponse(
            status_code=500,
            content={
                "error": "manual lead create failed",
                "detail": str(exc),
            },
        )


def _find_territory(
    db_session: Session, state: str, county: str | None, lead_type: str
) -> Territory | None:
    """Find matching territory for the given state/county and lead type."""
    flag_col = LEAD_TYPE_FLAG_MAP.get(lead_type)
    if not flag_col:
        return None

    # Try county-level first if county provided
    if county:
        stmt = (
            select(Territory)
            .join(UserTerritory, UserTerritory.territory_id == Territory.id)
            .where(
                Territory.is_active == True,
                Territory.territory_type == "county",
                Territory.state == state,
                getattr(Territory, flag_col) == True,
                func.lower(Territory.county) == county.strip().lower(),
            )
            .limit(1)
        )
        territory = db_session.execute(stmt).scalar_one_or_none()
        if territory:
            return territory

    # County territory (any) if no specific county match
    stmt = (
        select(Territory)
        .join(UserTerritory, UserTerritory.territory_id == Territory.id)
        .where(
            Territory.is_active == True,
            Territory.territory_type == "county",
            Territory.state == state,
            getattr(Territory, flag_col) == True,
        )
        .order_by(Territory.name.asc())
        .limit(1)
    )
    territory = db_session.execute(stmt).scalar_one_or_none()
    if territory:
        return territory

    # Fallback: state-level territory
    stmt_state = (
        select(Territory)
        .join(UserTerritory, UserTerritory.territory_id == Territory.id)
        .where(
            Territory.is_active == True,
            Territory.territory_type == "state",
            Territory.state == state,
            getattr(Territory, flag_col) == True,
        )
        .order_by(Territory.name.asc())
        .limit(1)
    )
    return db_session.execute(stmt_state).scalar_one_or_none()
