#!/usr/bin/env python

"""MessageTemplate model — reusable SMS/email/voice templates for the Communications Hub."""

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins.timestamp import TimestampMixin


class MessageTemplate(TimestampMixin, Base):
    __tablename__ = "message_template"

    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(50))  # fire_incident, storm_damage, claim_followup, appointment_confirmation
    channel: Mapped[str] = mapped_column(String(10))  # sms, email, voice
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)  # nullable for sms
    body: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)
    is_removed: Mapped[bool] = mapped_column(default=False)
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_msg_template_created_by_id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="joined", viewonly=True)

    def __repr__(self) -> str:
        return (
            f"MessageTemplate(id={self.id!r}, name={self.name!r}, "
            f"category={self.category!r}, channel={self.channel!r})"
        )
