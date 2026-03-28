#!/usr/bin/env python

"""SQLAlchemy model for the claim_zone_lead_tracker table."""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.lead import Lead
    from app.models.territory import Territory


class ClaimZoneLeadTracker(TimestampMixin, Base):
    """Tracks which claim zones have had auto-leads generated (prevents duplicates)."""

    zone_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String(30))
    county: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(10), nullable=True)
    priority: Mapped[str | None] = mapped_column(String(5), nullable=True)
    claim_probability: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Foreign Keys
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("lead.id", name="fk_czlt_lead_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    territory_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("territory.id", name="fk_czlt_territory_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    lead: Mapped["Lead | None"] = relationship(lazy="joined", viewonly=True)
    territory: Mapped["Territory | None"] = relationship(lazy="joined", viewonly=True)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"zone_id={self.zone_id!r}, event_type={self.event_type!r})"
        )
