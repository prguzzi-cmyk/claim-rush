#!/usr/bin/env python

"""SQLAlchemy model for the follow-up table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import Lead


class FollowUp(AuditMixin, TimestampMixin, Base):
    type: Mapped[str]
    dated: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    note: Mapped[str]
    next_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    # Foreign Keys
    lead_id: Mapped[UUID] = mapped_column(ForeignKey("lead.id", ondelete="CASCADE"))

    # Relationships
    lead: Mapped["Lead"] = relationship(back_populates="follow_ups", lazy="subquery")
