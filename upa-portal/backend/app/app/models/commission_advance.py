#!/usr/bin/env python

"""SQLAlchemy model for the commission_advance table.

Each advance disbursed to an agent against expected future commissions.
Writing an advance row should emit a matching ADVANCE_ISSUED row into
`commission_ledger` (service layer handles atomically). Advances are NOT
considered taxable payouts — 1099 YTD only includes PAYOUT_ISSUED.
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import CommissionClaim, User


class CommissionAdvance(TimestampMixin, AuditMixin, Base):
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_commission_advance_user_id"),
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    repaid_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), server_default="0", default=0
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    claim_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "commission_claim.id",
            name="fk_commission_advance_claim_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        foreign_keys=[user_id], viewonly=True, lazy="joined"
    )
    claim: Mapped["CommissionClaim | None"] = relationship(
        foreign_keys=[claim_id], viewonly=True, lazy="joined"
    )
