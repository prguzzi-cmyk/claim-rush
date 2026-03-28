#!/usr/bin/env python

"""SQLAlchemy model for the property_intelligence table"""

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class PropertyIntelligence(TimestampMixin, Base):
    incident_id: Mapped[UUID] = mapped_column(
        ForeignKey("fire_incident.id", name="fk_property_intel_incident_id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    address: Mapped[str] = mapped_column(String(500))
    owner_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    property_value_estimate: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mortgage_lender: Mapped[str | None] = mapped_column(String(200), nullable=True)
    insurance_probability_score: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    raw_residents: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"incident_id={self.incident_id!r}, "
            f"status={self.status!r})"
        )
