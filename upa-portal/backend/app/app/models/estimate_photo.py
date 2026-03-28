#!/usr/bin/env python

"""SQLAlchemy model for the estimate_photo table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.estimate_project import EstimateProject
    from app.models.estimate_room import EstimateRoom


class EstimatePhoto(TimestampMixin, Base):
    image_url: Mapped[str] = mapped_column(String(500))
    caption: Mapped[str | None] = mapped_column(String(200))
    ai_tags: Mapped[str | None] = mapped_column(Text())
    photo_type: Mapped[str | None] = mapped_column(String(20))

    # Foreign Keys
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "estimate_project.id",
            name="fk_estimate_photo_project_id",
            ondelete="CASCADE",
        ),
        index=True,
    )
    room_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "estimate_room.id",
            name="fk_estimate_photo_room_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # Relationships
    project: Mapped["EstimateProject"] = relationship(
        back_populates="photos",
        viewonly=True,
    )
    room: Mapped["EstimateRoom | None"] = relationship(
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"project_id={self.project_id!r}, "
            f"image_url={self.image_url!r})"
        )
