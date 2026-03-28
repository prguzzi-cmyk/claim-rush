#!/usr/bin/env python

"""SQLAlchemy model for the AI intake session table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import IntakeAppointment, Lead, User


class IntakeSession(SoftDeleteMixin, TimestampMixin, Base):
    """Tracks an AI-guided intake conversation with a homeowner."""

    # Homeowner details collected during conversation
    homeowner_name: Mapped[str | None] = mapped_column(String(200))
    property_address: Mapped[str | None] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(200))
    incident_type: Mapped[str | None] = mapped_column(String(100))
    date_of_loss: Mapped[str | None] = mapped_column(DateTime(timezone=True))
    insurance_company: Mapped[str | None] = mapped_column(String(200))
    policy_number: Mapped[str | None] = mapped_column(String(100))

    # Conversation state
    status: Mapped[str] = mapped_column(String(30), default="active")
    conversation_log: Mapped[str | None] = mapped_column(Text())
    current_step: Mapped[str] = mapped_column(String(50), default="greeting")

    # Qualification
    is_qualified: Mapped[bool | None] = mapped_column(Boolean, default=None)
    qualification_reason: Mapped[str | None] = mapped_column(String(500))
    qualification_score: Mapped[float | None] = mapped_column(Float)

    # Linked records
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("lead.id", name="fk_intake_session_lead_id", ondelete="SET NULL")
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_intake_session_user_id", ondelete="SET NULL")
    )

    # Relationships
    lead: Mapped["Lead | None"] = relationship(
        primaryjoin="IntakeSession.lead_id == Lead.id",
        lazy="joined",
        viewonly=True,
    )
    created_by_user: Mapped["User | None"] = relationship(
        primaryjoin="IntakeSession.created_by_user_id == User.id",
        lazy="joined",
        viewonly=True,
    )
    appointments: Mapped[list["IntakeAppointment"]] = relationship(
        back_populates="session",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"homeowner_name={self.homeowner_name!r}, "
            f"status={self.status!r})"
        )
