#!/usr/bin/env python

"""SQLAlchemy model for the announcement activity table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import UserActivity

if TYPE_CHECKING:
    from app.models import Announcement


class AnnouncementActivity(UserActivity):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user_activity.id",
            name="fk_announcement_activity_id",
        ),
        primary_key=True,
    )
    announcement_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "announcement.id",
            name="fk_announcement_activity_announcement_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "announcement",
    }

    # Relationships
    announcement: Mapped["Announcement"] = relationship(
        back_populates="announcement_activities"
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"announcement_id={self.announcement_id!r}, "
            f"timestamp: {self.timestamp!r}, "
            f"activity_type: {self.activity_type!r})"
        )
