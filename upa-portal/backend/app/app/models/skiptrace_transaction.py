#!/usr/bin/env python

"""SQLAlchemy model for the skiptrace_transaction table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.skiptrace_wallet import SkiptraceWallet


class SkiptraceTransaction(TimestampMixin, Base):
    wallet_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "skiptrace_wallet.id",
            name="fk_skiptrace_transaction_wallet_id",
            ondelete="CASCADE",
        ),
    )
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "lead.id",
            name="fk_skiptrace_transaction_lead_id",
        ),
        nullable=True,
    )
    action_type: Mapped[str] = mapped_column(String(30), default="skip_trace")
    credits_used: Mapped[int] = mapped_column(Integer, default=1)
    lookup_status: Mapped[str] = mapped_column(String(30))
    address_queried: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    wallet: Mapped["SkiptraceWallet"] = relationship(
        back_populates="transactions",
        lazy="joined",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"wallet_id={self.wallet_id!r}, "
            f"lookup_status={self.lookup_status!r})"
        )
