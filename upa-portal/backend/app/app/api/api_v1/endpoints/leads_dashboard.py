#!/usr/bin/env python

"""Read-only dashboard counts and rows for the Leads overview page.

Two endpoints:
- `GET /v1/leads-dashboard`        : total + 5 KPI tile counts
- `GET /v1/leads-dashboard/rows`   : paged lead rows with assignee name

Both accept an admin-only `watch` query parameter for Pete's Master Watch
+ Home Office Queue views (Stage 5):
- `watch=master`     : every non-removed lead (no role-scope filter)
- `watch=home_office`: only leads owned by the RIN Home Office system user
- omitted / empty    : default visibility — admins see all, non-admins
                       see only `assigned_to == current_user.id`

Non-admins requesting `watch=master` or `watch=home_office` get 403.
"""
from datetime import datetime
from enum import Enum
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps import get_current_active_user, get_db_session
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.user import User

router = APIRouter()

# Mirrors the constant in fire_lead_rotation_service.py. Kept as a
# string literal here to avoid importing the rotation service at HTTP
# request time.
_HOME_OFFICE_USER_ID = "00000000-0000-0000-0000-000000000001"


class WatchMode(str, Enum):
    """Admin-only override for the dashboard's visibility scope."""

    none = ""
    master = "master"
    home_office = "home_office"


# ── Tile bucket -> DB status mapping (Stage 4, locked policy) ──────────
# Anything not listed below is excluded from the 5 tile counts but still
# included in `total`. The fire-workflow statuses (skip-trace-pending,
# text-sent, responded-yes, awaiting-call, converted, closed) live on the
# Response Desk, not on the main Leads dashboard.
#
# NEW currently has zero rows in production — no code path writes
# status="new". Reserved for a future rotation-engine change; kept here
# so the tile binding stays in place when that lands.
_NEW_STATUSES = ("new",)
_CONTACTED_STATUSES = ("callback", "transfer", "interested")
_APPOINTMENT_STATUSES = ("pending-sign",)
_SIGNED_STATUSES = ("signed", "signed-approved")
_LOST_STATUSES = ("not-interested", "not-qualified")


class LeadsDashboardCounts(BaseModel):
    """Response model for the leads dashboard counts endpoint."""

    total: int
    new: int
    contacted: int
    appointments: int
    signed: int
    lost: int


class LeadsDashboardRow(BaseModel):
    """One row in the dashboard table — joined lead + assignee + state."""

    id: UUID
    ref_number: int | None
    status: str | None
    state: str | None
    assigned_to_id: UUID | None
    assigned_to_name: str | None
    full_name: str | None
    address_loss: str | None
    created_at: datetime


def _bucket_sum(values: tuple[str, ...]):
    """Build a `SUM(CASE WHEN status IN (...) THEN 1 ELSE 0 END)` expression
    that's safe to wrap in COALESCE for an empty result set."""
    return func.coalesce(
        func.sum(case((Lead.status.in_(values), 1), else_=0)),
        0,
    )


def _apply_watch_scope(stmt, watch: WatchMode, current_user: models.User):
    """Apply the `watch` parameter or fall back to default role-scoping.

    Raises 403 if a non-admin requests a watch override. Returns the
    statement with the appropriate WHERE filter applied.
    """
    is_admin = crud.user.has_admin_privileges(current_user)
    if watch != WatchMode.none and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="watch mode requires admin privileges",
        )
    if watch == WatchMode.master:
        return stmt  # no extra filter — admin sees everything
    if watch == WatchMode.home_office:
        return stmt.where(Lead.assigned_to == _HOME_OFFICE_USER_ID)
    if not is_admin:
        return stmt.where(Lead.assigned_to == current_user.id)
    return stmt  # admin default — sees everything


def _display_name(user: User | None) -> str | None:
    if user is None:
        return None
    full = " ".join(p for p in (user.first_name, user.last_name) if p).strip()
    return full or user.email


@router.get("", response_model=LeadsDashboardCounts)
def leads_dashboard_counts(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    watch: WatchMode = Query(
        WatchMode.none,
        description="Admin-only override: 'master' (all leads) or 'home_office' (RIN Home Office only).",
    ),
) -> LeadsDashboardCounts:
    """Return total + 5 tile counts in a single aggregation query.

    All counts come from the `lead` table. Soft-deleted rows are
    excluded. Visibility scope is determined by `watch` + role —
    see `_apply_watch_scope`.
    """
    stmt = (
        select(
            func.count().label("total"),
            _bucket_sum(_NEW_STATUSES).label("new_"),
            _bucket_sum(_CONTACTED_STATUSES).label("contacted"),
            _bucket_sum(_APPOINTMENT_STATUSES).label("appointments"),
            _bucket_sum(_SIGNED_STATUSES).label("signed"),
            _bucket_sum(_LOST_STATUSES).label("lost"),
        )
        .where(Lead.is_removed.is_(False))
    )
    stmt = _apply_watch_scope(stmt, watch, current_user)

    row = db_session.execute(stmt).one()

    return LeadsDashboardCounts(
        total=row.total,
        new=row.new_,
        contacted=row.contacted,
        appointments=row.appointments,
        signed=row.signed,
        lost=row.lost,
    )


@router.get("/rows", response_model=list[LeadsDashboardRow])
def leads_dashboard_rows(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    watch: WatchMode = Query(
        WatchMode.none,
        description="Admin-only override: 'master' (all leads) or 'home_office' (RIN Home Office only).",
    ),
    limit: int = Query(500, ge=1, le=500),
) -> list[LeadsDashboardRow]:
    """Return paged lead rows joined to assignee + primary contact.

    Newest first. Non-removed only. Same visibility rules as the counts
    endpoint. The Master Watch view exposes assignee identity directly
    (Pete sees who owns what); the Home Office Queue view filters to
    leads owned by the RIN Home Office system user, surfacing
    state-level coverage gaps.
    """
    stmt = (
        select(Lead, User, LeadContact)
        .join(User, User.id == Lead.assigned_to, isouter=True)
        .join(LeadContact, LeadContact.lead_id == Lead.id, isouter=True)
        .where(Lead.is_removed.is_(False))
        .order_by(Lead.created_at.desc())
        .limit(limit)
    )
    stmt = _apply_watch_scope(stmt, watch, current_user)

    rows = db_session.execute(stmt).all()
    return [
        LeadsDashboardRow(
            id=lead.id,
            ref_number=lead.ref_number,
            status=lead.status,
            state=(contact.state_loss if contact is not None else None),
            assigned_to_id=lead.assigned_to,
            assigned_to_name=_display_name(user),
            full_name=(contact.full_name if contact is not None else None),
            address_loss=(contact.address_loss if contact is not None else None),
            created_at=lead.created_at,
        )
        for lead, user, contact in rows
    ]
