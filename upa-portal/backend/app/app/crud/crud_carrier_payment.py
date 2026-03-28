#!/usr/bin/env python

"""CRUD operations for the CarrierPayment model"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.carrier_payment import CarrierPayment
from app.schemas.carrier_payment import CarrierPaymentCreateDB, CarrierPaymentUpdate


class CRUDCarrierPayment(CRUDBase[CarrierPayment, CarrierPaymentCreateDB, CarrierPaymentUpdate]):
    def get_by_project(self, db_session: Session, *, project_id: UUID) -> list[CarrierPayment]:
        """Get all payments for a project, ordered by payment_date desc."""
        with db_session as session:
            stmt = (
                select(CarrierPayment)
                .where(CarrierPayment.project_id == project_id)
                .order_by(CarrierPayment.payment_date.desc())
            )
            return list(session.scalars(stmt).all())

    def get_total_by_project(self, db_session: Session, *, project_id: UUID) -> float:
        """Get the total payment amount for a project."""
        with db_session as session:
            stmt = (
                select(func.coalesce(func.sum(CarrierPayment.payment_amount), 0.0))
                .where(CarrierPayment.project_id == project_id)
            )
            return float(session.scalar(stmt))


carrier_payment = CRUDCarrierPayment(CarrierPayment)
