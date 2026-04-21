#!/usr/bin/env python

"""SQLAlchemy model for the commission_payout table.

Records each disbursement to an agent. Writing a payout row should also
emit a matching `PAYOUT_ISSUED` row into `commission_ledger` (service layer
handles both atomically). 1099 YTD is derived from these ledger rows.
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import CommissionClaim, User


class CommissionPayout(TimestampMixin, AuditMixin, Base):
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_commission_payout_user_id"),
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    claim_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "commission_claim.id",
            name="fk_commission_payout_claim_id",
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
