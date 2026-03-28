#!/usr/bin/env python

"""SQLAlchemy model for the tag table"""

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import AuditMixin, EqMixin, SoftDeleteMixin, TimestampMixin


class Tag(EqMixin, SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    name: Mapped[str] = mapped_column(String(50))
    slug: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text())

    # Table Configuration
    __table_args__ = (UniqueConstraint("slug", name="uq_tag_slug"),)

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name: {self.name!r}, slug: {self.slug!r})"
