#!/usr/bin/env python

"""SQLAlchemy model for the task meta table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models import Task


class TaskMeta(Base):
    key: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(Text())

    # Foreign Keys
    task_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "task.id",
            name="fk_task_meta_task_id",
            ondelete="CASCADE",
        )
    )

    # Relationships
    task: Mapped["Task"] = relationship(
        back_populates="task_meta",
        lazy="subquery",
    )

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.id!r}, key: {self.key!r})"
