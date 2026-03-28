#!/usr/bin/env python

"""SQLAlchemy model for the fire_agency table"""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import FireIncident


class FireAgency(TimestampMixin, AuditMixin, Base):
    agency_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    state: Mapped[str | None] = mapped_column(String(2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_polled_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    incidents: Mapped[list["FireIncident"]] = relationship(
        back_populates="agency",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"agency_id={self.agency_id!r}, "
            f"name={self.name!r})"
        )
