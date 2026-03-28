#!/usr/bin/env python

"""SQLAlchemy model for the schedule table"""

from typing import TYPE_CHECKING

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.associations.schedule_task import associate_schedule_task
from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import Task


class Schedule(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    title: Mapped[str] = mapped_column(String(100))
    goal: Mapped[str] = mapped_column(String(255))
    day_number: Mapped[int]
    is_active: Mapped[bool] = mapped_column(default=True)

    # Table Configuration
    __table_args__ = (UniqueConstraint("day_number", name="uq_schedule_day"),)

    # Relationships
    tasks: Mapped[list["Task"]] = relationship(
        secondary=associate_schedule_task,
        backref="schedules",
        lazy="subquery",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, title: {self.title!r}, "
            f"day_number: {self.day_number!r})"
        )
