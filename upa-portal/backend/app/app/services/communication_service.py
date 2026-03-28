#!/usr/bin/env python

"""
Communication Service
=====================
Orchestrates tracked email/SMS sends with duplicate protection and quiet-hours queuing.
"""

import logging
from datetime import datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app import crud
from app.core.config import settings
from app.models.communication_log import CommunicationLog
from app.schemas.communication_log import CommunicationLogCreate

logger = logging.getLogger(__name__)


class CommunicationService:
    def __init__(self, db_session: Session):
        self.db_session = db_session

    def send_tracked_email(
        self,
        lead_id: str | None,
        agent_id: str | None,
        recipient_email: str,
        subject: str,
        body_html: str,
        body_plain: str,
        purpose: str,
        template_type: str | None = None,
        attachments: list | None = None,
        manual_override: bool = False,
    ) -> CommunicationLog:
        """
        Send a tracked email with duplicate protection and quiet-hours queuing.

        Returns the CommunicationLog record.
        """
        # 1. Duplicate check
        if lead_id and not manual_override:
            is_dup = crud.communication_log.check_duplicate(
                self.db_session, lead_id=lead_id, purpose=purpose, channel="email",
            )
            if is_dup:
                logger.info(
                    "Duplicate email skipped: lead=%s purpose=%s", lead_id, purpose,
                )
                # Return the existing log
                existing = crud.communication_log.get_by_lead(
                    self.db_session, lead_id=lead_id, channel="email",
                )
                if existing:
                    return existing[0]

        # 2. Create CommunicationLog with status="pending"
        log_in = CommunicationLogCreate(
            lead_id=lead_id,
            agent_id=agent_id,
            channel="email",
            purpose=purpose,
            template_type=template_type,
            recipient_email=recipient_email,
            subject=subject,
            body_preview=(body_plain[:500] if body_plain else None),
            send_status="pending",
            is_manual_override=manual_override,
        )
        log = crud.communication_log.create(self.db_session, obj_in=log_in)

        # 3. Quiet hours check
        if settings.QUIET_HOURS_ENABLED and self._is_quiet_hours():
            next_window = self._next_send_window()
            crud.communication_log.update(
                self.db_session,
                db_obj=log,
                obj_in={
                    "send_status": "queued",
                    "is_queued_for_quiet_hours": True,
                    "scheduled_send_at": next_window,
                },
            )
            logger.info("Email queued for quiet hours: log_id=%s scheduled=%s", log.id, next_window)
            return log

        # 4. Dispatch Celery task
        from app.core.celery_app import celery_app

        attachments_data = None
        if attachments:
            attachments_data = [(content, filename) for content, filename in attachments]

        celery_app.send_task(
            "app.tasks.communication.send_tracked_email_task",
            args=[str(log.id), body_html, body_plain],
            kwargs={"attachments_data": attachments_data},
        )

        return log

    @staticmethod
    def _is_quiet_hours() -> bool:
        """Check if current time is within quiet hours."""
        try:
            import zoneinfo
            tz = zoneinfo.ZoneInfo(settings.QUIET_HOURS_TZ)
        except Exception:
            return False

        now = datetime.now(tz).time()
        start = time.fromisoformat(settings.QUIET_HOURS_START)
        end = time.fromisoformat(settings.QUIET_HOURS_END)

        if start > end:
            # Crosses midnight: e.g. 21:00 - 08:00
            return now >= start or now < end
        else:
            return start <= now < end

    @staticmethod
    def _next_send_window() -> datetime:
        """Return the next datetime when sending is allowed."""
        try:
            import zoneinfo
            tz = zoneinfo.ZoneInfo(settings.QUIET_HOURS_TZ)
        except Exception:
            return datetime.now(timezone.utc) + timedelta(hours=8)

        now = datetime.now(tz)
        end = time.fromisoformat(settings.QUIET_HOURS_END)
        next_window = now.replace(hour=end.hour, minute=end.minute, second=0, microsecond=0)

        if next_window <= now:
            next_window += timedelta(days=1)

        return next_window.astimezone(timezone.utc)
