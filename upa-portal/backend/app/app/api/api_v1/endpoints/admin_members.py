#!/usr/bin/env python

"""Admin endpoints for the existing-member regularization onboarding flow.

Mounted at /v1/admin/members. Auth gated by `commission_auth` for
DEV_BYPASS parity with the rest of the operator cockpit; switch to
real RBAC when the cockpit-wide auth migration lands.

Flow:
  POST /v1/admin/members/invite — create a RIN user (status='pending_charter'),
                                  generate a UPASign agreement from the role's
                                  active template, fire an [INVITE EMAIL] log
                                  with the signing URL.
  GET  /v1/admin/members        — list all members with status + W-9 state.
  POST /v1/admin/members/{id}/resend-invite — re-fire the invite email.
  PATCH /v1/admin/members/{id}/mark-w9-received — admin manual W-9 override
                                                  (advances pending_w9 → active).

Charter sign → status flip happens in agreement_service via the
`_maybe_flip_to_pending_w9` hook on `complete_agreement`.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, status as http_status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.app import get_db_session
from app.api.deps.dev_bypass import commission_auth
from app.core.security import get_password_hash
from app.models.agent_profile import AgentProfile
from app.models.agreement import Agreement
from app.models.role import Role
from app.models.user import User


router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Schemas ─────────────────────────────────────────────────────────────


class InviteMemberRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=200)
    role: Literal["cp", "rvp", "agent"]
    territory_id: UUID | None = None


class InviteMemberResponse(BaseModel):
    user_id: str
    agreement_id: str
    signing_url: str
    status: str
    invite_email_logged: bool


class MemberRowDTO(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    status: str                                # pending_charter | pending_w9 | active
    charter_agreement_id: str | None = None
    charter_signed_at: datetime | None = None
    w9_uploaded: bool = False
    w9_file_id: str | None = None
    created_at: datetime


# ─── Helpers ─────────────────────────────────────────────────────────────


_TEMPLATE_TITLE_PREFIX = {
    "cp": "CP Charter Agreement",
    "rvp": "RVP Charter Agreement",
    "agent": "Agent Charter Agreement",
}


def _resolve_role_id(db: Session, role: str) -> UUID:
    """Map invite-payload role token → role_id. Uses the canonical
    UPPERCASE role names that the commission engine and B1 work with."""
    canonical = role.upper()
    row = db.execute(
        select(Role).where(Role.name == canonical)
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{role}' not found in role table — expected one of cp/rvp/agent",
        )
    return row.id


def _split_full_name(full_name: str) -> tuple[str, str]:
    """Cheap first/last split — operators can correct in admin later."""
    parts = full_name.strip().split(maxsplit=1)
    first = parts[0] if parts else "Member"
    last = parts[1] if len(parts) > 1 else ""
    return first, last


def _build_signing_url(agreement_id: UUID) -> str:
    """Public signing URL the recipient gets in their invite email.
    Production should override via settings; dev hard-codes the local
    Angular signing route."""
    return f"http://localhost:4200/sign/{agreement_id}"


def _create_charter_agreement(
    db: Session, *, user: User, role: str, full_name: str,
) -> Agreement:
    """Create a charter agreement in 'sent' state, agent_id = the new
    user, title prefixed for charter detection in agreement_service.
    The actual template body / PDF lookup is wired in R2 — for R1 the
    agreement is a thin shell with the role-prefixed title."""
    title_prefix = _TEMPLATE_TITLE_PREFIX[role]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    title = f"{title_prefix} — {full_name} ({today})"

    agr = Agreement(
        agent_id=user.id,
        signer_name=full_name,
        signer_email=user.email,
        title=title,
        source="system",
        status="sent",
        signing_mode="standard",
        sent_at=datetime.now(timezone.utc),
    )
    db.add(agr)
    db.flush()
    return agr


def _log_invite_email(*, full_name: str, email: str, role: str, signing_url: str) -> None:
    """Stub email — real SMTP / Resend wiring is out of scope. Mirrors
    UPASign's existing `[EMAIL]` log convention so the operator has a
    visible signal in the backend logs."""
    logger.info(
        "[INVITE EMAIL] To: %s <%s>  Role: %s\n"
        "  Welcome to the ACI portal. Please review and sign your charter:\n"
        "  %s",
        full_name, email, role, signing_url,
    )


# ─── Endpoints ───────────────────────────────────────────────────────────


@router.post("/invite", response_model=InviteMemberResponse, status_code=http_status.HTTP_201_CREATED)
def invite_member(
    payload: InviteMemberRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Provision a new RIN user in pending_charter state and fire a
    UPASign charter agreement. Returns the signing URL the operator can
    share if the email log isn't visible to the invitee yet."""
    # Reject duplicate emails up front (case-insensitive).
    from sqlalchemy import func as sa_func
    existing = db_session.execute(
        select(User).where(sa_func.lower(User.email) == payload.email.lower())
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"A user with email {payload.email} already exists",
        )

    role_id = _resolve_role_id(db_session, payload.role)
    first, last = _split_full_name(payload.full_name)

    # Random password — invitee resets on first portal access.
    user = User(
        first_name=first,
        last_name=last,
        email=payload.email,
        hashed_password=get_password_hash(secrets.token_urlsafe(24)),
        role_id=role_id,
        is_active=True,
        status="pending_charter",
    )
    db_session.add(user)
    db_session.flush()

    agr = _create_charter_agreement(
        db_session, user=user, role=payload.role, full_name=payload.full_name,
    )
    db_session.commit()
    db_session.refresh(agr)
    db_session.refresh(user)

    signing_url = _build_signing_url(agr.id)
    _log_invite_email(
        full_name=payload.full_name,
        email=payload.email,
        role=payload.role,
        signing_url=signing_url,
    )

    return InviteMemberResponse(
        user_id=str(user.id),
        agreement_id=str(agr.id),
        signing_url=signing_url,
        status=user.status,
        invite_email_logged=True,
    )


@router.get("", response_model=list[MemberRowDTO])
def list_members(
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """All members the regularization flow tracks. Includes their
    onboarding status, latest charter agreement (if any), and W-9 file
    state pulled from agent_profile."""
    users = db_session.execute(
        select(User).where(User.status.in_(("pending_charter", "pending_w9", "active")))
    ).scalars().all()

    out: list[dict] = []
    for u in users:
        role = db_session.get(Role, u.role_id) if u.role_id else None
        # Latest charter for this user (any state).
        latest_charter = db_session.execute(
            select(Agreement)
            .where(Agreement.agent_id == u.id)
            .where(Agreement.title.like("%Charter Agreement%"))
            .order_by(Agreement.created_at.desc())
        ).scalars().first()
        # W-9 from agent_profile.
        profile = db_session.execute(
            select(AgentProfile).where(AgentProfile.user_id == u.id)
        ).scalar_one_or_none()
        w9_id = profile.w9_file_id if profile else None

        out.append(
            MemberRowDTO(
                user_id=str(u.id),
                full_name=f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
                email=u.email,
                role=(role.name if role else "").lower(),
                status=u.status,
                charter_agreement_id=str(latest_charter.id) if latest_charter else None,
                charter_signed_at=latest_charter.signed_at if latest_charter else None,
                w9_uploaded=w9_id is not None,
                w9_file_id=str(w9_id) if w9_id else None,
                created_at=u.created_at,
            )
        )
    return out


@router.post("/{user_id}/resend-invite")
def resend_invite(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Re-fire the invite email for a member still pending_charter.
    Reuses the latest open charter agreement; doesn't create a new one."""
    user = db_session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    if user.status != "pending_charter":
        raise HTTPException(
            status_code=400,
            detail=f"User is in '{user.status}' state — only pending_charter members get re-invited",
        )

    agr = db_session.execute(
        select(Agreement)
        .where(Agreement.agent_id == user.id)
        .where(Agreement.title.like("%Charter Agreement%"))
        .order_by(Agreement.created_at.desc())
    ).scalars().first()
    if agr is None:
        raise HTTPException(status_code=404, detail="No charter agreement on file for this user")

    signing_url = _build_signing_url(agr.id)
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email
    role = db_session.get(Role, user.role_id) if user.role_id else None
    role_name = (role.name if role else "").lower()
    _log_invite_email(
        full_name=full_name,
        email=user.email,
        role=role_name,
        signing_url=signing_url,
    )
    return {"resent": True, "agreement_id": str(agr.id), "signing_url": signing_url}


@router.patch("/{user_id}/mark-w9-received")
def mark_w9_received(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Admin manual override: confirm a W-9 was received via some
    out-of-band channel. Advances pending_w9 → active without requiring
    an actual file upload. (Used by R3.)"""
    user = db_session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    if user.status != "pending_w9":
        raise HTTPException(
            status_code=400,
            detail=f"User is in '{user.status}' state — mark-w9-received only valid for pending_w9",
        )
    user.status = "active"
    db_session.add(user)
    db_session.commit()
    return {"user_id": str(user.id), "status": user.status}
