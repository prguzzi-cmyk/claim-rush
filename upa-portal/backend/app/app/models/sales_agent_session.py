#!/usr/bin/env python

"""
AI Sales Agent Session Model
==============================
Tracks structured intake/consultation sessions for CRM visibility,
drop-off analysis, and conversion tracking.
"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class SalesAgentSession(TimestampMixin, Base):
    """
    One session per consultation. Stores the full exchange history,
    qualification result, drop-off point, and outcome.
    """

    lead_id: Mapped[str] = mapped_column(String(100))
    client_name: Mapped[str] = mapped_column(String(200))
    client_email: Mapped[str | None] = mapped_column(String(200))
    client_phone: Mapped[str | None] = mapped_column(String(30))

    # Session state
    current_step: Mapped[str] = mapped_column(String(30), default="introduction")
    status: Mapped[str] = mapped_column(String(30), default="active")
    # active, completed, dropped, scheduled_followup
    outcome: Mapped[str | None] = mapped_column(String(50))
    # inspection_scheduled, continued_online, spoke_with_team, not_interested, not_qualified, dropped_off
    drop_off_step: Mapped[str | None] = mapped_column(String(30))

    # Qualification
    qualification_qualified: Mapped[bool | None] = mapped_column(Boolean)
    qualification_severity: Mapped[str | None] = mapped_column(String(30))
    qualification_message: Mapped[str | None] = mapped_column(Text())

    # Conversation data (JSON array of exchanges)
    exchanges: Mapped[dict | None] = mapped_column(JSON)

    # Timestamps
    started_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    # Meeting info (future Zoom/Teams)
    meeting_platform: Mapped[str | None] = mapped_column(String(20))
    meeting_url: Mapped[str | None] = mapped_column(String(500))
    meeting_id: Mapped[str | None] = mapped_column(String(100))

    # Linked records
    portal_lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("client_portal_lead.id", name="fk_sas_portal_lead", ondelete="SET NULL")
    )
    assigned_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_sas_agent", ondelete="SET NULL")
    )
