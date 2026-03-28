#!/usr/bin/env python

"""SQLAlchemy model for lead contact tracking and escalation state machine"""

from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class LeadContactTracker(TimestampMixin, Base):
    """Tracks AI outbound call status and escalation state for a lead.

    One tracker per lead (unique constraint on lead_id). Supports fire, hail,
    storm, and other lead types as a reusable contact engine.
    """

    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey("lead.id", name="fk_lct_lead_id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    territory_id: Mapped[UUID] = mapped_column(
        ForeignKey("territory.id", name="fk_lct_territory_id", ondelete="CASCADE"),
        index=True,
    )
    lead_type: Mapped[str] = mapped_column(String(30))

    # AI Call fields
    ai_call_status: Mapped[str] = mapped_column(
        String(30), default="pending", server_default="pending",
    )  # pending | initiated | ringing | connected | no_answer | voicemail | failed | completed | skipped
    ai_call_sid: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ai_call_started_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    ai_call_ended_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    ai_call_result: Mapped[str | None] = mapped_column(
        String(30), nullable=True,
    )  # interested | not_interested | voicemail_left | no_answer | failed
    ai_call_transcript_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
    )
    qualification_data_json: Mapped[str | None] = mapped_column(
        Text(), nullable=True,
    )  # JSON blob storing structured qualification answers from voice AI

    # Escalation state
    current_escalation_level: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1",
    )  # 1=Agent1, 2=Agent2, 3=Agent3, 4=ChapterPresident, 5=HomeOffice, 6=StatePool
    current_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_lct_current_agent_id", ondelete="SET NULL"),
        nullable=True,
    )
    escalation_started_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Contact status
    contact_status: Mapped[str] = mapped_column(
        String(30), default="new", server_default="new",
    )  # new | ai_call_initiated | connected_live | transferred | no_answer |
    # voicemail_left | sms_sent | email_sent | escalated | queued_quiet_hours |
    # closed_signed | closed_not_interested

    # Resolution
    is_resolved: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false",
    )
    resolved_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    resolution_type: Mapped[str | None] = mapped_column(
        String(30), nullable=True,
    )  # transferred | voicemail_fallback | exhausted | manual_close

    # Relationships
    lead = relationship(
        "Lead", foreign_keys=[lead_id], lazy="joined", viewonly=True,
    )
    territory = relationship(
        "Territory", foreign_keys=[territory_id], lazy="joined", viewonly=True,
    )
    current_agent = relationship(
        "User", foreign_keys=[current_agent_id], lazy="joined", viewonly=True,
    )
    escalation_attempts = relationship(
        "EscalationAttempt",
        back_populates="tracker",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="EscalationAttempt.escalation_level",
    )

    __table_args__ = (
        Index("ix_lct_contact_status", "contact_status"),
        Index("ix_lct_resolved", "is_resolved"),
        Index("ix_lct_escalation_level", "current_escalation_level", "is_resolved"),
    )

    def __repr__(self) -> str:
        return (
            f"LeadContactTracker(id={self.id!r}, "
            f"lead_id={self.lead_id!r}, "
            f"contact_status={self.contact_status!r}, "
            f"escalation_level={self.current_escalation_level!r})"
        )
