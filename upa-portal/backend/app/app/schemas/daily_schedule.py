#!/usr/bin/env python

"""Schema for daily schedule"""

from uuid import UUID

from pydantic import Field

from app.core.enums import TaskType
from app.schemas import Audit, Timestamp
from app.schemas.user_task import (
    UserTaskBase,
    UserTaskCreate,
    UserTaskCreateDB,
    UserTaskInDB,
    UserTaskUpdate,
)


# Shared properties
class DailyScheduleBase(UserTaskBase):
    task_type: TaskType | None = Field(description="Daily schedule type.")


# Properties to receive via API on creation
class DailyScheduleCreate(UserTaskCreate, DailyScheduleBase):
    ...


# Properties for CRUD on creation
class DailyScheduleCreateDB(UserTaskCreateDB, DailyScheduleBase):
    schedule_id: UUID = Field(description="The schedule ID.")


# Properties to receive via API on update
class DailyScheduleUpdate(UserTaskUpdate, DailyScheduleBase):
    ...


# Properties to return via API on daily schedule fetch from DB
class DailyScheduleInDB(UserTaskInDB, DailyScheduleBase):
    schedule_id: UUID = Field(description="The schedule ID.")


# Additional properties to return via API
class DailySchedule(Timestamp, Audit, DailyScheduleInDB):
    ...
