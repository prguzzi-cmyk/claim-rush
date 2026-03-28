#!/usr/bin/env python

"""Admin endpoints for testing email tracking and communication logs."""

from datetime import datetime
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.rbac import Modules
from app.models.communication_log import CommunicationLog
from app.models.lead_contact import LeadContact
from app.schemas.communication_log import CommunicationLogCreate, TestEmailResponse

router = APIRouter()

permissions_comm = Permissions(Modules.COMMUNICATION_LOG.value)


class TestEmailRequest(BaseModel):
    to: EmailStr


@router.post(
    "/test-email",
    summary="Send a test email with tracking",
    response_model=TestEmailResponse,
    dependencies=[Depends(permissions_comm.create())],
)
def send_test_email(
    body: TestEmailRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
) -> Any:
    """
    Send a test email with tracking pixel and click-tracked link.
    Used by admins to verify tracking is working.
    """
    from app.services.communication_service import CommunicationService

    service = CommunicationService(db_session)

    server_host = str(settings.SERVER_HOST).rstrip("/")
    api_prefix = settings.API_V1_STR
    sample_url = f"{settings.PROJECT_URL}"

    subject = f"{settings.PROJECT_NAME} — Email Tracking Test"
    body_html = (
        f"<html><body>"
        f"<h2>Email Tracking Test</h2>"
        f"<p>This is a test email from {settings.PROJECT_NAME}.</p>"
        f"<p>Click the link below to test click tracking:</p>"
        f'<p><a href="{sample_url}">Visit {settings.PROJECT_NAME}</a></p>'
        f"<p>If you can see this email, open tracking is working.</p>"
        f"</body></html>"
    )
    body_plain = (
        f"Email Tracking Test\n\n"
        f"This is a test email from {settings.PROJECT_NAME}.\n"
        f"Visit: {sample_url}\n"
    )

    log = service.send_tracked_email(
        lead_id=None,
        agent_id=str(current_user.id),
        recipient_email=str(body.to),
        subject=subject,
        body_html=body_html,
        body_plain=body_plain,
        purpose="admin_test",
        manual_override=True,
    )

    tracking_pixel_url = f"{server_host}{api_prefix}/t/{log.id}.gif"
    sample_click_url = f"{server_host}{api_prefix}/c/{log.id}?url={quote(sample_url, safe='')}"

    return TestEmailResponse(
        communication_log_id=log.id,
        smtp_message_id=log.provider_message_id,
        send_status=log.send_status,
        tracking_pixel_url=tracking_pixel_url,
        sample_click_url=sample_click_url,
    )


@router.get(
    "/logs",
    summary="List Communication Logs",
    response_description="Paginated communication logs with filters",
    dependencies=[Depends(permissions_comm.read())],
)
def list_communication_logs(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[Any, Depends(get_current_active_user)],
    channel: Annotated[str | None, Query(description="Filter by channel: sms, email")] = None,
    direction: Annotated[str | None, Query(description="Filter by direction: inbound, outbound")] = None,
    purpose: Annotated[str | None, Query(description="Filter by purpose")] = None,
    date_from: Annotated[datetime | None, Query(description="Filter logs from this date")] = None,
    date_to: Annotated[datetime | None, Query(description="Filter logs to this date")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> Any:
    """Return paginated communication logs with optional filters.

    Includes lead address from LeadContact for display.
    """
    query = select(CommunicationLog).order_by(desc(CommunicationLog.created_at))

    if channel:
        query = query.where(CommunicationLog.channel == channel)
    if direction:
        query = query.where(CommunicationLog.direction == direction)
    if purpose:
        query = query.where(CommunicationLog.purpose == purpose)
    if date_from:
        query = query.where(CommunicationLog.created_at >= date_from)
    if date_to:
        query = query.where(CommunicationLog.created_at <= date_to)

    # Count
    total_q = select(func.count()).select_from(query.subquery())
    total = db_session.execute(total_q).scalar() or 0

    # Paginate
    offset = (page - 1) * size
    logs = db_session.execute(query.offset(offset).limit(size)).scalars().all()

    # Fetch lead addresses
    lead_ids = [log.lead_id for log in logs if log.lead_id]
    lead_addresses = {}
    if lead_ids:
        addr_q = select(LeadContact.lead_id, LeadContact.address_loss).where(
            LeadContact.lead_id.in_(lead_ids)
        )
        for row in db_session.execute(addr_q):
            lead_addresses[row.lead_id] = row.address_loss

    items = []
    for log in logs:
        items.append({
            "id": str(log.id),
            "lead_id": str(log.lead_id) if log.lead_id else None,
            "lead_address": lead_addresses.get(log.lead_id),
            "channel": log.channel,
            "direction": getattr(log, "direction", "outbound"),
            "purpose": log.purpose,
            "recipient_email": log.recipient_email,
            "recipient_phone": log.recipient_phone,
            "body_preview": log.body_preview,
            "send_status": log.send_status,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if total else 0,
    }
