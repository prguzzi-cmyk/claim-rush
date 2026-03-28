#!/usr/bin/env python

"""Public (no-auth) endpoints for territory recruitment map and applications"""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db_session
from app.core.config import settings
from app.schemas.public_territory import (
    PublicTerritoryResponse,
    TerritoryApplicationCreate,
    TerritoryApplicationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

RECRUITING_NOTIFICATION_EMAIL = "pguzzi@upaclaim.org"


@router.get(
    "",
    summary="List Public Territories",
    response_description="Sanitized territory list for public recruitment map",
    response_model=list[PublicTerritoryResponse],
)
def list_public_territories(
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Return all territories with status info but no UUIDs. No auth required."""
    territories = crud.territory.get_all_with_assignments(db_session)
    result: list[PublicTerritoryResponse] = []

    for t in territories:
        adjuster_count = len(
            [ut for ut in t.user_territories if ut.user is not None]
        )
        max_adj = t.max_adjusters or 3

        # Determine status
        if not t.is_active:
            status = "locked"
        elif adjuster_count >= max_adj:
            status = "full"
        elif t.chapter_president_id is not None:
            status = "cp_assigned"
        else:
            status = "available"

        # CP display name (no UUID)
        cp_name = None
        if t.chapter_president is not None:
            first = t.chapter_president.first_name or ""
            last = t.chapter_president.last_name or ""
            cp_name = f"{first} {last}".strip() or None

        result.append(
            PublicTerritoryResponse(
                name=t.name or "",
                territory_type=t.territory_type or "",
                state=t.state,
                county=t.county,
                zip_code=t.zip_code,
                custom_geometry=t.custom_geometry,
                status=status,
                chapter_president_name=cp_name,
                adjuster_count=adjuster_count,
                max_adjusters=max_adj,
                slots_remaining=max(0, max_adj - adjuster_count),
            )
        )

    return result


def _send_application_email(app: TerritoryApplicationCreate) -> None:
    """Send territory application notification email (runs in background)."""
    try:
        from app.utils.emails import send_email

        subject = (
            f"New Territory Application – {app.first_name} {app.last_name} "
            f"({app.state_of_interest})"
        )

        rows = [
            ("Name", f"{app.first_name} {app.last_name}"),
            ("Email", app.email),
            ("Phone", app.phone),
            ("State of Interest", app.state_of_interest),
            ("City / County of Interest", app.city_county_of_interest or "—"),
            ("Experience / Background", app.experience_background or "—"),
            ("Notes", app.notes or "—"),
        ]

        table_rows = "".join(
            f"<tr><td style='padding:8px 12px;font-weight:600;color:#555;"
            f"border-bottom:1px solid #eee;white-space:nowrap;'>{label}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #eee;'>{value}</td></tr>"
            for label, value in rows
        )

        body_html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1a237e;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
                <h2 style="margin:0;font-size:18px;">New Chapter President / Territory Application</h2>
            </div>
            <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
                <table style="width:100%;border-collapse:collapse;">{table_rows}</table>
                <p style="margin-top:20px;font-size:13px;color:#888;">
                    Submitted via the UPA Portal public territories page.
                </p>
            </div>
        </div>
        """

        body_plain = "\n".join(f"{label}: {value}" for label, value in rows)

        send_email(
            to=RECRUITING_NOTIFICATION_EMAIL,
            subject=subject,
            body_html=body_html,
            body_plain=body_plain,
        )
    except Exception:
        logger.exception("Failed to send territory application email")


@router.post(
    "/applications",
    summary="Submit Territory Application",
    response_description="Application confirmation",
    response_model=TerritoryApplicationResponse,
)
def submit_territory_application(
    application: TerritoryApplicationCreate,
    background_tasks: BackgroundTasks,
) -> Any:
    """Accept a public territory / Chapter President application and notify recruiting."""
    background_tasks.add_task(_send_application_email, application)
    return TerritoryApplicationResponse()
