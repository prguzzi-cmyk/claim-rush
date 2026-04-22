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

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile, status as http_status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.app import get_db_session
from app.api.deps.dev_bypass import commission_auth
from app.core.security import get_password_hash
from app.models.agent_profile import AgentProfile
from app.models.agreement import Agreement
from app.models.agreement_template import AgreementTemplate
from app.models.role import Role
from app.models.user import User
from app.utils.s3 import S3


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

    R2: looks up the role's active AgreementTemplate. If a PDF has been
    uploaded for that template (template.pdf_url set), the agreement's
    original_pdf_url points at it; otherwise the signer renders the
    template.body (placeholder text with the DRAFT banner)."""
    title_prefix = _TEMPLATE_TITLE_PREFIX[role]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    title = f"{title_prefix} — {full_name} ({today})"

    template = db.execute(
        select(AgreementTemplate)
        .where(AgreementTemplate.role == role)
        .where(AgreementTemplate.is_active.is_(True))
    ).scalar_one_or_none()

    agr = Agreement(
        agent_id=user.id,
        signer_name=full_name,
        signer_email=user.email,
        title=title,
        source="system",
        status="sent",
        signing_mode="standard",
        sent_at=datetime.now(timezone.utc),
        original_pdf_url=template.pdf_url if template else None,
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


# ─── W-9 + status (R3) ───────────────────────────────────────────────────


class MemberStatusDTO(BaseModel):
    user_id: str
    status: str
    full_name: str
    w9_uploaded: bool


@router.get("/{user_id}/status", response_model=MemberStatusDTO)
def get_member_status(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Lightweight status lookup used by the portal banner. Returns
    the current onboarding status + W-9 state — banner shows when
    status='pending_w9'."""
    user = db_session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    profile = db_session.execute(
        select(AgentProfile).where(AgentProfile.user_id == user.id)
    ).scalar_one_or_none()
    return MemberStatusDTO(
        user_id=str(user.id),
        status=user.status,
        full_name=f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
        w9_uploaded=(profile is not None and profile.w9_file_id is not None),
    )


@router.post("/{user_id}/w9")
async def upload_w9(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
    file: UploadFile = File(...),
):
    """Upload the member's W-9 PDF. Stores the file via the existing S3
    helper, creates a UserPersonalFile row tagged 'W-9', points
    agent_profile.w9_file_id at it, and flips user.status from
    pending_w9 → active.

    Uses UserPersonalFile (joined-inheritance subclass of File) — File
    itself has a polymorphic discriminator on `related_type` and only
    accepts known identities. UserPersonalFile is the registered
    identity for member-personal documents like W-9 / non-compete /
    license scans.

    Auto-creates a minimal agent_profile row if none exists yet (some
    legacy users may not have one)."""
    from io import BytesIO
    from app.models.user_personal_file import UserPersonalFile

    user = db_session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await file.read()
    file_key = f"agent-w9/{user.id}/{file.filename}"
    S3.upload_file_obj(BytesIO(contents), file_key, content_type="application/pdf")

    file_row = UserPersonalFile(
        name=file.filename,
        type="application/pdf",
        size=len(contents),
        path=file_key,
        visibility="private",
        state="W-9",
        expiration_date="",  # NOT NULL on the legacy schema; W-9s don't expire here
        owner_id=user.id,
    )
    db_session.add(file_row)
    db_session.flush()

    profile = db_session.execute(
        select(AgentProfile).where(AgentProfile.user_id == user.id)
    ).scalar_one_or_none()
    if profile is None:
        # Generate an agent_number on the fly via the agent_service
        # convention (used by B1's create-with-user endpoint).
        from app.services.agent_service import agent_service
        role = db_session.get(Role, user.role_id) if user.role_id else None
        agent_number = agent_service._generate_agent_number(db_session, role.name if role else None)
        profile = AgentProfile(
            user_id=user.id,
            agent_number=agent_number,
            w9_file_id=file_row.id,
        )
        db_session.add(profile)
    else:
        profile.w9_file_id = file_row.id
        db_session.add(profile)

    if user.status == "pending_w9":
        user.status = "active"
        db_session.add(user)

    db_session.commit()
    return {
        "user_id": str(user.id),
        "status": user.status,
        "w9_file_id": str(file_row.id),
        "file_key": file_key,
    }


# ─── Templates (R2) ───────────────────────────────────────────────────────


class TemplateRowDTO(BaseModel):
    id: str
    role: str
    name: str
    body: str
    pdf_url: str | None = None
    is_active: bool


@router.get("/templates", response_model=list[TemplateRowDTO])
def list_templates(
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """All charter templates (active + inactive). The invite endpoint
    only reads is_active=True rows."""
    rows = db_session.execute(
        select(AgreementTemplate).order_by(AgreementTemplate.role, AgreementTemplate.created_at.desc())
    ).scalars().all()
    return [
        TemplateRowDTO(
            id=str(t.id),
            role=t.role,
            name=t.name,
            body=t.body,
            pdf_url=t.pdf_url,
            is_active=t.is_active,
        )
        for t in rows
    ]


@router.post("/templates/{template_id}/upload-pdf", response_model=TemplateRowDTO)
async def upload_template_pdf(
    template_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
    file: UploadFile = File(...),
):
    """Upload a real charter PDF to replace the seeded placeholder body.
    Existing active template for the same role is deactivated; the
    uploaded one becomes the new active template (so future invites pick
    it up). Body text is preserved on the previous row for audit."""
    template = db_session.get(AgreementTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Storage key: agreement-templates/{role}/{template_id}/{filename}.
    # Uses the existing UPASign S3 helper — falls back to local FS at
    # /app/media/ if S3 credentials aren't configured.
    from io import BytesIO
    file_key = f"agreement-templates/{template.role}/{template.id}/{file.filename}"
    contents = await file.read()
    S3.upload_file_obj(BytesIO(contents), file_key, content_type="application/pdf")
    pdf_url = file_key  # callers resolve to full S3 URL via settings.S3_BUCKET_NAME

    # Deactivate any other active template for this role, then mark this
    # one active with the new PDF URL.
    db_session.execute(
        select(AgreementTemplate)
        .where(AgreementTemplate.role == template.role)
        .where(AgreementTemplate.is_active.is_(True))
        .where(AgreementTemplate.id != template.id)
    ).scalars().all()  # warm-fetch for cascade
    db_session.execute(
        AgreementTemplate.__table__.update()
        .where(AgreementTemplate.role == template.role)
        .where(AgreementTemplate.id != template.id)
        .values(is_active=False)
    )
    template.pdf_url = pdf_url
    template.is_active = True
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    return TemplateRowDTO(
        id=str(template.id),
        role=template.role,
        name=template.name,
        body=template.body,
        pdf_url=template.pdf_url,
        is_active=template.is_active,
    )
