#!/usr/bin/env python

"""Agent-facing dashboard endpoints for lead pipeline management"""

from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps import get_current_active_user, get_db_session
from app.core.config import settings
from app.models.escalation_attempt import EscalationAttempt
from app.models.fire_incident import FireIncident
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.lead_contact_tracker import LeadContactTracker
from app.models.lead_distribution import LeadDistributionHistory
from app.models.user import User
from app.schemas.agent_dashboard import (
    AcceptDeclineResponse,
    AgentAvailabilityResponse,
    AgentAvailabilityUpdate,
    AgentDashboardConfig,
    AgentDashboardLead,
)
from app.services.escalation_service import EscalationService

router = APIRouter()


def _derive_dashboard_status(
    transfer_status: str,
    timeout_at: datetime | None,
    tracker_current_agent_id: UUID | None,
    current_user_id: UUID,
) -> str:
    """Derive the dashboard-specific status from escalation attempt data."""
    if transfer_status == "answered":
        return "accepted"
    if transfer_status in ("no_answer", "busy", "failed"):
        return "declined"
    # Check if escalated away from current user
    if tracker_current_agent_id and tracker_current_agent_id != current_user_id:
        return "escalated"
    # Pending — check timeout
    if transfer_status in ("pending", "initiated", "ringing"):
        if timeout_at and timeout_at <= datetime.now(timezone.utc):
            return "expired"
        return "pending"
    return "pending"


@router.get(
    "/my-leads",
    summary="Get My Assigned Leads",
    response_description="Leads assigned to the current agent with timer info",
    response_model=list[AgentDashboardLead],
)
def get_my_leads(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return all leads assigned to the logged-in agent via the escalation pipeline."""
    now = datetime.now(timezone.utc)

    with db_session as session:
        # Query escalation attempts for this agent with unresolved trackers
        stmt = (
            select(EscalationAttempt, LeadContactTracker)
            .join(
                LeadContactTracker,
                LeadContactTracker.id == EscalationAttempt.tracker_id,
            )
            .where(
                EscalationAttempt.agent_id == current_user.id,
                LeadContactTracker.is_resolved == False,
            )
            .order_by(EscalationAttempt.created_at.desc())
        )
        rows = session.execute(stmt).all()

        results: list[AgentDashboardLead] = []
        for attempt, tracker in rows:
            # Load lead + contact
            lead = session.get(Lead, attempt.lead_id)
            if not lead:
                continue

            contact_name = ""
            address = ""
            state = None
            county = None
            zip_code = None

            if lead.contact:
                contact = lead.contact
                contact_name = contact.full_name or ""
                address = contact.address_loss or contact.address or ""
                state = contact.state_loss or contact.state
                zip_code = contact.zip_code_loss or contact.zip_code

            # Get lat/lng from FireIncident if linked
            latitude = None
            longitude = None
            fi_stmt = (
                select(FireIncident)
                .where(FireIncident.lead_id == lead.id)
                .limit(1)
            )
            fire_incident = session.execute(fi_stmt).scalar_one_or_none()
            if fire_incident:
                latitude = fire_incident.latitude
                longitude = fire_incident.longitude
                # Derive county from agency if not on contact
                if not county and fire_incident.agency:
                    county = getattr(fire_incident.agency, "county", None)

            # Compute remaining seconds
            remaining = 0.0
            if attempt.timeout_at:
                remaining = max(0, (attempt.timeout_at - now).total_seconds())

            dashboard_status = _derive_dashboard_status(
                attempt.transfer_status,
                attempt.timeout_at,
                tracker.current_agent_id,
                current_user.id,
            )

            results.append(
                AgentDashboardLead(
                    lead_id=lead.id,
                    ref_number=lead.ref_number,
                    ref_string=f"Lead #{lead.ref_number}",
                    contact_name=contact_name,
                    address=address,
                    peril=lead.peril,
                    source_label="UPA Incident Intelligence Network",
                    assigned_at=attempt.created_at,
                    timeout_at=attempt.timeout_at,
                    remaining_seconds=remaining,
                    dashboard_status=dashboard_status,
                    escalation_level=attempt.escalation_level,
                    escalation_label=attempt.escalation_label,
                    tracker_id=tracker.id,
                    attempt_id=attempt.id,
                    latitude=latitude,
                    longitude=longitude,
                    state=state,
                    county=county,
                    zip_code=zip_code,
                )
            )

        return results


@router.post(
    "/leads/{lead_id}/accept",
    summary="Accept Lead",
    response_description="Lead acceptance confirmation",
    response_model=AcceptDeclineResponse,
)
def accept_lead(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Accept an assigned lead — marks escalation as answered and resolves tracker."""
    with db_session as session:
        # Find the agent's pending attempt for this lead
        stmt = (
            select(EscalationAttempt)
            .join(
                LeadContactTracker,
                LeadContactTracker.id == EscalationAttempt.tracker_id,
            )
            .where(
                EscalationAttempt.lead_id == lead_id,
                EscalationAttempt.agent_id == current_user.id,
                EscalationAttempt.transfer_status.in_(
                    ["pending", "initiated", "ringing"]
                ),
                LeadContactTracker.is_resolved == False,
            )
            .order_by(EscalationAttempt.created_at.desc())
            .limit(1)
        )
        attempt = session.execute(stmt).scalar_one_or_none()

        if not attempt:
            raise HTTPException(
                status_code=404,
                detail="No pending lead assignment found for this lead",
            )

        now = datetime.now(timezone.utc)
        attempt.transfer_status = "answered"
        attempt.transfer_answered_at = now

        # Update lead status
        lead = session.get(Lead, lead_id)
        if lead:
            lead.status = "interested"

        # Resolve the tracker
        svc = EscalationService(db_session)
        svc.mark_resolved(attempt.tracker_id, "transferred")

        session.commit()

        return AcceptDeclineResponse(
            success=True,
            lead_id=lead_id,
            new_status="accepted",
            message="Lead accepted successfully",
        )


@router.post(
    "/leads/{lead_id}/decline",
    summary="Decline Lead",
    response_description="Lead decline confirmation",
    response_model=AcceptDeclineResponse,
)
def decline_lead(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Decline an assigned lead — advances escalation to next agent."""
    with db_session as session:
        stmt = (
            select(EscalationAttempt)
            .join(
                LeadContactTracker,
                LeadContactTracker.id == EscalationAttempt.tracker_id,
            )
            .where(
                EscalationAttempt.lead_id == lead_id,
                EscalationAttempt.agent_id == current_user.id,
                EscalationAttempt.transfer_status.in_(
                    ["pending", "initiated", "ringing"]
                ),
                LeadContactTracker.is_resolved == False,
            )
            .order_by(EscalationAttempt.created_at.desc())
            .limit(1)
        )
        attempt = session.execute(stmt).scalar_one_or_none()

        if not attempt:
            raise HTTPException(
                status_code=404,
                detail="No pending lead assignment found for this lead",
            )

        attempt.transfer_status = "no_answer"

        svc = EscalationService(db_session)
        advanced = svc.advance_escalation(attempt.tracker_id)
        if not advanced:
            svc.mark_resolved(attempt.tracker_id, "exhausted")

        session.commit()

        return AcceptDeclineResponse(
            success=True,
            lead_id=lead_id,
            new_status="declined",
            message="Lead declined — escalation advanced"
            if advanced
            else "Lead declined — all escalation levels exhausted",
        )


@router.get(
    "/config",
    summary="Get Dashboard Config",
    response_description="Agent dashboard configuration",
    response_model=AgentDashboardConfig,
)
def get_config(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return dashboard config (escalation timeouts, poll intervals)."""
    return AgentDashboardConfig(
        escalation_timeout_seconds=settings.ESCALATION_TIMEOUT_SECONDS,
        poll_interval_ms=15000,
    )


def _count_leads_today(session, agent_id: UUID) -> int:
    """Count leads distributed to an agent today (UTC)."""
    from sqlalchemy import func as sa_func
    today_start = datetime.combine(
        datetime.now(timezone.utc).date(),
        datetime.min.time(),
        tzinfo=timezone.utc,
    )
    return session.scalar(
        select(sa_func.count(LeadDistributionHistory.id)).where(
            LeadDistributionHistory.assigned_agent_id == agent_id,
            LeadDistributionHistory.distributed_at >= today_start,
        )
    ) or 0


@router.get(
    "/availability",
    summary="Get My Lead Availability",
    response_description="Current agent availability settings",
    response_model=AgentAvailabilityResponse,
)
def get_availability(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return the current agent's lead availability settings."""
    with db_session as session:
        leads_today = _count_leads_today(session, current_user.id)

    return AgentAvailabilityResponse(
        is_accepting_leads=current_user.is_accepting_leads,
        daily_lead_limit=current_user.daily_lead_limit,
        leads_assigned_today=leads_today,
    )


@router.patch(
    "/availability",
    summary="Update My Lead Availability",
    response_description="Updated agent availability settings",
    response_model=AgentAvailabilityResponse,
)
def update_availability(
    body: AgentAvailabilityUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Toggle lead acceptance and/or set daily lead limit."""
    update_data: dict = {}

    if body.is_accepting_leads is not None:
        update_data["is_accepting_leads"] = body.is_accepting_leads

    if body.daily_lead_limit is not None:
        # 0 means unlimited — store as None
        update_data["daily_lead_limit"] = body.daily_lead_limit if body.daily_lead_limit > 0 else None

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No fields provided to update.",
        )

    with db_session as session:
        user = session.get(User, current_user.id)
        for key, value in update_data.items():
            setattr(user, key, value)
        session.commit()
        session.refresh(user)

        leads_today = _count_leads_today(session, user.id)

    status_label = "accepting" if user.is_accepting_leads else "paused"
    cap_label = f" (limit: {user.daily_lead_limit}/day)" if user.daily_lead_limit else ""

    return AgentAvailabilityResponse(
        is_accepting_leads=user.is_accepting_leads,
        daily_lead_limit=user.daily_lead_limit,
        leads_assigned_today=leads_today,
        message=f"Availability updated — {status_label}{cap_label}",
    )
