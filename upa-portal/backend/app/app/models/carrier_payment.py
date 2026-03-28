#!/usr/bin/env python

"""SQLAlchemy model for the carrier_payment table"""

from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.estimate_project import EstimateProject


class CarrierPayment(TimestampMixin, AuditMixin, Base):
    payment_amount: Mapped[float] = mapped_column(Float(), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date(), nullable=False)
    payment_type: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[str | None] = mapped_column(Text(), nullable=True)

    # Foreign Keys
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "estimate_project.id",
            name="fk_carrier_payment_project_id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    # Relationships
    project: Mapped["EstimateProject"] = relationship(
        back_populates="carrier_payments",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"project_id={self.project_id!r}, "
            f"payment_amount={self.payment_amount!r})"
        )
