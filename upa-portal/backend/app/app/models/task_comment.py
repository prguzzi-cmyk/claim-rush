#!/usr/bin/env python

"""SQLAlchemy model for the task comment table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import UserTask


class TaskComment(TimestampMixin, Base):
    comment: Mapped[str]

    # Foreign Keys
    user_task_id: Mapped[UUID] = mapped_column(
        ForeignKey("user_task.id", ondelete="CASCADE")
    )

    # Relationships
    user_task: Mapped["UserTask"] = relationship(
        back_populates="task_comments", lazy="subquery"
    )
