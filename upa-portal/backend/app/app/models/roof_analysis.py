#!/usr/bin/env python

"""SQLAlchemy model for the roof_analyses table"""

import uuid as _uuid

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class RoofAnalysis(TimestampMixin, Base):
    __tablename__ = "roof_analyses"

    # Property identification
    property_id: Mapped[str] = mapped_column(String(100), index=True)
    address: Mapped[str] = mapped_column(String(500))
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(2), index=True)
    zip_code: Mapped[str] = mapped_column(String(10))
    county: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)

    # Roof metadata
    roof_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    roof_age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    roof_size_sqft: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Storm context (optional FK)
    storm_event_id: Mapped[_uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("storm_event.id"), nullable=True)
    storm_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hail_size_inches: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_speed_mph: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Analysis results
    damage_score: Mapped[int] = mapped_column(Integer, default=0)
    damage_label: Mapped[str] = mapped_column(String(20), default="none")
    confidence: Mapped[str] = mapped_column(String(10), default="low")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    indicators: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    analysis_mode: Mapped[str] = mapped_column(String(20), default="rules")

    # Imagery
    image_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    scan_timestamp: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Claim estimate
    claim_range_low: Mapped[float | None] = mapped_column(Float, nullable=True)
    claim_range_high: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_claim_value: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Pipeline status
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    recommended_action: Mapped[str | None] = mapped_column(String(200), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Ownership / outreach
    owner_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    skip_trace_status: Mapped[str] = mapped_column(String(20), default="not_started")
    outreach_status: Mapped[str] = mapped_column(String(20), default="not_started")
    adjuster_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Territory
    territory_id: Mapped[_uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("territory.id"), nullable=True)
    territory_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Batch tracking
    batch_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("property_id", "storm_event_id", name="uq_roof_property_storm"),
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"property_id={self.property_id!r}, "
            f"status={self.status!r}, "
            f"damage_score={self.damage_score!r})"
        )
