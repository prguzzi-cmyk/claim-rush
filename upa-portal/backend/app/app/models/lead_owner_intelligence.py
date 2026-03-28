#!/usr/bin/env python

"""SQLAlchemy model for the lead_owner_intelligence table"""

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin


class LeadOwnerIntelligence(TimestampMixin, AuditMixin, Base):
    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "lead.id",
            name="fk_lead_owner_intelligence_lead_id",
            ondelete="CASCADE",
        ),
    )
    owner_first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    owner_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    owner_mailing_street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_mailing_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_mailing_state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    owner_mailing_zip: Mapped[str | None] = mapped_column(String(20), nullable=True)
    raw_residents: Mapped[str | None] = mapped_column(Text(), nullable=True)
    lookup_status: Mapped[str] = mapped_column(String(30))

    # Table Configuration
    __table_args__ = (
        UniqueConstraint("lead_id", name="uq_lead_owner_intelligence_lead_id"),
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"lead_id={self.lead_id!r}, "
            f"lookup_status={self.lookup_status!r})"
        )
