#!/usr/bin/env python

"""SQLAlchemy model for the commission_ledger table — append-only ledger.

Every financial event for a writing agent (or recipient of an override)
emits a row here. Summaries (total earned, paid to date, 1099 YTD) are
derived from ledger aggregates — never overwritten.

Append-only rule is enforced at the service layer (no UPDATE / DELETE).
The table has no soft-delete mixin and no updated_by_id tracking for
edits because rows are never edited.
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import CommissionClaim, User


class CommissionLedger(TimestampMixin, Base):
    # Who the row belongs to (writing agent for writing_agent bucket; RVP for
    # rvp_override bucket; CP for cp_override bucket; system_house for house;
    # system_reserve for reserve).
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_commission_ledger_user_id"),
        nullable=True,  # house/reserve rows may use a sentinel user; nullable for flexibility
        index=True,
    )

    # Claim this event relates to (nullable for pure advances/adjustments that
    # aren't tied to a specific claim).
    claim_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "commission_claim.id",
            name="fk_commission_ledger_claim_id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    # Bucket — one of: HOUSE / WRITING_AGENT / RVP_OVERRIDE / CP_OVERRIDE / RESERVE
    bucket: Mapped[str] = mapped_column(String(20))

    # Transaction type — one of:
    #   COMMISSION_EARNED / PAYOUT_ISSUED / ADVANCE_ISSUED /
    #   INTEREST_APPLIED / REPAYMENT_OFFSET / ADJUSTMENT
    txn_type: Mapped[str] = mapped_column(String(30))

    # Amount. Signs follow Angular mock convention:
    #   COMMISSION_EARNED, ADVANCE_ISSUED, INTEREST_APPLIED → positive
    #   PAYOUT_ISSUED, REPAYMENT_OFFSET → negative
    #   ADJUSTMENT → either
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    # Transaction timestamp (business time — may differ from row insert time).
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        # Covers getAgentSimpleEarnings + getTaxable1099YTD (both filter by
        # user + bucket + txn_type + year).
        Index("ix_commission_ledger_user_bucket_type", "user_id", "bucket", "txn_type"),
        {"mysql_engine": "InnoDB"},
    )

    # Relationships
    user: Mapped["User | None"] = relationship(
        foreign_keys=[user_id], viewonly=True, lazy="joined"
    )
    claim: Mapped["CommissionClaim | None"] = relationship(
        foreign_keys=[claim_id], viewonly=True, lazy="joined"
    )
