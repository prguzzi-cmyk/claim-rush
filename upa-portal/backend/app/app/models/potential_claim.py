#!/usr/bin/env python

"""SQLAlchemy model for the potential_claim table.

Each row represents a property-level potential claim identified by the
Claim Zone → Lead Generation pipeline.  This is a SEPARATE artifact from the
Storm Prediction Engine; it stores enriched property records with claim
probability, estimated value, and a reference back to the source zone.
"""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.lead import Lead
    from app.models.territory import Territory


class PotentialClaim(TimestampMixin, Base):
    """A property-level potential claim generated from a P1/P2 claim zone."""

    # Source zone reference
    zone_id: Mapped[str] = mapped_column(String(100), index=True)

    # Property details
    property_address: Mapped[str] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str] = mapped_column(String(2), index=True)
    zip_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    county: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    property_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Claim prediction fields
    event_type: Mapped[str] = mapped_column(String(30), index=True)
    claim_probability: Mapped[int] = mapped_column(Integer)  # 0-100
    estimated_claim_value: Mapped[float] = mapped_column(Float, default=0)
    event_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    severity: Mapped[str] = mapped_column(String(10))  # P1, P2

    # Pipeline status
    status: Mapped[str] = mapped_column(
        String(30), default="pending", index=True
    )  # pending, lead_created, assigned, dismissed

    # Foreign keys
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("lead.id", name="fk_potential_claim_lead_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    territory_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "territory.id",
            name="fk_potential_claim_territory_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    storm_event_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "storm_event.id",
            name="fk_potential_claim_storm_event_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # Relationships
    lead: Mapped["Lead | None"] = relationship(lazy="joined", viewonly=True)
    territory: Mapped["Territory | None"] = relationship(lazy="joined", viewonly=True)

    __table_args__ = (
        Index("ix_potential_claim_zone_address", "zone_id", "property_address"),
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"zone_id={self.zone_id!r}, "
            f"property_address={self.property_address!r}, "
            f"status={self.status!r})"
        )
