#!/usr/bin/env python

"""SQLAlchemy model for lead rescue tracking"""

from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class LeadRescueLog(TimestampMixin, Base):
    """Tracks every rescue event when a lead is reassigned through the
    intelligent rescue system.

    A rescue is triggered when:
      - Escalation reaches level >= 4 (Chapter President)
      - 60 minutes pass without meaningful action on the lead
    """

    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey("lead.id", name="fk_rescue_lead_id", ondelete="CASCADE"),
        index=True,
    )
    tracker_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "lead_contact_tracker.id",
            name="fk_rescue_tracker_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    # Agent routing
    original_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_rescue_original_agent", ondelete="SET NULL"),
        nullable=True,
    )
    new_assigned_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_rescue_new_agent", ondelete="SET NULL"),
        nullable=True,
    )

    # Rescue metadata
    rescue_reason: Mapped[str] = mapped_column(
        String(50),
    )  # escalation_cp | escalation_rvp | inactivity_timeout
    score_tier: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )  # high | strong | medium | low
    rescue_level: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )  # rvp | cp
    escalation_level_at_rescue: Mapped[int | None] = mapped_column(
        Integer, nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)

    # Conversion tracking (rescue bonus flags)
    is_converted: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false",
    )
    rvp_rescue: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false",
    )
    cp_rescue: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false",
    )

    # Relationships
    lead = relationship(
        "Lead", foreign_keys=[lead_id], lazy="joined", viewonly=True,
    )
    tracker = relationship(
        "LeadContactTracker", foreign_keys=[tracker_id], lazy="select", viewonly=True,
    )
    original_agent = relationship(
        "User", foreign_keys=[original_agent_id], lazy="joined", viewonly=True,
    )
    new_agent = relationship(
        "User", foreign_keys=[new_assigned_agent_id], lazy="joined", viewonly=True,
    )

    __table_args__ = (
        Index("ix_rescue_log_lead_id", "lead_id"),
        Index("ix_rescue_log_reason", "rescue_reason"),
        Index("ix_rescue_log_converted", "is_converted"),
    )

    def __repr__(self) -> str:
        return (
            f"LeadRescueLog(id={self.id!r}, "
            f"lead_id={self.lead_id!r}, "
            f"rescue_reason={self.rescue_reason!r}, "
            f"score_tier={self.score_tier!r})"
        )
