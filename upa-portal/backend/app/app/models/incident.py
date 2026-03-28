#!/usr/bin/env python

"""SQLAlchemy model for the unified incident intelligence table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    pass


class Incident(TimestampMixin, Base):
    """Unified incident model aggregating fire, storm, crime, and weather incidents."""

    # Core identification
    incident_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Location
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(2), nullable=True, index=True)
    zip_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Incident details
    occurred_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), default="moderate", index=True)
    property_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Scoring
    priority_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    damage_probability: Mapped[float] = mapped_column(Float, default=0.5)
    location_density: Mapped[float] = mapped_column(Float, default=0.5)

    # Lead conversion
    lead_converted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    lead_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    conversion_skipped_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    # UPA → ACI Funnel
    routing_bucket: Mapped[str | None] = mapped_column(
        String(20), nullable=True, index=True,
    )  # ACI_LEAD | UPA_OUTREACH
    contact_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True, index=True,
    )  # new | sent | engaged | opted_out | aci_ready | closed
    opt_out: Mapped[bool] = mapped_column(Boolean, default=False)
    template_profile: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Source reference (links back to source-specific table)
    source_record_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "source",
            "external_id",
            name="uq_incident_source_external",
        ),
        Index(
            "ix_incident_dedup",
            "incident_type",
            "address",
            "occurred_at",
        ),
        Index(
            "ix_incident_geo",
            "latitude",
            "longitude",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"incident_type={self.incident_type!r}, "
            f"source={self.source!r}, "
            f"address={self.address!r})"
        )
