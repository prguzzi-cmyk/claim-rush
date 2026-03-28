#!/usr/bin/env python

"""CRUD operations for CommunicationLog."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.communication_log import CommunicationLog
from app.schemas.communication_log import (
    CommunicationLogCreate,
    CommunicationLogUpdate,
    CommunicationMetrics,
)


class CRUDCommunicationLog(CRUDBase[CommunicationLog, CommunicationLogCreate, CommunicationLogUpdate]):

    @staticmethod
    def get_by_lead(
        db_session: Session,
        *,
        lead_id: UUID,
        channel: str | None = None,
    ) -> list[CommunicationLog]:
        with db_session as session:
            stmt = (
                select(CommunicationLog)
                .where(CommunicationLog.lead_id == lead_id)
                .order_by(CommunicationLog.created_at.desc())
            )
            if channel:
                stmt = stmt.where(CommunicationLog.channel == channel)
            return list(session.scalars(stmt).all())

    @staticmethod
    def check_duplicate(
        db_session: Session,
        *,
        lead_id: UUID,
        purpose: str,
        channel: str,
    ) -> bool:
        """Return True if a sent/delivered record exists for the same lead+purpose+channel."""
        with db_session as session:
            stmt = (
                select(func.count())
                .select_from(CommunicationLog)
                .where(
                    CommunicationLog.lead_id == lead_id,
                    CommunicationLog.purpose == purpose,
                    CommunicationLog.channel == channel,
                    CommunicationLog.send_status.in_(["sent", "delivered"]),
                )
            )
            count = session.scalar(stmt)
            return count > 0

    @staticmethod
    def get_queued_for_send(db_session: Session) -> list[CommunicationLog]:
        """Get queued records where scheduled_send_at <= now()."""
        with db_session as session:
            stmt = (
                select(CommunicationLog)
                .where(
                    CommunicationLog.is_queued_for_quiet_hours.is_(True),
                    CommunicationLog.send_status == "queued",
                    CommunicationLog.scheduled_send_at <= datetime.now(timezone.utc),
                )
            )
            return list(session.scalars(stmt).all())

    @staticmethod
    def get_metrics(db_session: Session, *, filters: list) -> CommunicationMetrics:
        """Aggregate counts by status + opened/clicked not null."""
        with db_session as session:
            base = select(
                func.count().label("total"),
                func.count().filter(CommunicationLog.send_status == "sent").label("sent"),
                func.count().filter(CommunicationLog.send_status == "delivered").label("delivered"),
                func.count().filter(CommunicationLog.send_status == "bounced").label("bounced"),
                func.count().filter(CommunicationLog.send_status == "failed").label("failed"),
                func.count().filter(CommunicationLog.opened_at.isnot(None)).label("opened"),
                func.count().filter(CommunicationLog.clicked_at.isnot(None)).label("clicked"),
            ).select_from(CommunicationLog)

            for f in filters:
                base = base.where(f)

            row = session.execute(base).one()

            total = row.total or 0
            delivered = row.delivered or 0
            opened = row.opened or 0
            clicked = row.clicked or 0

            return CommunicationMetrics(
                total_attempted=total,
                total_sent=row.sent or 0,
                total_delivered=delivered,
                total_bounced=row.bounced or 0,
                total_opened=opened,
                total_clicked=clicked,
                total_failed=row.failed or 0,
                open_rate=round((opened / delivered * 100), 1) if delivered > 0 else 0.0,
                click_rate=round((clicked / delivered * 100), 1) if delivered > 0 else 0.0,
            )

    @staticmethod
    def update_opened(db_session: Session, *, log_id: UUID) -> bool:
        """Set opened_at = now if null. Returns True if updated."""
        with db_session as session:
            log = session.get(CommunicationLog, log_id)
            if log and log.opened_at is None:
                log.opened_at = datetime.now(timezone.utc)
                session.commit()
                return True
            return False

    @staticmethod
    def update_clicked(db_session: Session, *, log_id: UUID) -> bool:
        """Set clicked_at = now if null. Returns True if updated."""
        with db_session as session:
            log = session.get(CommunicationLog, log_id)
            if log and log.clicked_at is None:
                log.clicked_at = datetime.now(timezone.utc)
                session.commit()
                return True
            return False


communication_log = CRUDCommunicationLog(CommunicationLog)
