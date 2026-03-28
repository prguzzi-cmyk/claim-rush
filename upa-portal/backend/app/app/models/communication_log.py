#!/usr/bin/env python

"""CommunicationLog model — tracks every email/SMS attempt with delivery status and engagement."""

from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins.timestamp import TimestampMixin


class CommunicationLog(TimestampMixin, Base):
    __tablename__ = "communication_log"

    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("lead.id", name="fk_comm_log_lead_id", ondelete="CASCADE"),
        nullable=True,
    )
    agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_comm_log_agent_id", ondelete="SET NULL"),
        nullable=True,
    )
    channel: Mapped[str] = mapped_column(String(10))  # "email" | "sms"
    purpose: Mapped[str] = mapped_column(String(50))  # "lead_assignment" | "brochure" | "admin_test" etc.
    direction: Mapped[str] = mapped_column(String(10), default="outbound")  # "inbound" | "outbound"
    fire_incident_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("fire_incident.id", name="fk_comm_log_fire_incident_id", ondelete="SET NULL"),
        nullable=True,
    )
    template_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    recipient_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_preview: Mapped[str | None] = mapped_column(String(500), nullable=True)
    send_status: Mapped[str] = mapped_column(String(20), default="pending")
    failure_reason: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    sent_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    clicked_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unsubscribed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_queued_for_quiet_hours: Mapped[bool] = mapped_column(default=False)
    scheduled_send_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_manual_override: Mapped[bool] = mapped_column(default=False)

    # Relationships
    lead = relationship("Lead", foreign_keys=[lead_id], lazy="joined", viewonly=True)
    agent = relationship("User", foreign_keys=[agent_id], lazy="joined", viewonly=True)
    fire_incident = relationship("FireIncident", foreign_keys=[fire_incident_id], lazy="joined", viewonly=True)

    __table_args__ = (
        Index("ix_comm_log_lead_channel", "lead_id", "channel"),
        Index("ix_comm_log_lead_purpose", "lead_id", "purpose"),
        Index("ix_comm_log_send_status", "send_status"),
        Index("ix_comm_log_quiet_hours", "is_queued_for_quiet_hours", "scheduled_send_at"),
        Index("ix_comm_log_recipient_phone", "recipient_phone"),
    )

    def __repr__(self) -> str:
        return (
            f"CommunicationLog(id={self.id!r}, channel={self.channel!r}, "
            f"purpose={self.purpose!r}, send_status={self.send_status!r})"
        )
