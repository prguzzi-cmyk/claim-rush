#!/usr/bin/env python

"""SQLAlchemy model for the file table"""

from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.associations.file_tag import associate_file_tag
from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import Tag


class File(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    name: Mapped[str] = mapped_column(String(255))
    slugged_name: Mapped[str | None] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(150))
    size: Mapped[int] = mapped_column(BigInteger())
    path: Mapped[str]
    description: Mapped[str | None] = mapped_column(Text())
    related_type: Mapped[str] = mapped_column(String(50))
    visibility: Mapped[str] = mapped_column(
        String(20), default="internal", server_default="internal"
    )

    # Table Configuration
    __table_args__ = (
        UniqueConstraint(
            "path",
            name="uq_file_path",
        ),
    )
    __mapper_args__ = {
        "polymorphic_identity": "file",
        "polymorphic_on": "related_type",
    }

    # Relationships
    tags: Mapped[list["Tag"]] = relationship(
        secondary=associate_file_tag,
        backref="files",
        lazy="subquery",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, name: {self.name!r}, "
            f"path: {self.path!r})"
        )
