#!/usr/bin/env python

"""SQLAlchemy model for the voice_usage_record table"""

from uuid import UUID

from sqlalchemy import Date, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class VoiceUsageRecord(TimestampMixin, Base):
    account_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_voice_usage_record_account_id", ondelete="CASCADE"),
        index=True,
    )
    period_start: Mapped[Date] = mapped_column(Date)
    period_end: Mapped[Date] = mapped_column(Date)

    minutes_used: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0")
    plan_limit_minutes: Mapped[float] = mapped_column(Float, default=500.0, server_default="500.0")
    overage_minutes: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0")
    cost_cents: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    call_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Relationships
    account = relationship(
        "User",
        primaryjoin="VoiceUsageRecord.account_id == User.id",
        lazy="joined",
        viewonly=True,
    )
