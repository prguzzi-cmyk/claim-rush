#!/usr/bin/env python

"""SQLAlchemy model for the estimate_room table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.estimate_line_item import EstimateLineItem
    from app.models.estimate_measurement import EstimateMeasurement
    from app.models.estimate_photo import EstimatePhoto
    from app.models.estimate_project import EstimateProject


class EstimateRoom(TimestampMixin, Base):
    name: Mapped[str] = mapped_column(String(100))
    room_type: Mapped[str | None] = mapped_column(String(50))
    floor_level: Mapped[str | None] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text())

    # Foreign Keys
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "estimate_project.id",
            name="fk_estimate_room_project_id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    # Relationships
    project: Mapped["EstimateProject"] = relationship(
        back_populates="rooms",
        viewonly=True,
    )
    line_items: Mapped[list["EstimateLineItem"]] = relationship(
        back_populates="room",
        cascade="all, delete-orphan",
    )
    measurements: Mapped[list["EstimateMeasurement"]] = relationship(
        back_populates="room",
        cascade="all, delete-orphan",
    )
    photos: Mapped[list["EstimatePhoto"]] = relationship(
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"project_id={self.project_id!r}, "
            f"name={self.name!r})"
        )
