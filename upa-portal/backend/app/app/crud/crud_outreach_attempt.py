#!/usr/bin/env python

"""CRUD operations for outreach attempts"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.outreach_attempt import OutreachAttempt
from app.schemas.outreach_attempt import OutreachAttemptCreate, OutreachAttemptUpdate, OutreachMetrics


class CRUDOutreachAttempt(CRUDBase[OutreachAttempt, OutreachAttemptCreate, OutreachAttemptUpdate]):

    def get_by_lead(
        self, db_session: Session, *, lead_id: UUID
    ) -> Sequence[OutreachAttempt]:
        with db_session as session:
            stmt = (
                select(OutreachAttempt)
                .where(OutreachAttempt.lead_id == lead_id)
                .order_by(OutreachAttempt.created_at.desc())
            )
            return session.scalars(stmt).all()

    def count_attempts_for_campaign_lead(
        self, db_session: Session, *, campaign_id: UUID, lead_id: UUID
    ) -> int:
        with db_session as session:
            stmt = select(func.count()).where(
                and_(
                    OutreachAttempt.campaign_id == campaign_id,
                    OutreachAttempt.lead_id == lead_id,
                )
            )
            return session.scalar(stmt) or 0

    def get_metrics(
        self,
        db_session: Session,
        *,
        campaign_id: UUID | None = None,
    ) -> OutreachMetrics:
        with db_session as session:
            base = select(OutreachAttempt)
            if campaign_id:
                base = base.where(OutreachAttempt.campaign_id == campaign_id)

            total = session.scalar(
                select(func.count()).select_from(base.subquery())
            ) or 0

            def _count_status(status: str) -> int:
                q = select(func.count()).where(OutreachAttempt.status == status)
                if campaign_id:
                    q = q.where(OutreachAttempt.campaign_id == campaign_id)
                return session.scalar(q) or 0

            sent = _count_status("sent")
            delivered = _count_status("delivered")
            failed = _count_status("failed")
            responded = _count_status("responded")
            appointments = _count_status("appointment_booked")

            return OutreachMetrics(
                total_attempts=total,
                sent=sent,
                delivered=delivered,
                failed=failed,
                responded=responded,
                appointments=appointments,
                response_rate=round(responded / total * 100, 2) if total else 0.0,
                appointment_rate=round(appointments / total * 100, 2) if total else 0.0,
            )


outreach_attempt = CRUDOutreachAttempt(OutreachAttempt)
