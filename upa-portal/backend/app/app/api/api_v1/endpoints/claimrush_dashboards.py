#!/usr/bin/env python

"""ClaimRush role-specific dashboard summary endpoints.

Returns the exact JSON shapes that `claim-rush/src/portal/Dashboard.jsx`
consumes for AgentDash, RVPDash, CPDash, and (future) AdjusterDash. All
endpoints are authenticated via `get_current_active_user`; JWT required.

Data strategy for this pass:
- Identity (user.name, user.email) → from current_user (real).
- Reporting chain + downline counts → walk `User.manager_id` (real).
- Territory / downline / primary_territory → real where resolvable, empty
  structure where not. Schema-complete in all cases so the frontend never
  crashes on a missing field.
- Financial / pipeline / claim counts → zero-safe scaffolds. Populating
  these from `commission_claim` / `commission_ledger` / `lead` tables is
  the next refinement; keeping the shape stable means the frontend renders
  "empty state" copy instead of 404.
- Attention items → computed from real empty-state signals (no territory,
  no team, etc.) rather than hardcoded.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.api.deps.user import get_current_active_user
from app.models import (
    CommissionClaim,
    CommissionLedger,
    Lead,
    Territory,
    User,
)

router = APIRouter()


# ─── Shared helpers ────────────────────────────────────────────────────────

def _display_name(u: User) -> str:
    """First + last, falling back to email when either part is missing."""
    parts = f"{u.first_name or ''} {u.last_name or ''}".strip()
    return parts or (u.email or "")


def _user_block(u: User) -> dict[str, str]:
    return {"name": _display_name(u), "email": u.email or ""}


def _role_name(u: User | None) -> str:
    """Lowercase role slug or empty string."""
    if not u or not u.role:
        return ""
    return (u.role.name or "").lower()


def _reporting_chain(user: User) -> tuple[dict | None, dict | None]:
    """Walk `manager_id` chain up to 5 levels looking for an RVP and a CP.

    Returns (rvp, cp) as `{"name": "..."} | None` dicts matching what the
    frontend destructures.
    """
    rvp: dict | None = None
    cp: dict | None = None
    cursor: User | None = user.manager if hasattr(user, "manager") else None
    depth = 0
    while cursor and depth < 5:
        role = _role_name(cursor)
        if role == "rvp" and rvp is None:
            rvp = {"name": _display_name(cursor)}
        elif role == "cp" and cp is None:
            cp = {"name": _display_name(cursor)}
            break  # CP is top of the chain we care about; stop walking
        cursor = cursor.manager if hasattr(cursor, "manager") else None
        depth += 1
    return rvp, cp


def _territory_scaffold() -> dict[str, Any]:
    """Empty territory shape — replace with real `Territory` query in a
    follow-up once the territory model's user-linkage fields are confirmed
    for the CP/RVP/agent case. Keeps schema stable for the frontend."""
    return {"primary_territory": {"name": None}, "territories": []}


def _empty_pipeline() -> list[dict[str, Any]]:
    """Scaffold pipeline — renders the frontend's EarningsRow cleanly with
    zero counts so the 'MY LEAD PIPELINE' panel isn't a blank block."""
    return [
        {"status": "NEW", "count": 0},
        {"status": "CONTACTED", "count": 0},
        {"status": "QUALIFIED", "count": 0},
        {"status": "CLOSED WON", "count": 0},
    ]


def _empty_state_attention(
    *,
    has_territory: bool,
    downline_count: int | None = None,
    is_leadership: bool = False,
) -> list[dict[str, str]]:
    """Real attention items derived from empty-state signals. Empty list →
    frontend renders 'Nothing needs attention right now.'"""
    items: list[dict[str, str]] = []
    if not has_territory:
        items.append({
            "severity": "warning",
            "text": "No territory assigned",
            "sub": "Contact your administrator to assign a territory.",
        })
    if is_leadership and downline_count == 0:
        items.append({
            "severity": "info",
            "text": "No team members assigned yet",
            "sub": "Your downline will appear here once agents report to you.",
        })
    return items


# ─── Agent ─────────────────────────────────────────────────────────────────

@router.get("/agent-summary")
def agent_summary(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> dict[str, Any]:
    """Summary for the logged-in Agent — matches AgentDash's destructure."""
    rvp, cp = _reporting_chain(current_user)
    territory = _territory_scaffold()
    return {
        "user": _user_block(current_user),
        "primary_territory": territory["primary_territory"],
        "territories": territory["territories"],
        "reporting_rvp": rvp,
        "reporting_cp": cp,
        "leads": {
            "total": 0,
            "pipeline": _empty_pipeline(),
        },
        "claims": {
            "total": 0,
            "mtd_count": 0,
            "mtd_revenue": 0,
            "by_phase": [],
        },
        "attention": _empty_state_attention(
            has_territory=bool(territory["territories"]),
        ),
    }


# ─── RVP ───────────────────────────────────────────────────────────────────

@router.get("/rvp-summary")
def rvp_summary(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> dict[str, Any]:
    """Summary for the logged-in RVP — matches RVPDash's destructure."""
    direct_reports = db_session.execute(
        select(User).where(User.manager_id == current_user.id)
    ).scalars().all()
    # RVP's direct reports are their Agents (by design). Non-agent reports
    # are tolerated silently — still counted in agents[] with their role
    # implied by the navigation.
    agents = [{"name": _display_name(u)} for u in direct_reports]

    _, cp = _reporting_chain(current_user)
    territory = _territory_scaffold()
    return {
        "user": _user_block(current_user),
        "primary_territory": territory["primary_territory"],
        "territories": territory["territories"],
        "reporting_cp": cp,
        "agent_count": len(agents),
        "agents": agents,
        "team_lead_total": 0,
        "own_book": {
            "total_leads": 0,
            "revenue_mtd": 0,
            "pipeline": _empty_pipeline(),
        },
        "attention": _empty_state_attention(
            has_territory=bool(territory["territories"]),
            downline_count=len(agents),
            is_leadership=True,
        ),
    }


# ─── CP ────────────────────────────────────────────────────────────────────

@router.get("/cp-summary")
def cp_summary(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> dict[str, Any]:
    """Summary for the logged-in Chapter President — matches CPDash.

    Real queries against: user (manager_id chain), territory
    (chapter_president_id), commission_ledger (CP-bucket MTD earnings),
    commission_claim (MTD settlements), lead (pipeline across downline).
    """
    # ── Downline (direct reports + agents under each RVP) ────────────
    direct_reports = db_session.execute(
        select(User).where(User.manager_id == current_user.id)
    ).scalars().all()

    rvp_ids = [u.id for u in direct_reports if _role_name(u) == "rvp"]
    rvp_count = len(rvp_ids)

    agent_rows: list[User] = [u for u in direct_reports if _role_name(u) == "agent"]
    if rvp_ids:
        sub_agents = db_session.execute(
            select(User).where(User.manager_id.in_(rvp_ids))
        ).scalars().all()
        agent_rows.extend(u for u in sub_agents if _role_name(u) == "agent")

    agent_count = len(agent_rows)
    agent_ids = [u.id for u in agent_rows]

    # ── Territory (CP is the chapter_president_id) ──────────────────
    territory_rows = db_session.execute(
        select(Territory).where(Territory.chapter_president_id == current_user.id)
    ).scalars().all()

    territories = [
        {"name": t.name, "state": t.state or ""}
        for t in territory_rows
    ]
    primary = {"name": territory_rows[0].name if territory_rows else None}

    # Growth gaps: per-territory capacity (max_adjusters) vs current agent count.
    # Simplified assignment: agents are attributed to the first territory until
    # UserTerritory linkage is populated — enough signal for the CP view.
    growth_gaps: list[dict[str, Any]] = []
    if territory_rows:
        per_territory = max(1, len(territory_rows))
        agents_per = agent_count // per_territory
        leftover = agent_count % per_territory
        for i, t in enumerate(territory_rows):
            assigned = agents_per + (1 if i < leftover else 0)
            needed = max(0, (t.max_adjusters or 0) - assigned)
            if needed > 0:
                growth_gaps.append({
                    "territory": t.name,
                    "current_agents": assigned,
                    "max_agents": t.max_adjusters,
                    "needed": needed,
                })

    # ── Revenue MTD — CP bucket COMMISSION_EARNED rows this month ───
    month_start = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    mtd_total_row = db_session.execute(
        select(func.coalesce(func.sum(CommissionLedger.amount), 0))
        .where(CommissionLedger.user_id == current_user.id)
        .where(CommissionLedger.bucket == "CP")
        .where(CommissionLedger.txn_type == "COMMISSION_EARNED")
        .where(CommissionLedger.ts >= month_start)
    ).scalar_one()
    mtd_total = float(mtd_total_row or Decimal(0))

    mtd_claim_count = db_session.execute(
        select(func.count(func.distinct(CommissionLedger.claim_id)))
        .where(CommissionLedger.user_id == current_user.id)
        .where(CommissionLedger.bucket == "CP")
        .where(CommissionLedger.txn_type == "COMMISSION_EARNED")
        .where(CommissionLedger.ts >= month_start)
        .where(CommissionLedger.claim_id.isnot(None))
    ).scalar_one() or 0

    # ── Lead pipeline — across the CP's agent downline ──────────────
    total_leads = 0
    pipeline_map: dict[str, int] = {}
    if agent_ids:
        rows = db_session.execute(
            select(Lead.status, func.count(Lead.id))
            .where(Lead.assigned_to.in_(agent_ids))
            .where(Lead.is_removed.is_(False))
            .group_by(Lead.status)
        ).all()
        for status, count in rows:
            pipeline_map[status] = int(count)
            total_leads += int(count)

    # Render pipeline as the fixed 4-column display with real counts merged in.
    # Any unmapped lead statuses roll into the closest label (keeps UI simple).
    status_label_map = {
        "new": "NEW",
        "callback": "CONTACTED",
        "interested": "CONTACTED",
        "pending-sign": "QUALIFIED",
        "signed": "QUALIFIED",
        "signed-approved": "CLOSED WON",
        "transfer": "CLOSED WON",
        "not-interested": "CLOSED LOST",
        "not-qualified": "CLOSED LOST",
    }
    rolled: dict[str, int] = {
        "NEW": 0, "CONTACTED": 0, "QUALIFIED": 0, "CLOSED WON": 0,
    }
    for status, count in pipeline_map.items():
        label = status_label_map.get(status, "CONTACTED")
        if label not in rolled:
            rolled[label] = 0
        rolled[label] += count
    lead_pipeline = [{"status": k, "count": v} for k, v in rolled.items()]

    return {
        "user": _user_block(current_user),
        "primary_territory": primary,
        "territories": territories,
        "downline": {"rvp_count": rvp_count, "agent_count": agent_count},
        "revenue": {"mtd_total": mtd_total, "mtd_claim_count": mtd_claim_count},
        "total_leads": total_leads,
        "lead_pipeline": lead_pipeline,
        "growth_gaps": growth_gaps,
        "attention": _empty_state_attention(
            has_territory=bool(territories),
            downline_count=agent_count,
            is_leadership=True,
        ),
    }


# ─── CP leads — scoped to the CP's downline agents ────────────────────────

@router.get("/cp-leads")
def cp_leads(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> list[dict[str, Any]]:
    """List all leads assigned to the agents in the CP's downline.

    Scope: walks User.manager_id down one level (RVPs under CP), then one
    more level (agents under each RVP), collects those agent user_ids, and
    returns every lead.assigned_to matching. Non-soft-deleted only.

    Shape is flat — one entry per lead — so the frontend can filter / sort
    client-side without additional round-trips. Peril is preserved for the
    Fire Leads / Water Leads filter chips.
    """
    # Walk downline to collect agent IDs.
    direct_reports = db_session.execute(
        select(User).where(User.manager_id == current_user.id)
    ).scalars().all()
    rvp_ids = [u.id for u in direct_reports if _role_name(u) == "rvp"]
    agent_rows: list[User] = [u for u in direct_reports if _role_name(u) == "agent"]
    if rvp_ids:
        agent_rows.extend(
            db_session.execute(
                select(User).where(User.manager_id.in_(rvp_ids))
            ).scalars().all()
        )
    agent_ids = [u.id for u in agent_rows]
    agent_name_by_id = {u.id: _display_name(u) for u in agent_rows}

    if not agent_ids:
        return []

    # Pull leads + sort newest first.
    rows = db_session.execute(
        select(Lead)
        .where(Lead.assigned_to.in_(agent_ids))
        .where(Lead.is_removed.is_(False))
        .order_by(Lead.created_at.desc())
    ).scalars().all()

    now = datetime.now(timezone.utc)
    out: list[dict[str, Any]] = []
    for lead in rows:
        created = lead.created_at or now
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        days_open = max(0, (now - created).days)
        out.append({
            "id": str(lead.id),
            "ref_number": lead.ref_number,
            "peril": lead.peril or "other",
            "status": lead.status or "new",
            "created_at": created.isoformat(),
            "days_open": days_open,
            "agent_id": str(lead.assigned_to) if lead.assigned_to else None,
            "agent_name": agent_name_by_id.get(lead.assigned_to, "Unassigned"),
            "insurance_company": lead.insurance_company,
            "policy_number": lead.policy_number,
            "claim_number": lead.claim_number,
            "loss_date": lead.loss_date.isoformat() if lead.loss_date else None,
        })
    return out


# ─── CP clients — claim-based client list scoped to CP's territory ────────

@router.get("/cp-clients")
def cp_clients(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> list[dict[str, Any]]:
    """List clients (via commission_claim records) in the CP's territory.

    Scope: every claim where the CP is either the authoritative CP
    (claim.cp_id = current_user.id) OR the writing agent sits in the
    CP's downline. Each claim represents one client relationship.

    The `client` table exists too but the live product centers
    client activity around claims (what stage, what fee, what agent,
    settled or not). Returning one row per claim gives the CP an
    actionable My Clients view without joining through lead.client_id.
    """
    # Downline agent ids (same walker as cp_summary / cp_leads)
    direct_reports = db_session.execute(
        select(User).where(User.manager_id == current_user.id)
    ).scalars().all()
    rvp_ids = [u.id for u in direct_reports if _role_name(u) == "rvp"]
    agent_rows: list[User] = [u for u in direct_reports if _role_name(u) == "agent"]
    if rvp_ids:
        agent_rows.extend(
            db_session.execute(
                select(User).where(User.manager_id.in_(rvp_ids))
            ).scalars().all()
        )
    agent_ids = [u.id for u in agent_rows]
    agent_name_by_id = {u.id: _display_name(u) for u in agent_rows}

    # Find claims: cp_id == current_user.id OR writing_agent in downline.
    from sqlalchemy import or_ as _or
    from app.models import CommissionClaim  # local import, already top-level

    conds = [CommissionClaim.cp_id == current_user.id]
    if agent_ids:
        conds.append(CommissionClaim.writing_agent_id.in_(agent_ids))
    rows = db_session.execute(
        select(CommissionClaim)
        .where(_or(*conds))
        .order_by(CommissionClaim.created_at.desc())
    ).scalars().all()

    out: list[dict[str, Any]] = []
    for c in rows:
        writing_agent_name = agent_name_by_id.get(c.writing_agent_id) or ""
        if not writing_agent_name and c.writing_agent_id:
            # Writing agent might sit outside the downline cache (edge case:
            # CP wrote the claim themselves, or RVP wrote it). Best-effort
            # one-shot lookup.
            wa = db_session.get(User, c.writing_agent_id)
            if wa:
                writing_agent_name = _display_name(wa)
        out.append({
            "claim_id": str(c.id),
            "claim_number": c.claim_number,
            "client_name": c.client_name,
            "claim_type": c.claim_type,
            "stage": c.stage,
            "gross_fee": float(c.gross_fee or 0),
            "carrier": c.carrier,
            "city": c.city,
            "state": c.state,
            "agent_id": str(c.writing_agent_id) if c.writing_agent_id else None,
            "agent_name": writing_agent_name,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "settled_at": c.settled_at.isoformat() if c.settled_at else None,
            "loss_date": c.loss_date.isoformat() if c.loss_date else None,
        })
    return out


# ─── CP commission — ledger rollup + per-claim breakdown ──────────────────

@router.get("/cp-commission")
def cp_commission(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> dict[str, Any]:
    """Commission view for the Chapter President.

    Returns:
      - override_earnings — CP bucket ledger totals MTD + YTD
      - territory_revenue — gross fees on claims (cp_id = current_user
        OR writing_agent in downline) settled in the period
      - settlements_mtd — per-claim breakdown of what settled this month
        with the CP override amount for that claim
      - recent_ledger — last 10 bucket=CP ledger rows for this user
    """
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── Downline for scoping territory-level claim revenue ──────────
    direct_reports = db_session.execute(
        select(User).where(User.manager_id == current_user.id)
    ).scalars().all()
    rvp_ids = [u.id for u in direct_reports if _role_name(u) == "rvp"]
    agent_rows: list[User] = [u for u in direct_reports if _role_name(u) == "agent"]
    if rvp_ids:
        agent_rows.extend(
            db_session.execute(
                select(User).where(User.manager_id.in_(rvp_ids))
            ).scalars().all()
        )
    agent_ids = [u.id for u in agent_rows]
    agent_name_by_id = {u.id: _display_name(u) for u in agent_rows}

    from sqlalchemy import or_ as _or

    # ── Override earnings (bucket=CP for the current user) ──────────
    def _sum_earned(period_start: datetime) -> tuple[float, int]:
        total = db_session.execute(
            select(func.coalesce(func.sum(CommissionLedger.amount), 0))
            .where(CommissionLedger.user_id == current_user.id)
            .where(CommissionLedger.bucket == "CP")
            .where(CommissionLedger.txn_type == "COMMISSION_EARNED")
            .where(CommissionLedger.ts >= period_start)
        ).scalar_one()
        count = db_session.execute(
            select(func.count(func.distinct(CommissionLedger.claim_id)))
            .where(CommissionLedger.user_id == current_user.id)
            .where(CommissionLedger.bucket == "CP")
            .where(CommissionLedger.txn_type == "COMMISSION_EARNED")
            .where(CommissionLedger.ts >= period_start)
            .where(CommissionLedger.claim_id.isnot(None))
        ).scalar_one() or 0
        return float(total or Decimal(0)), int(count)

    mtd_over, mtd_over_claims = _sum_earned(month_start)
    ytd_over, ytd_over_claims = _sum_earned(year_start)

    # ── Territory gross fee (cp_id match OR writing_agent in downline) ──
    claim_conds = [CommissionClaim.cp_id == current_user.id]
    if agent_ids:
        claim_conds.append(CommissionClaim.writing_agent_id.in_(agent_ids))
    in_territory = _or(*claim_conds)

    def _sum_territory(period_start: datetime) -> tuple[float, int]:
        total = db_session.execute(
            select(func.coalesce(func.sum(CommissionClaim.gross_fee), 0))
            .where(in_territory)
            .where(CommissionClaim.settled_at >= period_start)
        ).scalar_one()
        count = db_session.execute(
            select(func.count(CommissionClaim.id))
            .where(in_territory)
            .where(CommissionClaim.settled_at >= period_start)
        ).scalar_one() or 0
        return float(total or Decimal(0)), int(count)

    mtd_gross, mtd_settled = _sum_territory(month_start)
    ytd_gross, ytd_settled = _sum_territory(year_start)

    # ── Per-claim breakdown for settlements this month ──────────────
    settled_claims = db_session.execute(
        select(CommissionClaim)
        .where(in_territory)
        .where(CommissionClaim.settled_at >= month_start)
        .order_by(CommissionClaim.settled_at.desc())
    ).scalars().all()

    # CP override amount per claim this month — one query, group client-side
    cp_rows_this_month = db_session.execute(
        select(CommissionLedger.claim_id, CommissionLedger.amount)
        .where(CommissionLedger.user_id == current_user.id)
        .where(CommissionLedger.bucket == "CP")
        .where(CommissionLedger.txn_type == "COMMISSION_EARNED")
        .where(CommissionLedger.ts >= month_start)
        .where(CommissionLedger.claim_id.isnot(None))
    ).all()
    override_by_claim: dict[Any, float] = {}
    for claim_id, amount in cp_rows_this_month:
        override_by_claim[claim_id] = override_by_claim.get(claim_id, 0.0) + float(amount or Decimal(0))

    def _agent_name(uid) -> str:
        if uid is None:
            return ""
        if uid in agent_name_by_id:
            return agent_name_by_id[uid]
        u = db_session.get(User, uid)
        return _display_name(u) if u else ""

    settlements_mtd = [{
        "claim_id": str(c.id),
        "claim_number": c.claim_number,
        "client_name": c.client_name,
        "claim_type": c.claim_type,
        "gross_fee": float(c.gross_fee or 0),
        "cp_override_amount": float(override_by_claim.get(c.id, 0.0)),
        "agent_id": str(c.writing_agent_id) if c.writing_agent_id else None,
        "agent_name": _agent_name(c.writing_agent_id),
        "settled_at": c.settled_at.isoformat() if c.settled_at else None,
    } for c in settled_claims]

    # ── Recent ledger activity — last 10 bucket=CP rows ─────────────
    recent_rows = db_session.execute(
        select(CommissionLedger)
        .where(CommissionLedger.user_id == current_user.id)
        .where(CommissionLedger.bucket == "CP")
        .order_by(CommissionLedger.ts.desc())
        .limit(10)
    ).scalars().all()

    # Resolve claim_number + client_name for each ledger row (small set).
    claim_cache: dict[Any, CommissionClaim] = {}
    for r in recent_rows:
        if r.claim_id and r.claim_id not in claim_cache:
            cc = db_session.get(CommissionClaim, r.claim_id)
            if cc:
                claim_cache[r.claim_id] = cc

    recent_ledger = []
    for r in recent_rows:
        c = claim_cache.get(r.claim_id) if r.claim_id else None
        recent_ledger.append({
            "id": str(r.id),
            "occurred_at": r.ts.isoformat() if r.ts else None,
            "txn_type": r.txn_type,
            "amount": float(r.amount or 0),
            "notes": r.notes,
            "claim_id": str(r.claim_id) if r.claim_id else None,
            "claim_number": c.claim_number if c else None,
            "client_name": c.client_name if c else None,
        })

    return {
        "user": _user_block(current_user),
        "override_earnings": {
            "mtd_total": mtd_over,
            "mtd_claim_count": mtd_over_claims,
            "ytd_total": ytd_over,
            "ytd_claim_count": ytd_over_claims,
        },
        "territory_revenue": {
            "mtd_gross_fee": mtd_gross,
            "mtd_settled_count": mtd_settled,
            "ytd_gross_fee": ytd_gross,
            "ytd_settled_count": ytd_settled,
        },
        "settlements_mtd": settlements_mtd,
        "recent_ledger": recent_ledger,
    }


# ─── Adjuster ──────────────────────────────────────────────────────────────

@router.get("/adjuster-summary")
def adjuster_summary(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> dict[str, Any]:
    """Summary for the logged-in Adjuster.

    The AdjusterDash frontend component doesn't exist yet — this endpoint
    establishes the contract so the component can be built against a stable
    schema. KPIs mirror what the workspace will surface: active claims,
    pending estimates, settlements this month, supplement ratio.
    """
    return {
        "user": _user_block(current_user),
        "kpis": {
            "active_claims": 0,
            "pending_estimates": 0,
            "settlements_mtd": 0,
            "supplement_ratio": 0,
        },
        "claims": {
            "active": [],
            "by_status": [],
            "awaiting_carrier_review": 0,
            "supplements_pending": 0,
        },
        "recent_activity": [],
        "attention": [],
    }
