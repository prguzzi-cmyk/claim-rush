#!/usr/bin/env python

"""SQLAlchemy model for the newsletter file table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import File

if TYPE_CHECKING:
    from app.models import Newsletter


class NewsletterFile(File):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "file.id",
            name="fk_newsletter_file_id",
        ),
        primary_key=True,
    )
    newsletter_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "newsletter.id",
            name="fk_newsletter_file_newsletter_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "newsletter_file",
    }

    # Relationships
    newsletter: Mapped["Newsletter"] = relationship(back_populates="newsletter_files")

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"newsletter_id={self.newsletter_id!r}, "
            f"name: {self.name!r}, "
            f"path: {self.path!r})"
        )
