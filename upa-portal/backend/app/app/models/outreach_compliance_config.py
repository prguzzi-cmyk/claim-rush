#!/usr/bin/env python

"""SQLAlchemy model for outreach compliance configuration (singleton-style per org)."""

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class OutreachComplianceConfig(TimestampMixin, Base):
    """Global outreach compliance settings — one active row at a time."""

    master_pause: Mapped[bool] = mapped_column(Boolean, default=False)
    quiet_hours_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    quiet_hours_start: Mapped[str] = mapped_column(String(5), default="21:00")  # HH:mm
    quiet_hours_end: Mapped[str] = mapped_column(String(5), default="08:00")    # HH:mm
    quiet_hours_tz: Mapped[str] = mapped_column(String(50), default="America/New_York")
    stop_word_list: Mapped[str] = mapped_column(
        Text, default="STOP,UNSUBSCRIBE,REMOVE,QUIT,CANCEL,END,OPTOUT,OPT OUT"
    )
    auto_suppress_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    max_daily_sms_per_lead: Mapped[int] = mapped_column(Integer, default=3)
    max_daily_emails_per_lead: Mapped[int] = mapped_column(Integer, default=2)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
