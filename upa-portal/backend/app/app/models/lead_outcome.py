#!/usr/bin/env python

"""SQLAlchemy model for the lead_outcome table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import Lead, User


class LeadOutcome(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    outcome_status: Mapped[str] = mapped_column(String(50))
    category: Mapped[str] = mapped_column(String(30))
    notes: Mapped[str | None] = mapped_column(Text())
    automation_triggered: Mapped[str | None] = mapped_column(String(100))

    # Foreign Keys
    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "lead.id",
            name="fk_lead_outcome_lead_id",
            ondelete="CASCADE",
        )
    )
    recorded_by_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_lead_outcome_recorded_by_id",
        )
    )

    # Table Configuration
    __table_args__ = (
        Index("ix_lead_outcome_lead_id", "lead_id"),
        Index("ix_lead_outcome_recorded_by_id", "recorded_by_id"),
        Index("ix_lead_outcome_outcome_status", "outcome_status"),
    )

    # Relationships
    lead: Mapped["Lead"] = relationship(
        primaryjoin="LeadOutcome.lead_id == Lead.id",
        lazy="joined",
        viewonly=True,
    )
    recorded_by: Mapped["User"] = relationship(
        primaryjoin="LeadOutcome.recorded_by_id == User.id",
        lazy="joined",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"lead_id={self.lead_id!r}, "
            f"outcome_status={self.outcome_status!r})"
        )
