#!/usr/bin/env python

"""SQLAlchemy model for the estimate_measurement table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.estimate_room import EstimateRoom


class EstimateMeasurement(TimestampMixin, Base):
    length: Mapped[float | None] = mapped_column(Float())
    width: Mapped[float | None] = mapped_column(Float())
    height: Mapped[float | None] = mapped_column(Float())
    square_feet: Mapped[float | None] = mapped_column(Float())
    notes: Mapped[str | None] = mapped_column(Text())

    # Foreign Keys
    room_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "estimate_room.id",
            name="fk_estimate_measurement_room_id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    # Relationships
    room: Mapped["EstimateRoom"] = relationship(
        back_populates="measurements",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"room_id={self.room_id!r}, "
            f"square_feet={self.square_feet!r})"
        )
