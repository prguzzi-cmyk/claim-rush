#!/usr/bin/env python

"""SQLAlchemy model for the voice_campaign table"""

from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import SoftDeleteMixin, TimestampMixin


class VoiceCampaign(SoftDeleteMixin, TimestampMixin, Base):
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft")
    script_template: Mapped[str | None] = mapped_column(Text(), nullable=True)

    # Filters
    lead_source_filter: Mapped[str | None] = mapped_column(String(30), nullable=True)
    territory_state_filter: Mapped[str | None] = mapped_column(String(2), nullable=True)
    incident_type_filter: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Call window
    call_window_start: Mapped[str] = mapped_column(String(5), default="09:00", server_default="09:00")
    call_window_end: Mapped[str] = mapped_column(String(5), default="17:00", server_default="17:00")
    call_window_timezone: Mapped[str] = mapped_column(
        String(50), default="America/New_York", server_default="America/New_York"
    )

    # Retry settings
    max_retries: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    retry_delay_minutes: Mapped[int] = mapped_column(Integer, default=120, server_default="120")
    max_calls_per_day: Mapped[int] = mapped_column(Integer, default=100, server_default="100")

    # Stats
    total_leads_targeted: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_calls_placed: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_calls_answered: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_appointments_booked: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Timestamps
    launched_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # FK
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_voice_campaign_created_by_id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    created_by = relationship(
        "User",
        primaryjoin="VoiceCampaign.created_by_id == User.id",
        lazy="joined",
        viewonly=True,
    )
    calls = relationship(
        "VoiceCallLog",
        primaryjoin="VoiceCampaign.id == VoiceCallLog.campaign_id",
        lazy="select",
        viewonly=True,
    )
