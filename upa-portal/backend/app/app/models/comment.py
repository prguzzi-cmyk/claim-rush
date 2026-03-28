#!/usr/bin/env python

"""SQLAlchemy model for the comment table"""


from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin


class Comment(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    text: Mapped[str] = mapped_column(String())
    type: Mapped[str] = mapped_column(String(50))
    visibility: Mapped[str] = mapped_column(
        String(20), default="internal", server_default="internal"
    )

    # Table Configuration
    __mapper_args__ = {
        "polymorphic_identity": "comment",
        "polymorphic_on": "type",
    }

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.id!r}, text: {self.text!r})"
