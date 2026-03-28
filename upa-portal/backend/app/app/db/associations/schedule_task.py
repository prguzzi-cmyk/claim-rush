#!/usr/bin/env python

"""Association of Schedule and Task"""

from sqlalchemy import Column, ForeignKey, Table

from app.db.base_class import Base

associate_schedule_task = Table(
    "schedule_task",
    Base.metadata,
    Column(
        "schedule_id",
        ForeignKey(
            "schedule.id",
            name="fk_schedule_task_schedule_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
    Column(
        "task_id",
        ForeignKey(
            "task.id",
            name="fk_schedule_task_task_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
)
