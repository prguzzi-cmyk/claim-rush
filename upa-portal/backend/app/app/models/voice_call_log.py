#!/usr/bin/env python

"""SQLAlchemy model for the voice_call_log table"""

from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class VoiceCallLog(TimestampMixin, Base):
    campaign_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("voice_campaign.id", name="fk_voice_call_log_campaign_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("lead.id", name="fk_voice_call_log_lead_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lead_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone_number: Mapped[str] = mapped_column(String(20))
    call_sid: Mapped[str | None] = mapped_column(String(100), nullable=True)

    status: Mapped[str] = mapped_column(String(30), default="pending", server_default="pending")
    outcome: Mapped[str | None] = mapped_column(String(50), nullable=True)

    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    transcript_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    transcript_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    transcript_summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recording_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    started_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    retry_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    cost_cents: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_voice_call_log_agent_id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    campaign = relationship(
        "VoiceCampaign",
        primaryjoin="VoiceCallLog.campaign_id == VoiceCampaign.id",
        lazy="joined",
        viewonly=True,
    )
    lead = relationship(
        "Lead",
        primaryjoin="VoiceCallLog.lead_id == Lead.id",
        lazy="joined",
        viewonly=True,
    )
    agent = relationship(
        "User",
        primaryjoin="VoiceCallLog.agent_id == User.id",
        lazy="joined",
        viewonly=True,
    )

    __table_args__ = (
        Index("ix_voice_call_log_status", "status"),
        Index("ix_voice_call_log_outcome", "outcome"),
    )
