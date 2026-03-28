#!/usr/bin/env python

"""Routes for the Dashboard reports."""

from datetime import date, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import DateRangeQueryParams, RepPeriodTypeQueryParam
from app.core.enums import ClaimPhases
from app.core.rbac import Modules
from app.models.communication_log import CommunicationLog
from app.models.lead_contact import LeadContact
from app.models.lead_outcome import LeadOutcome
from app.utils.app import DateRange

router = APIRouter()

permissions_lead = Permissions(Modules.LEAD.value)
permissions_claim = Permissions(Modules.CLAIM.value)
permissions_user = Permissions(Modules.USER.value)


@router.get(
    "/leads-count-by-status",
    summary="Leads Count By Status",
    response_description="Leads Count",
    response_model=list[schemas.LeadsByStatus],
    dependencies=[
        Depends(permissions_lead.read()),
    ],
)
def leads_count_by_status(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve Leads Count By Status."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    filters_stmt.append(models.Lead.created_at >= date_range["start_date"])
    filters_stmt.append(models.Lead.created_at <= date_range["end_date"])

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(models.Lead.assigned_to == current_user.id)

    # Get lead counts by status
    leads_count = crud.lead.group_by_status(
        db_session,
        filters=filters_stmt,
    )

    return leads_count


@router.get(
    "/leads-count-by-source",
    summary="Leads Count By Source",
    response_description="Leads Count",
    response_model=list[schemas.LeadsBySource],
    dependencies=[
        Depends(permissions_lead.read()),
    ],
)
def leads_count_by_source(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve Leads Count By Source."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    filters_stmt.append(models.Lead.created_at >= date_range["start_date"])
    filters_stmt.append(models.Lead.created_at <= date_range["end_date"])

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(models.Lead.assigned_to == current_user.id)

    # Get lead counts by source
    leads_count = crud.lead.group_by_source(
        db_session,
        filters=filters_stmt,
    )

    return leads_count


@router.get(
    "/leads-count-by-assigned-user",
    summary="Leads Count By Assigned User",
    response_description="Leads Count",
    response_model=list[schemas.LeadsByAssignedUser],
    dependencies=[
        Depends(permissions_lead.read()),
    ],
)
def leads_count_by_assigned_user(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve Leads Count By Assigned User."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    filters_stmt.append(models.Lead.created_at >= date_range["start_date"])
    filters_stmt.append(models.Lead.created_at <= date_range["end_date"])

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(models.Lead.assigned_to == current_user.id)

    # Get lead counts by status
    leads_count = crud.lead.group_by_assigned_user(
        db_session,
        filters=filters_stmt,
    )

    return leads_count


@router.get(
    "/claims-count-by-current-phase",
    summary="Claims Count By Current Phase",
    response_description="Claims Count",
    response_model=list[schemas.ClaimsByPhase],
    dependencies=[
        Depends(permissions_claim.read()),
    ],
)
def claims_count_by_current_phase(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve Claims Count By Current Phase."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    filters_stmt.append(models.Claim.created_at >= date_range["start_date"])
    filters_stmt.append(models.Claim.created_at <= date_range["end_date"])

    # Exclude claim-closed phase from the list
    filters_stmt.append(models.Claim.current_phase != ClaimPhases.CLAIM_CLOSED.value)

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(models.Claim.assigned_to == current_user.id)

    # Get claim counts by phase
    claims_count = crud.claim.group_by_phase(
        db_session,
        filters=filters_stmt,
    )

    return claims_count


@router.get(
    "/users-count-by-role",
    summary="Users Count By Role",
    response_description="Users Count",
    response_model=list[schemas.UsersByRole],
    dependencies=[
        Depends(permissions_user.read()),
    ],
)
def users_count_by_role(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve Users Count By Role."""

    # Apply filters
    filters_stmt = []

    # Get user counts by role
    users_count = crud.user.group_by_user_role(
        db_session,
        filters=filters_stmt,
    )

    return users_count


permissions_lead_outcome = Permissions(Modules.LEAD_OUTCOME.value)


@router.get(
    "/agent-performance",
    summary="Agent Performance Metrics",
    response_description="Agent performance data",
    response_model=list[schemas.AgentPerformanceMetrics],
    dependencies=[
        Depends(permissions_lead_outcome.read()),
    ],
)
def agent_performance(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    agent_id: UUID | None = Query(default=None, description="Filter by specific agent"),
    state: str | None = Query(default=None, description="Filter by lead contact state"),
    county: str | None = Query(default=None, description="Filter by lead contact city/county"),
) -> Any:
    """Retrieve per-agent performance metrics."""

    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    filters_stmt.append(models.Lead.created_at >= date_range["start_date"])
    filters_stmt.append(models.Lead.created_at <= date_range["end_date"])

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(models.Lead.assigned_to == current_user.id)
    elif agent_id:
        filters_stmt.append(models.Lead.assigned_to == agent_id)

    # Geographic filters via lead_contact join
    join_contact = False
    if state:
        filters_stmt.append(LeadContact.state_loss == state)
        join_contact = True
    if county:
        filters_stmt.append(LeadContact.city_loss == county)
        join_contact = True

    return crud.lead_outcome.get_agent_performance(
        db_session, filters=filters_stmt, join_contact=join_contact
    )


@router.get(
    "/lead-outcome-breakdown",
    summary="Lead Outcome Breakdown",
    response_description="Outcome counts for pie chart",
    response_model=list[schemas.OutcomeBreakdown],
    dependencies=[
        Depends(permissions_lead_outcome.read()),
    ],
)
def lead_outcome_breakdown(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    agent_id: UUID | None = Query(default=None, description="Filter by specific agent"),
    state: str | None = Query(default=None, description="Filter by lead contact state"),
    county: str | None = Query(default=None, description="Filter by lead contact city/county"),
) -> Any:
    """Retrieve lead outcome counts grouped by status for pie chart."""

    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    filters_stmt.append(LeadOutcome.created_at >= date_range["start_date"])
    filters_stmt.append(LeadOutcome.created_at <= date_range["end_date"])

    if agent_id:
        filters_stmt.append(LeadOutcome.recorded_by_id == agent_id)

    # Geographic filters via lead → lead_contact join
    join_contact = False
    if state:
        filters_stmt.append(LeadContact.state_loss == state)
        join_contact = True
    if county:
        filters_stmt.append(LeadContact.city_loss == county)
        join_contact = True

    return crud.lead_outcome.group_by_outcome_status(
        db_session, filters=filters_stmt, join_contact=join_contact
    )


@router.get(
    "/agent-outcome-breakdown",
    summary="Agent Outcome Percentage Breakdown",
    response_description="Per-agent outcome percentages for performance tracking",
    response_model=list[schemas.AgentOutcomeBreakdown],
    dependencies=[
        Depends(permissions_lead_outcome.read()),
    ],
)
def agent_outcome_breakdown(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    agent_id: UUID | None = Query(default=None, description="Filter by specific agent"),
    state: str | None = Query(default=None, description="Filter by lead contact state"),
    county: str | None = Query(default=None, description="Filter by lead contact city/county"),
) -> Any:
    """Retrieve per-agent outcome percentage breakdown for training & performance tracking."""

    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    filters_stmt.append(LeadOutcome.created_at >= date_range["start_date"])
    filters_stmt.append(LeadOutcome.created_at <= date_range["end_date"])

    if agent_id:
        filters_stmt.append(LeadOutcome.recorded_by_id == agent_id)

    # Geographic filters via lead → lead_contact join
    join_contact = False
    if state:
        filters_stmt.append(LeadContact.state_loss == state)
        join_contact = True
    if county:
        filters_stmt.append(LeadContact.city_loss == county)
        join_contact = True

    return crud.lead_outcome.get_agent_outcome_percentages(
        db_session, filters=filters_stmt, join_contact=join_contact
    )


permissions_comm = Permissions(Modules.COMMUNICATION_LOG.value)


@router.get(
    "/communication-metrics",
    summary="Communication Metrics",
    response_description="Aggregate email/SMS metrics",
    response_model=schemas.CommunicationMetrics,
    dependencies=[
        Depends(permissions_comm.read()),
    ],
)
def communication_metrics(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve aggregate communication metrics (sent, delivered, opened, clicked, etc.)."""

    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    filters_stmt.append(CommunicationLog.created_at >= date_range["start_date"])
    filters_stmt.append(CommunicationLog.created_at <= date_range["end_date"])

    return crud.communication_log.get_metrics(db_session, filters=filters_stmt)


# ── Fire Lead Rotation Dashboard ──

permissions_fire_lead = Permissions(Modules.LEAD.value)


@router.get(
    "/fire-lead-summary",
    summary="Fire Lead Summary",
    response_description="Fire lead auto-conversion summary",
    response_model=schemas.FireLeadSummary,
    dependencies=[
        Depends(permissions_fire_lead.read()),
    ],
)
def fire_lead_summary(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Fire lead auto-conversion summary: total incidents, converted, assigned, skipped."""
    if not crud.user.has_admin_privileges(current_user):
        return schemas.FireLeadSummary(
            total_incidents=0, auto_converted=0, assigned=0, unassigned=0, skip_reasons={},
        )

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    return crud.lead_distribution_history.get_fire_lead_summary(
        db_session,
        start_date=date_range["start_date"],
        end_date=date_range["end_date"],
    )


@router.get(
    "/fire-lead-agent-performance",
    summary="Fire Lead Agent Performance",
    response_description="Per-agent fire lead metrics",
    response_model=list[schemas.FireLeadAgentPerformance],
    dependencies=[
        Depends(permissions_fire_lead.read()),
    ],
)
def fire_lead_agent_performance(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Per-agent fire lead distribution performance: leads assigned, rotation position, last assigned."""
    if not crud.user.has_admin_privileges(current_user):
        return []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    return crud.lead_distribution_history.get_fire_agent_performance(
        db_session,
        start_date=date_range["start_date"],
        end_date=date_range["end_date"],
    )


@router.get(
    "/fire-lead-territory-breakdown",
    summary="Fire Lead Territory Breakdown",
    response_description="Per-territory fire lead counts",
    response_model=list[schemas.FireLeadTerritoryBreakdown],
    dependencies=[
        Depends(permissions_fire_lead.read()),
    ],
)
def fire_lead_territory_breakdown(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Per-territory fire lead breakdown: total leads, active agents."""
    if not crud.user.has_admin_privileges(current_user):
        return []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    return crud.lead_distribution_history.get_fire_territory_breakdown(
        db_session,
        start_date=date_range["start_date"],
        end_date=date_range["end_date"],
    )


@router.get(
    "/fire-lead-delivery-status",
    summary="Fire Lead Delivery Status",
    response_description="SMS/email delivery metrics for fire leads",
    response_model=schemas.FireLeadDeliveryStatus,
    dependencies=[
        Depends(permissions_fire_lead.read()),
    ],
)
def fire_lead_delivery_status(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """SMS and email delivery metrics for fire lead assignments."""
    if not crud.user.has_admin_privileges(current_user):
        return schemas.FireLeadDeliveryStatus(sms={}, email={})

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    return crud.lead_delivery_log.get_fire_delivery_metrics(
        db_session,
        start_date=date_range["start_date"],
        end_date=date_range["end_date"],
    )


@router.get(
    "/client-conversion-stats",
    summary="Client Conversion Stats",
    response_description="Client conversion KPI metrics",
    response_model=schemas.ClientConversionStats,
    dependencies=[
        Depends(permissions_lead.read()),
    ],
)
def client_conversion_stats(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve client conversion stats: signed today, this month, active claims, conversion rate."""

    today = date.today()
    start_of_day = datetime(today.year, today.month, today.day)
    start_of_month = datetime(today.year, today.month, 1)

    # Base lead filter
    lead_filters = [models.Lead.is_removed.is_(False)]
    if not crud.user.has_admin_privileges(current_user):
        lead_filters.append(models.Lead.assigned_to == current_user.id)

    # Signed today
    signed_today_q = (
        select(func.count())
        .select_from(models.Lead)
        .where(
            models.Lead.status == "signed",
            models.Lead.updated_at >= start_of_day,
            *lead_filters,
        )
    )
    signed_today = db_session.execute(signed_today_q).scalar() or 0

    # Signed this month
    signed_month_q = (
        select(func.count())
        .select_from(models.Lead)
        .where(
            models.Lead.status == "signed",
            models.Lead.updated_at >= start_of_month,
            *lead_filters,
        )
    )
    signed_this_month = db_session.execute(signed_month_q).scalar() or 0

    # Total active claims (not closed)
    claim_filters = [models.Claim.is_removed.is_(False)]
    if not crud.user.has_admin_privileges(current_user):
        claim_filters.append(models.Claim.assigned_to == current_user.id)

    active_claims_q = (
        select(func.count())
        .select_from(models.Claim)
        .where(
            models.Claim.current_phase != ClaimPhases.CLAIM_CLOSED.value,
            *claim_filters,
        )
    )
    total_active_claims = db_session.execute(active_claims_q).scalar() or 0

    # Conversion rate: signed leads / total leads
    total_leads_q = (
        select(func.count()).select_from(models.Lead).where(*lead_filters)
    )
    total_leads = db_session.execute(total_leads_q).scalar() or 0

    signed_total_q = (
        select(func.count())
        .select_from(models.Lead)
        .where(models.Lead.status == "signed", *lead_filters)
    )
    signed_total = db_session.execute(signed_total_q).scalar() or 0

    conversion_rate = round((signed_total / total_leads * 100), 1) if total_leads > 0 else 0.0

    return schemas.ClientConversionStats(
        signed_today=signed_today,
        signed_this_month=signed_this_month,
        total_active_claims=total_active_claims,
        conversion_rate=conversion_rate,
    )
