#!/usr/bin/env python

"""SQLAlchemy model for intake appointment bookings"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import IntakeSession, User


class IntakeAppointment(SoftDeleteMixin, TimestampMixin, Base):
    """An appointment booked during AI intake (inspection, Zoom, Teams)."""

    appointment_type: Mapped[str] = mapped_column(String(30))  # inspection, zoom, teams
    scheduled_at: Mapped[str | None] = mapped_column(DateTime(timezone=True))
    homeowner_name: Mapped[str | None] = mapped_column(String(200))
    homeowner_email: Mapped[str | None] = mapped_column(String(200))
    homeowner_phone: Mapped[str | None] = mapped_column(String(30))
    property_address: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text())
    status: Mapped[str] = mapped_column(String(30), default="scheduled")

    # Foreign keys
    session_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("intake_session.id", name="fk_intake_appt_session_id", ondelete="CASCADE")
    )
    assigned_to: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_intake_appt_assigned_to", ondelete="SET NULL")
    )

    # Relationships
    session: Mapped["IntakeSession | None"] = relationship(
        back_populates="appointments",
    )
    assigned_user: Mapped["User | None"] = relationship(
        primaryjoin="IntakeAppointment.assigned_to == User.id",
        lazy="joined",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"type={self.appointment_type!r}, "
            f"status={self.status!r})"
        )
