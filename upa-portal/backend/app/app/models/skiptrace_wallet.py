#!/usr/bin/env python

"""SQLAlchemy model for the skiptrace_wallet table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import User
    from app.models.skiptrace_transaction import SkiptraceTransaction


class SkiptraceWallet(TimestampMixin, AuditMixin, Base):
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_skiptrace_wallet_user_id",
            ondelete="CASCADE",
        ),
    )
    credit_balance: Mapped[int] = mapped_column(Integer, default=0)
    credits_used: Mapped[int] = mapped_column(Integer, default=0)
    last_recharge_date: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Table Configuration
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_skiptrace_wallet_user_id"),
    )

    # Relationships
    user: Mapped["User"] = relationship(
        primaryjoin="SkiptraceWallet.user_id == User.id",
        lazy="joined",
        viewonly=True,
    )
    transactions: Mapped[list["SkiptraceTransaction"]] = relationship(
        back_populates="wallet",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"user_id={self.user_id!r}, "
            f"credit_balance={self.credit_balance!r})"
        )
