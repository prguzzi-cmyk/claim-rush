#!/usr/bin/env python

"""SQLAlchemy model for lead delivery logging"""

from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class LeadDeliveryLog(TimestampMixin, Base):
    """Tracks every delivery attempt (SMS/email) for a lead distribution."""

    distribution_history_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "lead_distribution_history.id",
            name="fk_delivery_log_distribution_id",
            ondelete="CASCADE",
        ),
        index=True,
    )
    agent_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_delivery_log_agent_id", ondelete="CASCADE"),
        index=True,
    )
    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey("lead.id", name="fk_delivery_log_lead_id", ondelete="CASCADE"),
        index=True,
    )
    channel: Mapped[str] = mapped_column(
        String(10),
    )  # "sms" | "email"
    delivery_status: Mapped[str] = mapped_column(
        String(20), default="pending",
    )  # pending | sent | delivered | failed
    sms_sent_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    email_sent_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    twilio_message_sid: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
    )
    delivery_error: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
    )

    # Relationships (read-only for queries)
    distribution_history = relationship(
        "LeadDistributionHistory",
        foreign_keys=[distribution_history_id],
        lazy="joined",
        viewonly=True,
    )
    agent = relationship(
        "User", foreign_keys=[agent_id], lazy="joined", viewonly=True,
    )
    lead = relationship(
        "Lead", foreign_keys=[lead_id], lazy="joined", viewonly=True,
    )

    __table_args__ = (
        Index("ix_delivery_log_lead_channel", "lead_id", "channel"),
    )

    def __repr__(self) -> str:
        return (
            f"LeadDeliveryLog(id={self.id!r}, "
            f"channel={self.channel!r}, "
            f"delivery_status={self.delivery_status!r}, "
            f"agent_id={self.agent_id!r})"
        )
