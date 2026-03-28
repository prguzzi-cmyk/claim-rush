#!/usr/bin/env python

"""SQLAlchemy model for the inspection_schedule table"""

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class InspectionSchedule(TimestampMixin, Base):
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("lead.id", name="fk_inspection_schedule_lead_id", ondelete="SET NULL"),
        nullable=True,
    )
    homeowner_name: Mapped[str] = mapped_column(String(200))
    homeowner_phone: Mapped[str | None] = mapped_column(String(20))
    homeowner_email: Mapped[str | None] = mapped_column(String(255))
    property_address: Mapped[str] = mapped_column(String(500))
    adjuster_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_inspection_schedule_adjuster_id", ondelete="SET NULL"),
        nullable=True,
    )
    inspection_date: Mapped[str] = mapped_column(String(10))  # 'YYYY-MM-DD'
    inspection_time: Mapped[str] = mapped_column(String(5))  # 'HH:mm'
    end_time: Mapped[str] = mapped_column(String(5))  # 'HH:mm'
    status: Mapped[str] = mapped_column(String(30), default="scheduled")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminders_sent: Mapped[int] = mapped_column(Integer, default=0)
    claim_id: Mapped[UUID | None] = mapped_column(nullable=True)
    conversation_id: Mapped[UUID | None] = mapped_column(nullable=True)
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_inspection_schedule_created_by_id", ondelete="SET NULL"),
        nullable=True,
    )
