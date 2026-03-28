#!/usr/bin/env python

"""SQLAlchemy model for the lead_skip_trace table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import Lead


class LeadSkipTrace(TimestampMixin, Base):
    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey("lead.id", name="fk_lead_skip_trace_lead_id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    owner_first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_age: Mapped[str | None] = mapped_column(String(10), nullable=True)
    owner_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    owner_mailing_street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_mailing_street2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_mailing_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_mailing_state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    owner_mailing_zip: Mapped[str | None] = mapped_column(String(20), nullable=True)
    skiptrace_raw_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    skiptrace_status: Mapped[str] = mapped_column(String(20), default="pending")
    skiptrace_ran_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    lead: Mapped["Lead"] = relationship(
        back_populates="skip_trace",
        lazy="joined",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"lead_id={self.lead_id!r}, "
            f"status={self.skiptrace_status!r})"
        )
