#!/usr/bin/env python

"""SQLAlchemy model for the claim payment table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import Claim, ClaimPaymentFile


class ClaimPayment(TimestampMixin, AuditMixin, Base):
    payment_date: Mapped[Date] = mapped_column(Date())
    check_type: Mapped[str] = mapped_column(String(20))
    payment_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issued_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payee: Mapped[str | None] = mapped_column(String(200), nullable=True)
    deposit_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_coverage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    check_amount: Mapped[float] = mapped_column(Float())
    ref_number: Mapped[str | None] = mapped_column(String(100))
    note: Mapped[str | None] = mapped_column(Text())
    contingency_fee_percentage: Mapped[float] = mapped_column(Float(), default=0)
    appraisal_fee: Mapped[float | None] = mapped_column(
        Float(), nullable=True, default=0
    )
    umpire_fee: Mapped[float | None] = mapped_column(Float(), nullable=True, default=0)
    mold_fee: Mapped[float | None] = mapped_column(Float(), nullable=True, default=0)
    misc_fee: Mapped[float | None] = mapped_column(Float(), nullable=True, default=0)
    is_ready_to_process: Mapped[bool] = mapped_column(default=False)
    is_locked: Mapped[bool] = mapped_column(default=False)

    # Foreign Keys
    claim_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "claim.id",
            name="fk_claim_payment_claim_id",
            ondelete="CASCADE",
        )
    )

    # Relationships
    claim: Mapped["Claim"] = relationship(
        back_populates="claim_payments",
        lazy="subquery",
        join_depth=1,
    )
    claim_payment_files: Mapped[list["ClaimPaymentFile"]] = relationship(
        back_populates="claim_payment",
        lazy="subquery",
        viewonly=True,
        join_depth=1,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"payment_date: {self.payment_date!r}, "
            f"contingency_fee: {self.contingency_fee_percentage!r}, "
            f"check_amount: {self.check_amount!r})"
        )
