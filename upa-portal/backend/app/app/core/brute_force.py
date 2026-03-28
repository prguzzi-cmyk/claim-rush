#!/usr/bin/env python

"""Brute force protection: track and limit failed login attempts"""

from datetime import datetime, timedelta

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.login_attempt import LoginAttempt

MAX_FAILURES = 5
WINDOW_MINUTES = 15


def check_brute_force(db: Session, email: str, ip: str) -> bool:
    """
    Return True if the email or IP has too many recent failures.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=WINDOW_MINUTES)
    count = (
        db.query(func.count(LoginAttempt.id))
        .filter(
            and_(
                LoginAttempt.success == False,  # noqa: E712
                LoginAttempt.created_at >= cutoff,
                (LoginAttempt.email == email) | (LoginAttempt.ip_address == ip),
            )
        )
        .scalar()
    )
    return count >= MAX_FAILURES


def record_login_attempt(
    db: Session,
    *,
    email: str,
    ip_address: str,
    user_agent: str | None = None,
    method: str = "password",
    success: bool = False,
    failure_reason: str | None = None,
    user_id=None,
) -> LoginAttempt:
    """
    Insert a login attempt tracking row.
    """
    attempt = LoginAttempt(
        user_id=user_id,
        email=email,
        ip_address=ip_address,
        user_agent=user_agent,
        method=method,
        success=success,
        failure_reason=failure_reason,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt
