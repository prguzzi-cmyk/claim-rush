#!/usr/bin/env python

"""SQLAlchemy model for individual escalation attempts"""

from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class EscalationAttempt(TimestampMixin, Base):
    """Logs each individual attempt in an escalation chain."""

    tracker_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "lead_contact_tracker.id",
            name="fk_esc_attempt_tracker_id",
            ondelete="CASCADE",
        ),
        index=True,
    )
    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey("lead.id", name="fk_esc_attempt_lead_id", ondelete="CASCADE"),
        index=True,
    )
    agent_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_esc_attempt_agent_id", ondelete="CASCADE"),
        index=True,
    )
    escalation_level: Mapped[int] = mapped_column(Integer)
    escalation_label: Mapped[str] = mapped_column(
        String(30),
    )  # agent_1 | agent_2 | agent_3 | chapter_president | home_office | state_pool

    # Transfer attempt
    transfer_status: Mapped[str] = mapped_column(
        String(30), default="pending", server_default="pending",
    )  # pending | initiated | ringing | answered | no_answer | busy | failed | timeout
    transfer_call_sid: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
    )
    transfer_attempted_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    transfer_answered_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    transfer_ended_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Notification channels used
    sms_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    in_app_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    timeout_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Relationships
    tracker = relationship(
        "LeadContactTracker",
        back_populates="escalation_attempts",
    )
    lead = relationship(
        "Lead", foreign_keys=[lead_id], lazy="joined", viewonly=True,
    )
    agent = relationship(
        "User", foreign_keys=[agent_id], lazy="joined", viewonly=True,
    )

    __table_args__ = (
        Index("ix_esc_attempt_tracker_level", "tracker_id", "escalation_level"),
    )

    def __repr__(self) -> str:
        return (
            f"EscalationAttempt(id={self.id!r}, "
            f"tracker_id={self.tracker_id!r}, "
            f"level={self.escalation_level!r}, "
            f"label={self.escalation_label!r})"
        )
