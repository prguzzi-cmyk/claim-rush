#!/usr/bin/env python

"""SQLAlchemy model for the claim payment file table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import File

if TYPE_CHECKING:
    from app.models import ClaimPayment


class ClaimPaymentFile(File):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "file.id",
            name="fk_claim_payment_file_id",
        ),
        primary_key=True,
    )
    payment_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "claim_payment.id",
            name="fk_claim_payment_file_payment_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "claim_payment_file",
    }

    # Relationships
    claim_payment: Mapped["ClaimPayment"] = relationship(
        back_populates="claim_payment_files",
        join_depth=1,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, payment_id={self.payment_id!r}, "
            f"name: {self.name!r}, path: {self.path!r})"
        )
