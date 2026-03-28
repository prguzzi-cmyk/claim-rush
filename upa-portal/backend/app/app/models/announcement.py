#!/usr/bin/env python

"""SQLAlchemy model for the announcement table"""

from typing import TYPE_CHECKING

from sqlalchemy import Date, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import AnnouncementActivity, AnnouncementFile


class Announcement(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str | None] = mapped_column(Text())
    announcement_date: Mapped[Date | None] = mapped_column(Date())
    expiration_date: Mapped[Date | None] = mapped_column(Date())

    # Relationships
    announcement_files: Mapped[list["AnnouncementFile"]] = relationship(
        back_populates="announcement",
        viewonly=True,
    )
    announcement_activities: Mapped[list["AnnouncementActivity"]] = relationship(
        back_populates="announcement",
        viewonly=True,
        lazy="subquery",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, title: {self.title!r}, "
            f"announcement_date: {self.announcement_date!r})"
        )
