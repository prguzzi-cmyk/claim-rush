#!/usr/bin/env python

"""SQLAlchemy model for the newsletter table"""

from typing import TYPE_CHECKING

from sqlalchemy import Date, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.associations.newsletter_tag import associate_newsletter_tag
from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import NewsletterFile, Tag


class Newsletter(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str | None] = mapped_column(Text())
    publication_date: Mapped[Date | None] = mapped_column(Date())
    is_featured: Mapped[bool] = mapped_column(default=False)

    # Relationships
    tags: Mapped[list["Tag"]] = relationship(
        secondary=associate_newsletter_tag,
        backref="newsletters",
        lazy="subquery",
    )
    newsletter_files: Mapped[list["NewsletterFile"]] = relationship(
        back_populates="newsletter",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, title: {self.title!r}, "
            f"publication_date: {self.publication_date!r})"
        )
