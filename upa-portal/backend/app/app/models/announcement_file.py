#!/usr/bin/env python

"""SQLAlchemy model for the announcement file table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import File

if TYPE_CHECKING:
    from app.models import Announcement


class AnnouncementFile(File):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "file.id",
            name="fk_announcement_file_id",
        ),
        primary_key=True,
    )
    announcement_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "announcement.id",
            name="fk_announcement_file_announcement_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "announcement_file",
    }

    # Relationships
    announcement: Mapped["Announcement"] = relationship(
        back_populates="announcement_files"
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"announcement_id={self.announcement_id!r}, "
            f"name: {self.name!r}, "
            f"path: {self.path!r})"
        )
