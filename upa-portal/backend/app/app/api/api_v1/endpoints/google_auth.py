#!/usr/bin/env python

"""Google OAuth Routes"""

from datetime import timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.core import security
from app.core.brute_force import record_login_attempt
from app.core.config import settings
from app.core.rate_limit import limiter

router = APIRouter()


def _verify_google_token(id_token: str) -> dict | None:
    """Verify a Google ID token and return the payload."""
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        payload = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
        return payload
    except Exception:
        return None


@router.post("/verify", response_model=schemas.Token)
@limiter.limit("10/minute")
def google_verify(
    request: Request,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    body: schemas.GoogleVerifyRequest,
) -> Any:
    """Verify a Google ID token and issue a JWT."""
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    if not settings.GOOGLE_AUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authentication is not configured.",
        )

    payload = _verify_google_token(body.id_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID token.",
        )

    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token does not contain email.",
        )

    user = crud.user.get_by_email(db_session, email=email)
    if not user:
        record_login_attempt(
            db_session,
            email=email,
            ip_address=ip,
            user_agent=ua,
            method="google",
            success=False,
            failure_reason="No matching account",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found for this Google email.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive.",
        )

    record_login_attempt(
        db_session,
        email=email,
        ip_address=ip,
        user_agent=ua,
        method="google",
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


@router.get("/status")
def google_auth_status() -> Any:
    """Return whether Google auth is enabled and the client ID."""
    return {
        "enabled": settings.GOOGLE_AUTH_ENABLED,
        "client_id": settings.GOOGLE_CLIENT_ID if settings.GOOGLE_AUTH_ENABLED else "",
    }
