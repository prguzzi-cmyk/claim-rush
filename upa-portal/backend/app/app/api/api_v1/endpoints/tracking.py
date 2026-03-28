#!/usr/bin/env python

"""Open/click tracking endpoints — NO AUTH required."""

import base64
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db_session

logger = logging.getLogger(__name__)

# 1x1 transparent GIF (43 bytes)
TRANSPARENT_GIF = base64.b64decode(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)

router = APIRouter()
click_router = APIRouter()


@router.get(
    "/{log_id}.gif",
    summary="Tracking pixel — records email open",
    include_in_schema=False,
)
def tracking_pixel(
    log_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """Return a 1x1 transparent GIF and record opened_at (first open only)."""
    try:
        crud.communication_log.update_opened(db_session, log_id=log_id)
    except Exception:
        logger.debug("Failed to update opened_at for log_id=%s", log_id, exc_info=True)

    return Response(
        content=TRANSPARENT_GIF,
        media_type="image/gif",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@click_router.get(
    "/{log_id}",
    summary="Click redirect — records link click",
    include_in_schema=False,
)
def click_redirect(
    log_id: UUID,
    url: Annotated[str, Query(description="Original destination URL")],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """Record clicked_at (first click only), then 302 redirect to original URL."""
    try:
        crud.communication_log.update_clicked(db_session, log_id=log_id)
    except Exception:
        logger.debug("Failed to update clicked_at for log_id=%s", log_id, exc_info=True)

    return RedirectResponse(url=url, status_code=302)
