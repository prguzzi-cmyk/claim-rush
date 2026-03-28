#!/usr/bin/env python

"""Magic Link Routes"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.core import security
from app.core.brute_force import record_login_attempt
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.magic_link_token import MagicLinkToken
from app.utils.common import read_file
from app.utils.emails import get_project_context, send_email
from app.utils.jinja import render_template, render_text

router = APIRouter()


def _send_magic_link_email(to: str, token: str) -> None:
    """Send a magic link email to the user."""
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Sign in link"
    link = f"{settings.WEBAUTHN_ORIGIN}/#/auth/magic-link?token={token}"
    context = {
        **get_project_context(email_tagline="Sign In Link"),
        "link": link,
        "valid_minutes": settings.MAGIC_LINK_EXPIRE_MINUTES,
        "email": to,
    }
    body_html = render_template(template="magic_link.html", context=context)
    body_plain = render_text(read_file("magic_link.txt"), context=context)
    send_email(to=to, subject=subject, body_html=body_html, body_plain=body_plain)


@router.post("/request")
@limiter.limit("5/minute")
def request_magic_link(
    request: Request,
    background_tasks: BackgroundTasks,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    body: schemas.MagicLinkRequest,
) -> Any:
    """
    Request a magic link. Always returns success to prevent email enumeration.
    """
    # Always return the same response regardless of user existence
    user = crud.user.get_by_email(db_session, email=body.email)

    if user and user.is_active and settings.EMAILS_ENABLED:
        # Generate a secure random token
        raw_token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        # Store the hashed token
        magic_link = MagicLinkToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow()
            + timedelta(minutes=settings.MAGIC_LINK_EXPIRE_MINUTES),
            used=False,
        )
        db_session.add(magic_link)
        db_session.commit()

        # Send email in background
        background_tasks.add_task(_send_magic_link_email, to=user.email, token=raw_token)

    return {"msg": "If an account with that email exists, a sign-in link has been sent."}


@router.post("/verify", response_model=schemas.Token)
@limiter.limit("10/minute")
def verify_magic_link(
    request: Request,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    body: schemas.MagicLinkVerify,
) -> Any:
    """Verify a magic link token and issue a JWT."""
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    token_hash = hashlib.sha256(body.token.encode()).hexdigest()

    magic_link = (
        db_session.query(MagicLinkToken)
        .filter(
            MagicLinkToken.token_hash == token_hash,
            MagicLinkToken.used == False,  # noqa: E712
        )
        .first()
    )

    if not magic_link:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired sign-in link.",
        )

    if magic_link.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign-in link has expired.",
        )

    # Mark as used
    magic_link.used = True
    db_session.commit()

    # Look up user
    user = db_session.query(models.User).filter(models.User.id == magic_link.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    record_login_attempt(
        db_session,
        email=user.email,
        ip_address=ip,
        user_agent=ua,
        method="magic_link",
        success=True,
        user_id=user.id,
    )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }
