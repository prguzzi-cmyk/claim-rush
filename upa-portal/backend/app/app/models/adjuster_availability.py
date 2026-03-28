#!/usr/bin/env python

"""SQLAlchemy models for adjuster availability and blocked slots"""

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class AdjusterAvailability(TimestampMixin, Base):
    adjuster_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_adjuster_availability_adjuster_id", ondelete="CASCADE"),
        unique=True,
    )
    available_days: Mapped[str] = mapped_column(String(20), default="[1,2,3,4,5]")
    start_hour: Mapped[int] = mapped_column(Integer, default=8)
    end_hour: Mapped[int] = mapped_column(Integer, default=17)

    blocked_slots: Mapped[list["AdjusterBlockedSlot"]] = relationship(
        back_populates="availability",
        cascade="all, delete-orphan",
        lazy="joined",
    )


class AdjusterBlockedSlot(TimestampMixin, Base):
    availability_id: Mapped[UUID] = mapped_column(
        ForeignKey("adjuster_availability.id", name="fk_adjuster_blocked_slot_availability_id", ondelete="CASCADE"),
    )
    date: Mapped[str] = mapped_column(String(10))
    start_time: Mapped[str] = mapped_column(String(5))
    end_time: Mapped[str] = mapped_column(String(5))
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    availability: Mapped["AdjusterAvailability"] = relationship(
        back_populates="blocked_slots",
    )
