#!/usr/bin/env python

"""CRUD operations for lead delivery logs"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.lead_delivery_log import LeadDeliveryLog
from app.schemas.lead_delivery import LeadDeliveryLogCreate, LeadDeliveryLogUpdate


class CRUDLeadDeliveryLog(
    CRUDBase[LeadDeliveryLog, LeadDeliveryLogCreate, LeadDeliveryLogUpdate]
):
    def get_by_distribution(
        self, db_session: Session, *, distribution_history_id: UUID
    ) -> list[LeadDeliveryLog]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.distribution_history_id == distribution_history_id)
                .order_by(self.model.created_at.desc())
            )
            return list(session.execute(stmt).scalars().all())

    def get_by_lead(
        self, db_session: Session, *, lead_id: UUID
    ) -> list[LeadDeliveryLog]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.lead_id == lead_id)
                .order_by(self.model.created_at.desc())
            )
            return list(session.execute(stmt).scalars().all())

    def get_fire_delivery_metrics(
        self,
        db_session: Session,
        *,
        start_date=None,
        end_date=None,
    ) -> dict:
        """Aggregate delivery metrics for fire leads."""
        from sqlalchemy import func

        from app.models.lead_distribution import LeadDistributionHistory

        with db_session as session:
            # Join with distribution history to filter fire leads only
            base = (
                select(
                    self.model.channel,
                    self.model.delivery_status,
                    func.count().label("cnt"),
                )
                .join(
                    LeadDistributionHistory,
                    LeadDistributionHistory.id == self.model.distribution_history_id,
                )
                .where(LeadDistributionHistory.lead_type == "fire")
            )
            if start_date:
                base = base.where(self.model.created_at >= start_date)
            if end_date:
                base = base.where(self.model.created_at <= end_date)

            base = base.group_by(self.model.channel, self.model.delivery_status)
            rows = session.execute(base).all()

            metrics = {
                "sms": {"sent": 0, "delivered": 0, "failed": 0, "skipped": 0, "pending": 0},
                "email": {"sent": 0, "delivered": 0, "failed": 0, "skipped": 0, "pending": 0},
            }
            for channel, status, cnt in rows:
                if channel in metrics and status in metrics[channel]:
                    metrics[channel][status] = cnt

            return metrics


lead_delivery_log = CRUDLeadDeliveryLog(LeadDeliveryLog)
