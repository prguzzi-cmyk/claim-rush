#!/usr/bin/env python

"""Schema for Schedule"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import (
    Audit,
    ScheduleTasks,
    ScheduleTasksCreate,
    ScheduleTasksUpdate,
    Timestamp,
)


# Shared properties
class ScheduleBase(ScheduleTasks, BaseModel):
    title: str | None = Field(
        default=None, max_length=100, description="Schedule title."
    )
    goal: str | None = Field(default=None, max_length=255, description="Schedule goal.")
    day_number: int | None = Field(default=None, description="Schedule day number.")
    is_active: bool | None = Field(default=None, description="Is schedule active?")

    can_be_removed: bool | None = Field(
        default=True, description="Is the schedule can be removed?"
    )


# Properties to receive via API on creation
class ScheduleCreate(ScheduleTasksCreate, ScheduleBase):
    title: str = Field(max_length=100, description="Schedule title.")
    goal: str = Field(max_length=255, description="Schedule goal.")
    day_number: int = Field(description="Schedule day number.")
    is_active: bool | None = Field(default=True, description="Is schedule active?")


# Properties to receive via API on update
class ScheduleUpdate(ScheduleTasksUpdate, ScheduleBase):
    is_removed: bool | None = Field(
        default=None, description="Is the schedule removed?"
    )

    can_be_removed: bool | None = Field(description="Is the schedule can be removed?")


# Properties to return via API on permission fetch from DB
class ScheduleInDB(ScheduleBase):
    id: UUID | None = Field(description="Id of a schedule.")
    can_be_removed: bool | None = Field(description="Is the schedule can be removed?")
    is_removed: bool | None = Field(description="Is the schedule removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class Schedule(Timestamp, Audit, ScheduleInDB):
    ...
