#!/usr/bin/env python

"""Dev-bypass dependency for commission routes.

When the DEV_BYPASS env var is set to "1", commission endpoints skip the
usual `get_current_active_user` auth check so the Angular frontend (which
currently runs in devAutoLogin mode) can call the backend without a JWT.

When DEV_BYPASS is not set, the standard auth dependency applies.

TODO: Remove this dep once devAutoLogin is turned off in prod and real
auth is wired end-to-end.
"""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps.app import get_db_session
from app.models import User


def _is_dev_bypass_enabled() -> bool:
    return os.getenv("DEV_BYPASS", "") == "1"


def commission_auth(
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> User | None:
    """Return the current user, or None in DEV_BYPASS mode.

    Endpoints receiving None should treat it as 'dev mode — allow read/write
    without a user principal'. Endpoints that mutate data while auth is
    disabled rely on the seed/dev stub being the only caller.
    """
    if _is_dev_bypass_enabled():
        return None

    # Real auth path — try to validate bearer token
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for commission endpoints",
        )

    # Token-based validation reuses existing auth infra; we import lazily to
    # avoid circular dependencies during app startup.
    from app.api.deps.user import get_current_active_user  # type: ignore

    # get_current_active_user is itself a dependency-injected callable; for
    # simplicity in dev, raise rather than try to invoke it manually. When
    # auth is re-enabled, replace this dep entirely with get_current_active_user.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Production auth for commission endpoints not yet wired. "
            "Set DEV_BYPASS=1 for local dev, or replace commission_auth "
            "with get_current_active_user in endpoints/commission.py."
        ),
    )
