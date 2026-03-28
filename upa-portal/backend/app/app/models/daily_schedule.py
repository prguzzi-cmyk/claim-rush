#!/usr/bin/env python

"""SQLAlchemy model for the daily schedule table"""

from sqlalchemy import UUID, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import UserTask


class DailySchedule(UserTask):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user_task.id",
            name="fk_daily_schedule_id",
        ),
        primary_key=True,
    )
    schedule_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "schedule.id",
            name="fk_daily_schedule_schedule_id",
        )
    )
    task_type: Mapped[str | None] = mapped_column(String(30))

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "daily_schedule",
    }

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"schedule_id={self.schedule_id!r}, "
            f"title: {self.title!r})"
        )
