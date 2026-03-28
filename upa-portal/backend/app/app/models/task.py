#!/usr/bin/env python

"""SQLAlchemy model for the task table"""

from typing import TYPE_CHECKING

from sqlalchemy import Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, EqMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import TaskMeta


class Task(EqMixin, SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text())
    is_active: Mapped[bool] = mapped_column(default=True)
    estimated_duration: Mapped[int]

    # Table Configuration
    __table_args__ = (
        Index(
            "ix_task_title",
            func.lower(title),
            unique=True,
        ),
    )

    # Relationships
    task_meta: Mapped[list["TaskMeta"]] = relationship(
        back_populates="task",
        lazy="subquery",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, title: {self.title!r}, "
            f"estimated_duration: {self.estimated_duration!r})"
        )
