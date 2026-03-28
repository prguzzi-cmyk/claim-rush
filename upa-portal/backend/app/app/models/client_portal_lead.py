#!/usr/bin/env python

"""SQLAlchemy model for client portal leads — captures leads from the self-service claim flow."""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import SoftDeleteMixin, TimestampMixin


class ClientPortalLead(SoftDeleteMixin, TimestampMixin, Base):
    """
    Lead captured from the client-facing portal flow.
    Tracks the client's journey from photo upload through qualification and scheduling.
    """

    # Contact information
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(30))
    address: Mapped[str | None] = mapped_column(String(500))

    # Claim context
    incident_type: Mapped[str | None] = mapped_column(String(50))   # fire, storm, water, wind, etc.
    claim_number: Mapped[str | None] = mapped_column(String(50))
    photo_count: Mapped[int] = mapped_column(Integer, default=0)
    has_3d_scan: Mapped[bool] = mapped_column(Boolean, default=False)

    # Status tracking
    status: Mapped[str] = mapped_column(String(30), default="new")
    # new → contacted → scheduled → signed → closed
    qualification_status: Mapped[str] = mapped_column(String(30), default="pending")
    # pending → qualified → not_qualified
    source: Mapped[str] = mapped_column(String(50), default="client_portal")
    # client_portal, fire, storm, manual, referral, etc.

    # Engagement tracking
    last_contact_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    next_follow_up_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    follow_up_count: Mapped[int] = mapped_column(Integer, default=0)

    # Appointment
    appointment_date: Mapped[str | None] = mapped_column(String(50))
    appointment_time: Mapped[str | None] = mapped_column(String(20))
    appointment_timezone: Mapped[str | None] = mapped_column(String(50))
    calendar_event_id: Mapped[str | None] = mapped_column(String(200))

    # Qualification details
    qualification_notes: Mapped[str | None] = mapped_column(Text())
    estimated_severity: Mapped[str | None] = mapped_column(String(30))  # low, moderate, high, critical

    # Linked lead (if converted to main lead system)
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("lead.id", name="fk_cpl_lead_id", ondelete="SET NULL")
    )

    # Assigned agent
    assigned_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_cpl_assigned_agent", ondelete="SET NULL")
    )


class ClientPortalFollowUp(TimestampMixin, Base):
    """
    Scheduled follow-up actions for client portal leads.
    Processed by a Celery beat task that scans for due follow-ups.
    """

    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey("client_portal_lead.id", name="fk_cpfu_lead_id", ondelete="CASCADE")
    )

    # Follow-up details
    follow_up_type: Mapped[str] = mapped_column(String(30))   # reminder, re_engagement, reinforcement
    channel: Mapped[str] = mapped_column(String(20))           # sms, email, voice
    message_key: Mapped[str] = mapped_column(String(100))
    message_text: Mapped[str | None] = mapped_column(Text())

    # Scheduling
    scheduled_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    # Status
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending → sent → delivered → failed → cancelled
    failure_reason: Mapped[str | None] = mapped_column(Text())

    # Relationships
    lead: Mapped["ClientPortalLead"] = relationship(
        "ClientPortalLead", foreign_keys=[lead_id], lazy="joined"
    )
