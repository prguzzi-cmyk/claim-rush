#!/usr/bin/env python

"""SQLAlchemy model for the lead table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import Contact, FollowUp


class Lead(AuditMixin, TimestampMixin, Base):
    loss_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    peril: Mapped[str]
    insurance_company: Mapped[str]
    policy_number: Mapped[str]
    claim_number: Mapped[str | None]
    status: Mapped[str]
    source: Mapped[str]
    source_info: Mapped[str | None]
    instructions_or_notes: Mapped[str | None]

    # Foreign Keys
    assigned_to: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE")
    )

    # Relationships
    contact: Mapped["Contact"] = relationship(
        back_populates="lead", lazy="subquery", cascade="all, delete"
    )
    follow_ups: Mapped[list["FollowUp"]] = relationship(
        back_populates="lead", lazy="subquery", cascade="all, delete"
    )
