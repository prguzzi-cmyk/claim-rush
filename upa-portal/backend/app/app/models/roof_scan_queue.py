#!/usr/bin/env python

"""SQLAlchemy model for the roof_scan_queue table"""

import uuid as _uuid

from sqlalchemy import Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class RoofScanQueue(TimestampMixin, Base):
    __tablename__ = "roof_scan_queue"

    # Property identification
    property_id: Mapped[str] = mapped_column(String(100), index=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    # Zone / storm linkage
    zone_id: Mapped[str] = mapped_column(String(100), index=True)
    storm_event_id: Mapped[_uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storm_event.id"), nullable=True
    )

    # Scan pipeline status
    scan_status: Mapped[str] = mapped_column(
        String(30), default="pending", index=True
    )  # pending, queued, scanning, completed, error

    # Link to created RoofAnalysis record
    roof_analysis_id: Mapped[_uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roof_analyses.id"), nullable=True
    )

    # Discovery source
    source: Mapped[str] = mapped_column(String(30), default="osm")  # osm, grid_scan, manual

    # Building metadata
    building_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    building_area_sqft: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("property_id", "zone_id", name="uq_scan_property_zone"),
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"property_id={self.property_id!r}, "
            f"zone_id={self.zone_id!r}, "
            f"scan_status={self.scan_status!r})"
        )
