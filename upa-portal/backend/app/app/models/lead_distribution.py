#!/usr/bin/env python

"""SQLAlchemy models for the lead distribution engine"""

from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class LeadDistributionHistory(TimestampMixin, Base):
    """Logs every lead distribution event for auditing and rotation tracking."""

    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey("lead.id", name="fk_lead_dist_lead_id", ondelete="CASCADE"),
        index=True,
    )
    territory_id: Mapped[UUID] = mapped_column(
        ForeignKey("territory.id", name="fk_lead_dist_territory_id", ondelete="CASCADE"),
        index=True,
    )
    assigned_agent_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_lead_dist_agent_id", ondelete="CASCADE"),
        index=True,
    )
    lead_type: Mapped[str] = mapped_column(
        String(30), index=True,
    )  # fire, hail, storm, lightning, flood, theft_vandalism
    assignment_reason: Mapped[str | None] = mapped_column(
        String(30), nullable=True, index=True,
    )  # cp_priority, rotation, national_queue
    distributed_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )

    # Relationships (read-only for queries)
    lead = relationship("Lead", foreign_keys=[lead_id], lazy="joined", viewonly=True)
    territory = relationship("Territory", foreign_keys=[territory_id], lazy="joined", viewonly=True)
    assigned_agent = relationship("User", foreign_keys=[assigned_agent_id], lazy="joined", viewonly=True)

    __table_args__ = (
        Index("ix_lead_dist_type_territory", "lead_type", "territory_id"),
    )

    def __repr__(self) -> str:
        return (
            f"LeadDistributionHistory(id={self.id!r}, "
            f"lead_type={self.lead_type!r}, "
            f"territory_id={self.territory_id!r}, "
            f"assigned_agent_id={self.assigned_agent_id!r})"
        )


class TerritoryRotationState(Base):
    """Tracks the round-robin pointer for fire lead rotation per county territory."""

    territory_id: Mapped[UUID] = mapped_column(
        ForeignKey("territory.id", name="fk_rotation_territory_id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    last_assigned_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_rotation_last_agent_id", ondelete="SET NULL"),
        nullable=True,
    )
    rotation_index: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0",
    )

    territory = relationship("Territory", foreign_keys=[territory_id], lazy="joined", viewonly=True)

    def __repr__(self) -> str:
        return (
            f"TerritoryRotationState(territory_id={self.territory_id!r}, "
            f"rotation_index={self.rotation_index!r})"
        )


class StateRotation(Base):
    """Tracks the round-robin pointer for state-based lead routing.

    One row per state (lowercase, trimmed).  ``rotation_index`` is the
    position in the ordered list of eligible agents that should receive the
    *next* lead for this state.
    """

    state_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True,
    )
    last_assigned_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_state_rotation_last_agent_id", ondelete="SET NULL"),
        nullable=True,
    )
    rotation_index: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0",
    )

    def __repr__(self) -> str:
        return (
            f"StateRotation(state_code={self.state_code!r}, "
            f"rotation_index={self.rotation_index!r})"
        )
