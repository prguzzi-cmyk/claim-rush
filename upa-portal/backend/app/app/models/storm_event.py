#!/usr/bin/env python

"""SQLAlchemy model for the storm_event table"""

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class StormEvent(TimestampMixin, Base):
    event_type: Mapped[str] = mapped_column(String(20), index=True)  # hail, wind, hurricane, lightning
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), index=True)  # low, moderate, high, severe, extreme
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    radius_miles: Mapped[float | None] = mapped_column(Float, nullable=True)
    state: Mapped[str] = mapped_column(String(2), index=True)
    county: Mapped[str] = mapped_column(String(100), index=True)
    zip_codes: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    reported_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Hail-specific
    hail_size_inches: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Wind-specific
    wind_speed_mph: Mapped[float | None] = mapped_column(Float, nullable=True)
    gust_speed_mph: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Hurricane-specific
    hurricane_category: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hurricane_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    track_points: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of {lat, lng}

    # Lightning-specific
    strike_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Dedup / source tracking
    external_id: Mapped[str | None] = mapped_column(String(200), index=True, nullable=True)
    data_source: Mapped[str] = mapped_column(String(20), default="nws", index=True)

    __table_args__ = (
        UniqueConstraint(
            "data_source",
            "external_id",
            name="uq_storm_event_source_external",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"event_type={self.event_type!r}, "
            f"title={self.title!r}, "
            f"state={self.state!r})"
        )
