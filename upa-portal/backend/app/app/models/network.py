#!/usr/bin/env python

"""SQLAlchemy model for the Network table"""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin


class Network(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    title: Mapped[str] = mapped_column(String(255))
    environment: Mapped[str] = mapped_column(String(50))
    summary: Mapped[str] = mapped_column(String(500))
    key_elements: Mapped[str] = mapped_column(Text())
    exploration_type: Mapped[str] = mapped_column(String(20))
    exploration_term: Mapped[str] = mapped_column(String(150))
    is_active: Mapped[bool] = mapped_column(default=True)

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.id!r}, title: {self.title!r})"
