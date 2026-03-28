#!/usr/bin/env python

"""VoiceScript model — AI voice call scripts for the Communications Hub."""

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins.timestamp import TimestampMixin


class VoiceScript(TimestampMixin, Base):
    __tablename__ = "voice_script"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(String(50))  # fire_incident, storm_damage, claim_followup, appointment_confirmation
    script_text: Mapped[str] = mapped_column(Text)
    greeting: Mapped[str] = mapped_column(Text)
    closing: Mapped[str] = mapped_column(Text)
    objection_handling: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    is_removed: Mapped[bool] = mapped_column(default=False)
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_voice_script_created_by_id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="joined", viewonly=True)

    def __repr__(self) -> str:
        return (
            f"VoiceScript(id={self.id!r}, name={self.name!r}, "
            f"category={self.category!r})"
        )
