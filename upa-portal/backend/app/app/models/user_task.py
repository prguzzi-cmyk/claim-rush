#!/usr/bin/env python

"""SQLAlchemy model for the user task table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import User


class UserTask(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text())
    due_date: Mapped[Date | None] = mapped_column(Date())
    priority: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(default=True)
    start_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    completion_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    type: Mapped[str] = mapped_column(String(50))

    # Foreign Keys
    assignee_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_user_task_assignee_id",
            ondelete="CASCADE",
        )
    )

    # Table Configuration
    __mapper_args__ = {
        "polymorphic_identity": "user_task",
        "polymorphic_on": "type",
    }

    # Relationships
    user: Mapped["User"] = relationship(
        primaryjoin="UserTask.assignee_id == User.id",
        lazy="subquery",
        viewonly=True,
    )
    # task_comments: Mapped[list["TaskComment"]] = relationship(
    #     back_populates="user_task", lazy="subquery", cascade="all, delete"
    # )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, title: {self.title!r}, "
            f"status: {self.status!r}, assignee_id: {self.assignee_id!r})"
        )
