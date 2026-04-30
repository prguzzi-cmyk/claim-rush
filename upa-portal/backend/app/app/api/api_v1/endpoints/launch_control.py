#!/usr/bin/env python

"""Launch Control users aggregation endpoint.

`GET /v1/launch-control/users` — one read-only row per active CP / RVP /
Agent that an admin needs to evaluate "is this person actually deployed?".

Pure read. Does NOT change routing, rotation, Celery, outreach, or any
other behaviour. Joins existing data only:
  - User + Role
  - User.manager_id → User (upline)
  - UserTerritory + Territory (territories)
  - LeadRoutingSettings('all') (global routing mode)
  - LeadRotationSettings('all') (global rotation enabled + window)
  - IntakeConfig (personal landing slug + public_url) where the user is
    one of {assigned_cp_id, assigned_rvp_id, assigned_agent_id,
    default_assignee_id}
"""

from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import models
from app.api.deps import get_current_active_user, get_db_session
from app.api.deps.role import at_least_admin_user
from app.core.config import settings
from app.core.auth.enums import RoleEnum
from app.models.agent_profile import AgentProfile
from app.models.intake_config import IntakeConfig
from app.models.lead import Lead
from app.models.lead_rotation_settings import LeadRotationSettings
from app.models.lead_routing_settings import LeadRoutingSettings
from app.models.role import Role
from app.models.territory import Territory, UserTerritory
from app.models.user import User
from app.core.security import get_password_hash
from app.schemas.launch_control import (
    DeployResponse,
    EnrollRequest,
    EnrollResponse,
    EnrollTerritory,
    EnrollTerritoryEcho,
    LaunchControlUser,
    LaunchControlUserDetail,
    PortalLeadRow,
    TerritoryRef,
)

router = APIRouter()


# Roles surfaced in Launch Control. Lowercase canonical slugs; the matching
# query is case-insensitive so legacy uppercase Role.name rows resolve too.
_LAUNCH_ROLES = (RoleEnum.CP.value, RoleEnum.RVP.value, RoleEnum.AGENT.value)

# Admin-equivalent role slugs (case-insensitive match).
_ADMIN_ROLES = {RoleEnum.SUPER_ADMIN.value, RoleEnum.ADMIN.value}


def _is_admin_user(user: User | None) -> bool:
    if user is None or user.role is None:
        return False
    return (user.role.name or "").strip().lower() in _ADMIN_ROLES

# Readiness buckets.
_READY = "ready"
_MISSING = "missing_setup"
_BROKEN = "broken"

# Deployment status buckets layered on top of readiness.
_DEPLOY_BROKEN = "broken"
_DEPLOY_NOT_READY = "not_ready"
_DEPLOY_READY = "ready"
_DEPLOY_DEPLOYED = "deployed"


def _resolved_base(specific) -> str:
    """Return the per-purpose URL base if set, else fall back to SERVER_HOST.

    Lets a deployment split login/portal/intake across separate hostnames
    (e.g. app.yourdomain.com vs claim.yourdomain.com) without changing
    code. Single-domain deploys leave the per-purpose envs unset and
    everything resolves to SERVER_HOST as before.
    """
    chosen = specific if specific is not None else settings.SERVER_HOST
    return str(chosen).rstrip("/")


def _portal_url_for(user_id) -> str:
    """Admin-side preview URL for a deployed portal."""
    return f"{_resolved_base(settings.PORTAL_URL_BASE)}/app/portal/{user_id}"


def _deployment_status(readiness: str, portal_deployed_at) -> str:
    if readiness == _BROKEN:
        return _DEPLOY_BROKEN
    if readiness == _MISSING:
        return _DEPLOY_NOT_READY
    if portal_deployed_at is None:
        return _DEPLOY_READY
    return _DEPLOY_DEPLOYED


# ---------------------------------------------------------------------------
# Per-user assemblers
# ---------------------------------------------------------------------------

def _territories_for(db: Session, user_id) -> list[TerritoryRef]:
    rows = db.execute(
        select(UserTerritory, Territory)
        .join(Territory, Territory.id == UserTerritory.territory_id)
        .where(
            UserTerritory.user_id == user_id,
            UserTerritory.is_active == True,  # noqa: E712
            Territory.is_active == True,  # noqa: E712
        )
        .order_by(UserTerritory.priority.asc())
    ).all()
    return [
        TerritoryRef(
            territory_id=t.id,
            name=t.name,
            territory_type=t.territory_type,
            state=t.state,
            county=t.county,
            zip_code=t.zip_code,
            priority=ut.priority,
        )
        for ut, t in rows
    ]


def _intake_config_for(db: Session, user_id) -> IntakeConfig | None:
    """Return the most relevant active IntakeConfig where the user is named."""
    return db.scalars(
        select(IntakeConfig)
        .where(
            IntakeConfig.is_active == True,  # noqa: E712
            or_(
                IntakeConfig.assigned_cp_id == user_id,
                IntakeConfig.assigned_rvp_id == user_id,
                IntakeConfig.assigned_agent_id == user_id,
                IntakeConfig.default_assignee_id == user_id,
            ),
        )
        .order_by(IntakeConfig.created_at.desc())
        .limit(1)
    ).first()


def _login_url() -> str:
    return f"{_resolved_base(settings.LOGIN_URL_BASE)}/login"


def _public_intake_url(slug: str | None, intake_public_url: str | None) -> str | None:
    """Prefer an explicit public_url stamped on the IntakeConfig; otherwise
    compose `{INTAKE_URL_BASE or SERVER_HOST}/claim/{slug}` — matches the
    actual SPA route at /claim/:slug."""
    if intake_public_url:
        return intake_public_url
    if not slug:
        return None
    return f"{_resolved_base(settings.INTAKE_URL_BASE)}/claim/{slug}"


def _classify_readiness(
    *,
    user: User,
    role_slug: str,
    territories: list[TerritoryRef],
    intake: IntakeConfig | None,
    rotation_enabled: bool,
) -> tuple[str, list[str]]:
    """Decide ready / missing_setup / broken + the reasons list.

    Rules (intentionally conservative — broken means 'cannot function'):
      - broken: user is inactive, or has no role, or is not accepting leads
                (operational blocker for the rotation/routing engine).
      - missing_setup: active but lacking the role-appropriate setup —
                no territories assigned for any role; CPs additionally
                expected to have an intake config / personal landing.
      - ready: all of the above are satisfied.
    """
    issues: list[str] = []

    if not user.is_active:
        issues.append("user_inactive")
    if user.role is None:
        issues.append("no_role")
    if not user.is_accepting_leads:
        issues.append("not_accepting_leads")

    if issues:
        return _BROKEN, issues

    if not territories:
        issues.append("no_territories")
    if role_slug == "cp" and intake is None:
        # CPs are public-facing; missing landing slug is a setup gap.
        issues.append("no_intake_config")
    if not rotation_enabled:
        # Not blocking but worth surfacing on the row.
        issues.append("rotation_disabled_globally")

    if any(i in issues for i in ("no_territories", "no_intake_config")):
        return _MISSING, issues
    return _READY, issues


def _normalize_role_slug(role_name: str | None) -> str:
    """'CP' / 'cp' / 'Chapter President' all collapse to 'cp'. RVP / agent same."""
    n = (role_name or "").strip().lower()
    if n in ("cp", "chapter president", "chapter_president"):
        return "cp"
    if n in ("rvp", "regional vp", "regional vice president"):
        return "rvp"
    if n in ("agent", "adjuster"):
        return n
    return n or "unknown"


def _display_name(user: User) -> str:
    full = " ".join(p for p in (user.first_name, user.last_name) if p)
    return full.strip() or user.email


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[LaunchControlUser])
def list_launch_control_users(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    _admin: Annotated[None, Depends(at_least_admin_user())],
) -> Any:
    """One row per active CP / RVP / Agent with the readiness summary."""
    # 1. Global routing + rotation defaults (the 'all' rows).
    routing_all = db_session.scalars(
        select(LeadRoutingSettings).where(LeadRoutingSettings.lead_source == "all")
    ).first()
    rotation_all = db_session.scalars(
        select(LeadRotationSettings).where(LeadRotationSettings.lead_source == "all")
    ).first()

    routing_mode = routing_all.routing_mode if routing_all else None
    rotation_enabled = bool(rotation_all and rotation_all.is_active)
    rotation_window = rotation_all.inactivity_minutes if rotation_all else None

    # 2. Pull all candidate users in one query.
    user_rows = list(
        db_session.scalars(
            select(User)
            .join(Role, Role.id == User.role_id)
            .where(User.is_active == True)  # noqa: E712
        )
    )
    candidates = [u for u in user_rows if _normalize_role_slug(u.role.name if u.role else None) in _LAUNCH_ROLES]

    # 2b. Bulk-load agent_number for every candidate in one query so the
    # row builder can stamp it without per-user lookups.
    candidate_ids = [u.id for u in candidates]
    agent_number_by_user: dict[UUID, str] = {}
    if candidate_ids:
        for ap_user_id, ap_number in db_session.execute(
            select(AgentProfile.user_id, AgentProfile.agent_number).where(
                AgentProfile.user_id.in_(candidate_ids)
            )
        ).all():
            if ap_number:
                agent_number_by_user[ap_user_id] = ap_number

    # 3. Build per-user rows.
    out: list[LaunchControlUser] = []
    login_url = _login_url()
    for u in candidates:
        role_slug = _normalize_role_slug(u.role.name if u.role else None)
        territories = _territories_for(db_session, u.id)
        intake = _intake_config_for(db_session, u.id)
        upline = db_session.get(User, u.manager_id) if u.manager_id else None

        readiness, issues = _classify_readiness(
            user=u,
            role_slug=role_slug,
            territories=territories,
            intake=intake,
            rotation_enabled=rotation_enabled,
        )

        slug = intake.slug if intake else None
        intake_url = _public_intake_url(slug, intake.public_url if intake else None)

        deployed_at = u.portal_deployed_at
        deployment_status = _deployment_status(readiness, deployed_at)
        portal_url = _portal_url_for(u.id) if deployment_status == _DEPLOY_DEPLOYED else None

        agent_number = agent_number_by_user.get(u.id)
        upa_signed = bool(getattr(u, "upa_agreement_signed", False))
        aci_signed = bool(getattr(u, "aci_agreement_signed", False))
        is_activated = upa_signed and aci_signed and bool(agent_number)

        out.append(
            LaunchControlUser(
                user_id=u.id,
                name=_display_name(u),
                email=u.email,
                role=role_slug,
                role_display=(u.role.display_name if u.role else None),
                profile_image_url=u.profile_image_url,
                upline_user_id=upline.id if upline else None,
                upline_name=_display_name(upline) if upline else None,
                territories=territories,
                routing_mode=routing_mode,
                rotation_enabled=rotation_enabled,
                rotation_inactivity_minutes=rotation_window,
                portal_active=bool(u.is_active),
                login_url=login_url,
                personal_landing_slug=slug,
                personal_landing_url=intake_url,
                client_intake_url=intake_url,  # same URL today; could diverge later
                readiness=readiness,
                issues=issues,
                deployment_status=deployment_status,
                portal_deployed_at=deployed_at,
                portal_url=portal_url,
                upa_agreement_signed=upa_signed,
                aci_agreement_signed=aci_signed,
                agreement_signed_at=getattr(u, "agreement_signed_at", None),
                agent_number=agent_number,
                is_activated=is_activated,
            )
        )

    out.sort(key=lambda r: (r.role, r.name.lower()))
    return out


# ---------------------------------------------------------------------------
# Per-user view + deploy
# ---------------------------------------------------------------------------

def _agent_number_for(db_session: Session, user_id: UUID) -> str | None:
    return db_session.scalar(
        select(AgentProfile.agent_number).where(AgentProfile.user_id == user_id)
    )


def _build_user_row(
    db_session: Session,
    u: User,
    *,
    routing_mode: str | None,
    rotation_enabled: bool,
    rotation_window: int | None,
    login_url: str,
    agent_number: str | None = None,
) -> LaunchControlUser:
    """Per-user row builder used by both /users and /users/{id}."""
    role_slug = _normalize_role_slug(u.role.name if u.role else None)
    territories = _territories_for(db_session, u.id)
    intake = _intake_config_for(db_session, u.id)
    upline = db_session.get(User, u.manager_id) if u.manager_id else None
    readiness, issues = _classify_readiness(
        user=u,
        role_slug=role_slug,
        territories=territories,
        intake=intake,
        rotation_enabled=rotation_enabled,
    )
    slug = intake.slug if intake else None
    intake_url = _public_intake_url(slug, intake.public_url if intake else None)
    deployed_at = u.portal_deployed_at
    deployment_status = _deployment_status(readiness, deployed_at)
    portal_url = _portal_url_for(u.id) if deployment_status == _DEPLOY_DEPLOYED else None

    if agent_number is None:
        agent_number = _agent_number_for(db_session, u.id)

    upa_signed = bool(getattr(u, "upa_agreement_signed", False))
    aci_signed = bool(getattr(u, "aci_agreement_signed", False))
    is_activated = upa_signed and aci_signed and bool(agent_number)

    return LaunchControlUser(
        user_id=u.id,
        name=_display_name(u),
        email=u.email,
        role=role_slug,
        role_display=(u.role.display_name if u.role else None),
        profile_image_url=u.profile_image_url,
        upline_user_id=upline.id if upline else None,
        upline_name=_display_name(upline) if upline else None,
        territories=territories,
        routing_mode=routing_mode,
        rotation_enabled=rotation_enabled,
        rotation_inactivity_minutes=rotation_window,
        portal_active=bool(u.is_active),
        login_url=login_url,
        personal_landing_slug=slug,
        personal_landing_url=intake_url,
        client_intake_url=intake_url,
        readiness=readiness,
        issues=issues,
        deployment_status=deployment_status,
        portal_deployed_at=deployed_at,
        portal_url=portal_url,
        upa_agreement_signed=upa_signed,
        aci_agreement_signed=aci_signed,
        agreement_signed_at=getattr(u, "agreement_signed_at", None),
        agent_number=agent_number,
        is_activated=is_activated,
    )


def _recent_leads_for(db_session: Session, user_id: UUID, limit: int = 5) -> list[PortalLeadRow]:
    rows = list(
        db_session.scalars(
            select(Lead)
            .where(Lead.assigned_to == user_id)
            .order_by(Lead.assigned_at.desc().nullslast(), Lead.created_at.desc())
            .limit(limit)
        )
    )
    return [
        PortalLeadRow(
            lead_id=l.id,
            ref_number=l.ref_number,
            peril=l.peril,
            status=l.status,
            rotation_status=l.rotation_status,
            assigned_at=l.assigned_at,
            matched_level=l.matched_level,
            matched_value=l.matched_value,
        )
        for l in rows
    ]


def _total_leads_for(db_session: Session, user_id: UUID) -> int:
    from sqlalchemy import func as _f
    return int(
        db_session.scalar(
            select(_f.count(Lead.id)).where(Lead.assigned_to == user_id)
        )
        or 0
    )


@router.get("/users/{user_id}", response_model=LaunchControlUserDetail)
def get_launch_control_user(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    user_id: UUID,
) -> Any:
    """Per-user portal view: same row as the list, plus recent leads.

    Access policy: admin / super-admin can view any user's row; other
    authenticated users (CP / RVP / Agent / etc.) can view only their own.
    Anything else returns 403 so a deployed CP can sign in and reach
    `/app/portal/{their_user_id}` without elevated privileges.
    """
    if not _is_admin_user(current_user) and current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own portal.",
        )

    u = db_session.get(User, user_id)
    if u is None or not u.is_active:
        raise HTTPException(status_code=404, detail="User not found")

    routing_all = db_session.scalars(
        select(LeadRoutingSettings).where(LeadRoutingSettings.lead_source == "all")
    ).first()
    rotation_all = db_session.scalars(
        select(LeadRotationSettings).where(LeadRotationSettings.lead_source == "all")
    ).first()
    routing_mode = routing_all.routing_mode if routing_all else None
    rotation_enabled = bool(rotation_all and rotation_all.is_active)
    rotation_window = rotation_all.inactivity_minutes if rotation_all else None
    login_url = _login_url()

    base = _build_user_row(
        db_session, u,
        routing_mode=routing_mode,
        rotation_enabled=rotation_enabled,
        rotation_window=rotation_window,
        login_url=login_url,
    )
    detail = base.dict()
    detail["recent_leads"] = [r.dict() for r in _recent_leads_for(db_session, u.id)]
    detail["total_leads"] = _total_leads_for(db_session, u.id)
    return detail


@router.post("/users/{user_id}/deactivate")
def deactivate_user(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    _admin: Annotated[None, Depends(at_least_admin_user())],
    user_id: UUID,
) -> Any:
    """Soft-deactivate a Launch Control user.

    Used by the admin "Delete User" action. We deliberately do *not* call
    `crud.user.remove()` — that hard-flags is_removed and could cascade
    through audit/relationship paths in unexpected ways. Setting
    `is_active = False` and `is_accepting_leads = False` is enough to
    drop the user from /v1/launch-control/users (which filters
    is_active == True) and stop routing/rotation from picking them up,
    while every lead, claim, and territory assignment stays intact.

    Idempotent: re-running on an already-inactive user just returns the
    same shape and is a no-op.
    """
    u = db_session.get(User, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    if u.id == current_user.id:
        # An admin shouldn't lock themselves out by accident.
        raise HTTPException(status_code=400, detail="You cannot deactivate yourself.")

    u.is_active = False
    u.is_accepting_leads = False
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return {"user_id": str(u.id), "is_active": u.is_active, "status": "deactivated"}


@router.post("/users/{user_id}/deploy", response_model=DeployResponse)
def deploy_user_portal(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    _admin: Annotated[None, Depends(at_least_admin_user())],
    user_id: UUID,
) -> Any:
    """Stamp portal_deployed_at = now() if the user is currently 'ready' or
    already 'deployed' (idempotent re-deploy). Refuses if the user is broken
    or missing setup so the operator must finish setup first."""
    u = db_session.get(User, user_id)
    if u is None or not u.is_active:
        raise HTTPException(status_code=404, detail="User not found")

    routing_all = db_session.scalars(
        select(LeadRoutingSettings).where(LeadRoutingSettings.lead_source == "all")
    ).first()
    rotation_all = db_session.scalars(
        select(LeadRotationSettings).where(LeadRotationSettings.lead_source == "all")
    ).first()
    rotation_enabled = bool(rotation_all and rotation_all.is_active)

    role_slug = _normalize_role_slug(u.role.name if u.role else None)
    territories = _territories_for(db_session, u.id)
    intake = _intake_config_for(db_session, u.id)
    readiness, issues = _classify_readiness(
        user=u, role_slug=role_slug,
        territories=territories, intake=intake,
        rotation_enabled=rotation_enabled,
    )
    if readiness != _READY:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot deploy — user is '{readiness}'. Outstanding: {', '.join(issues) or 'none'}",
        )

    u.portal_deployed_at = datetime.now(timezone.utc)
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)

    intake_url = _public_intake_url(
        intake.slug if intake else None,
        intake.public_url if intake else None,
    )
    return DeployResponse(
        user_id=u.id,
        deployment_status=_DEPLOY_DEPLOYED,
        portal_deployed_at=u.portal_deployed_at,
        portal_url=_portal_url_for(u.id),
        login_url=_login_url(),
        intake_url=intake_url,
    )


# ---------------------------------------------------------------------------
# Enrollment — single-shot create User + Territory + IntakeConfig + deploy
# ---------------------------------------------------------------------------

def _split_full_name(full_name: str) -> tuple[str, str]:
    parts = (full_name or "").strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def _slugify(text: str) -> str:
    """Lowercase, hyphenated, alnum-only. 'Tim Clauss' → 'tim-clauss'."""
    import re
    s = (text or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "user"


def _ensure_unique_slug(db_session: Session, base: str, owner_user_id) -> str:
    """Return `base` if free or already owned by this user; else append -2, -3, ..."""
    from app.models.intake_config import IntakeConfig as _IC
    candidate = base
    n = 1
    while True:
        existing = db_session.scalars(
            select(_IC).where(_IC.slug == candidate)
        ).first()
        if existing is None:
            return candidate
        # Same user already owns this slug → reuse it (idempotent re-enroll).
        if existing.assigned_cp_id == owner_user_id or \
           existing.assigned_rvp_id == owner_user_id or \
           existing.assigned_agent_id == owner_user_id or \
           existing.default_assignee_id == owner_user_id:
            return candidate
        n += 1
        candidate = f"{base}-{n}"
        if n > 50:  # paranoia
            return f"{base}-{owner_user_id.hex[:6]}"


def _generate_password() -> str:
    """Strong random 12-char temp password — alnum + a couple of safe symbols."""
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(12))


def _validate_enroll_territory(t) -> dict:
    ttype = (t.territory_type or "").lower()
    state = (t.state or "").strip().upper()[:2] or None
    county = (t.county or "").strip() or None
    zip_code = (t.zip_code or "").strip()[:10] or None
    if ttype == "state" and not state:
        raise HTTPException(400, "state is required for territory_type='state'")
    if ttype == "county" and not (state and county):
        raise HTTPException(400, "state and county are required for territory_type='county'")
    if ttype == "zip" and not zip_code:
        raise HTTPException(400, "zip_code is required for territory_type='zip'")
    if ttype not in ("state", "county", "zip"):
        raise HTTPException(400, "territory_type must be one of: state, county, zip")
    return {"territory_type": ttype, "state": state, "county": county, "zip_code": zip_code}


def _territory_display_value(attrs: dict) -> str:
    """Pretty short label for a territory: 'PA' / 'PA · Bucks' / '18901'."""
    if attrs["zip_code"]:
        return attrs["zip_code"]
    if attrs["county"]:
        return f"{attrs['state']} · {attrs['county']}" if attrs["state"] else attrs["county"]
    return attrs["state"] or ""


def _normalize_enroll_territories(body: EnrollRequest) -> list[EnrollTerritory]:
    """Collapse the back-compat `territory` (singular) and `territories` (plural)
    into a single ordered list. Plural wins; if empty and singular is present,
    treat the singular as a 1-element list."""
    items: list[EnrollTerritory] = list(body.territories or [])
    if not items and body.territory is not None:
        items = [body.territory]
    if not items:
        raise HTTPException(400, "At least one territory is required")
    return items


def _find_or_create_role(db_session: Session, slug: str) -> Role:
    from sqlalchemy import func as _f
    r = db_session.scalars(
        select(Role).where(_f.lower(Role.name) == slug.lower())
    ).first()
    if r:
        return r
    r = Role(name=slug.lower(), display_name=slug.upper())
    db_session.add(r)
    db_session.commit()
    db_session.refresh(r)
    return r


def _find_or_create_enroll_territory(db_session: Session, attrs: dict) -> Territory:
    """Match an existing Territory by (type, state, county, zip) — else create."""
    stmt = select(Territory).where(Territory.territory_type == attrs["territory_type"])
    if attrs["state"]:
        stmt = stmt.where(Territory.state == attrs["state"])
    if attrs["county"]:
        stmt = stmt.where(Territory.county == attrs["county"])
    if attrs["zip_code"]:
        stmt = stmt.where(Territory.zip_code == attrs["zip_code"])
    existing = db_session.scalars(stmt).first()
    if existing:
        return existing
    name_parts = []
    if attrs["state"]: name_parts.append(attrs["state"])
    if attrs["county"]: name_parts.append(attrs["county"])
    if attrs["zip_code"]: name_parts.append(attrs["zip_code"])
    name = "-".join(name_parts) if name_parts else f"Territory-{attrs['territory_type']}"
    t = Territory(
        name=name,
        territory_type=attrs["territory_type"],
        state=attrs["state"],
        county=attrs["county"],
        zip_code=attrs["zip_code"],
        is_active=True,
        max_adjusters=3,
        lead_fire_enabled=True,
        lead_storm_enabled=True,
        lead_hail_enabled=True,
        lead_lightning_enabled=False,
        lead_flood_enabled=True,
        lead_theft_vandalism_enabled=True,
    )
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)
    return t


@router.post("/enroll", response_model=EnrollResponse)
def enroll_user(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    _admin: Annotated[None, Depends(at_least_admin_user())],
    body: EnrollRequest,
) -> Any:
    """One-shot CP / RVP / Agent enrollment.

    Idempotent: re-running with the same email updates the user in place
    (role / territory / intake / portal) instead of erroring. Returns the
    full set of URLs the operator needs to share with the new user.
    """
    role_slug = (body.role or "").strip().lower()
    if role_slug not in ("cp", "rvp", "agent"):
        raise HTTPException(400, "role must be one of: cp, rvp, agent")

    # 1. Territory inputs — supports a list of territories with back-compat for
    # the legacy single `territory` key. Each entry is validated independently.
    territory_inputs = _normalize_enroll_territories(body)
    attrs_list = [_validate_enroll_territory(t) for t in territory_inputs]
    primary_attrs = attrs_list[0]

    # 2. Role row (lowercase canonical) — created on the fly if missing.
    role = _find_or_create_role(db_session, role_slug)

    # 3. Manager (optional). Looked up by email; missing manager isn't fatal.
    manager: User | None = None
    if body.manager_email:
        manager = db_session.scalars(
            select(User).where(User.email == body.manager_email)
        ).first()

    # 4. Password — admin-supplied or generated.
    plaintext_password = body.password or _generate_password()
    hashed = get_password_hash(plaintext_password)

    first_name, last_name = _split_full_name(body.full_name)

    # 5. Upsert User by email.
    user = db_session.scalars(select(User).where(User.email == body.email)).first()
    if user is None:
        user = User(
            first_name=first_name or None,
            last_name=last_name or None,
            email=body.email,
            hashed_password=hashed,
            role_id=role.id,
            is_active=True,
            is_accepting_leads=True,
            national_access=False,
            manager_id=(manager.id if manager else None),
            parent_id=(manager.id if manager else None),
        )
        db_session.add(user)
    else:
        user.first_name = first_name or user.first_name
        user.last_name = last_name or user.last_name
        user.role_id = role.id
        user.is_active = True
        user.is_accepting_leads = True
        user.hashed_password = hashed
        if manager is not None:
            user.manager_id = manager.id
            user.parent_id = manager.id
    db_session.commit()
    db_session.refresh(user)

    # 6. Find or create Territory + UserTerritory for each requested territory.
    # Priority is assigned in input order (100, 110, 120, ...). The first
    # territory becomes the IntakeConfig anchor; the rest are pure
    # UserTerritory rows that participate in routing/coverage.
    created_territories: list[Territory] = []
    for idx, attrs in enumerate(attrs_list):
        terr = _find_or_create_enroll_territory(db_session, attrs)
        ut = db_session.scalars(
            select(UserTerritory).where(
                UserTerritory.user_id == user.id,
                UserTerritory.territory_id == terr.id,
            )
        ).first()
        if ut is None:
            ut = UserTerritory(
                user_id=user.id,
                territory_id=terr.id,
                priority=100 + (idx * 10),
                is_active=True,
            )
            db_session.add(ut)
        else:
            ut.is_active = True
            ut.priority = 100 + (idx * 10)
        created_territories.append(terr)
    db_session.commit()

    primary_territory = created_territories[0]

    # 7. Find or create IntakeConfig — slug derived from name; collision safe.
    # Anchored to the primary (first) territory; the IntakeConfig schema is
    # 1:1 with a single Territory, but the user's other territories still
    # contribute to routing via their UserTerritory rows.
    base_slug = _slugify(body.full_name)
    slug = _ensure_unique_slug(db_session, base_slug, user.id)
    cfg = db_session.scalars(
        select(IntakeConfig).where(IntakeConfig.slug == slug)
    ).first()
    if cfg is None:
        cfg = IntakeConfig(
            intake_name=f"{body.full_name.strip()} Intake",
            slug=slug,
            is_active=True,
            territory_id=primary_territory.id,
        )
        if role_slug == "cp":
            cfg.assigned_cp_id = user.id
        elif role_slug == "rvp":
            cfg.assigned_rvp_id = user.id
        elif role_slug == "agent":
            cfg.assigned_agent_id = user.id
        else:
            cfg.default_assignee_id = user.id
        db_session.add(cfg)
    else:
        cfg.is_active = True
        cfg.territory_id = primary_territory.id
        # Clear any other-role linkage and re-bind to this user's role.
        cfg.assigned_cp_id = user.id if role_slug == "cp" else None
        cfg.assigned_rvp_id = user.id if role_slug == "rvp" else None
        cfg.assigned_agent_id = user.id if role_slug == "agent" else None
    db_session.commit()
    db_session.refresh(cfg)

    # 8. Deploy — stamp portal_deployed_at.
    user.portal_deployed_at = datetime.now(timezone.utc)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # 8a. Auto-generate UPA + ACI agreements via the existing e-sign engine
    # and mark them sent. Best-effort: never block enrollment on a hiccup
    # in the agreement service. This step DOES NOT activate the user, DOES
    # NOT flip upa_agreement_signed / aci_agreement_signed (those flip in
    # complete_agreement once the partner actually signs), and DOES NOT
    # touch routing or eligibility.
    #
    # Source of truth for title + pdf is the agreement_template table:
    #   SELECT * FROM agreement_template
    #   WHERE  kind = <'upa'|'aci'> AND is_active = true
    # (one active row per kind, enforced upstream by the admin templates
    # endpoint). Falls back to a hardcoded title when no active template
    # is seeded so enroll never breaks on a fresh / mid-migration env.
    try:
        from app.models.agreement_template import AgreementTemplate as _AgreementTemplate
        from app.schemas.agreement import AgreementCreate as _AgreementCreate
        from app.services.agreement_service import AgreementService as _AgreementService

        _agr_svc = _AgreementService(db_session)
        for _kind, _fallback_title in (("upa", "UPA Agreement"), ("aci", "ACI Agreement")):
            _tpl = db_session.execute(
                select(_AgreementTemplate)
                .where(_AgreementTemplate.kind == _kind)
                .where(_AgreementTemplate.is_active.is_(True))
                .limit(1)
            ).scalar_one_or_none()

            _title = (_tpl.name if _tpl is not None else _fallback_title)
            _agr = _agr_svc.generate_agreement(
                _AgreementCreate(
                    agent_id=user.id,                     # the partner who signs for themselves
                    signer_name=_display_name(user),
                    signer_email=user.email,
                    title=_title,
                    source="onboarding",                  # discriminator vs lead retainers
                    signing_mode="standard",
                )
            )
            # Carry the template's PDF onto the agreement when present so
            # the signer renders the operator-uploaded document instead of
            # the placeholder body. No-op when no PDF is on the template.
            if _tpl is not None and _tpl.pdf_url:
                _agr_svc.upload_pdf(_agr.id, _tpl.pdf_url)
            _agr_svc.send_agreement(_agr.id)
    except Exception as _exc:
        # Don't fail the enroll on agreement-engine errors; the manual
        # agent_onboarding endpoints remain as the admin escape hatch.
        import logging as _logging
        _logging.getLogger(__name__).warning(
            "Auto-dispatch of UPA/ACI agreements for user %s failed: %s",
            user.id, _exc,
        )

    # 9. Build URLs.
    portal_url = _portal_url_for(user.id)
    intake_url = _public_intake_url(cfg.slug, cfg.public_url)
    login_url = _login_url()

    territory_echoes = [
        EnrollTerritoryEcho(
            territory_type=a["territory_type"],
            state=a["state"],
            county=a["county"],
            zip_code=a["zip_code"],
            value=_territory_display_value(a),
        )
        for a in attrs_list
    ]

    return EnrollResponse(
        user_id=user.id,
        name=_display_name(user),
        email=user.email,
        role=role_slug,
        role_display=role.display_name,
        upline_user_id=manager.id if manager else None,
        upline_name=_display_name(manager) if manager else None,
        territory_type=primary_attrs["territory_type"],
        territory_state=primary_attrs["state"],
        territory_county=primary_attrs["county"],
        territory_zip=primary_attrs["zip_code"],
        territories=territory_echoes,
        login_email=user.email,
        temporary_password=plaintext_password,
        login_url=login_url,
        portal_url=portal_url,
        intake_url=intake_url,
        intake_slug=cfg.slug,
        deployment_status=_DEPLOY_DEPLOYED,
    )
