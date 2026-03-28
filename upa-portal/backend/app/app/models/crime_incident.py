#!/usr/bin/env python

"""SQLAlchemy model for the crime_incident table"""

from sqlalchemy import Boolean, DateTime, Float, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class CrimeIncident(TimestampMixin, Base):
    data_source: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    incident_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    raw_incident_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    occurred_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reported_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    zip_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    county: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), default="moderate")
    claim_relevance_score: Mapped[float] = mapped_column(Float, default=0.5)
    estimated_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    property_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_freshness: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint(
            "data_source",
            "external_id",
            name="uq_crime_source_ext",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"data_source={self.data_source!r}, "
            f"incident_type={self.incident_type!r})"
        )
