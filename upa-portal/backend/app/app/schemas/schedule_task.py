#!/usr/bin/env python

"""Schema for Schedule Tasks"""

from uuid import UUID

from pydantic import BaseModel, Field


class ScheduleTaskBase(BaseModel):
    id: UUID | None = Field(description="Id of a task.")

    class Config:
        orm_mode = True


class ScheduleTaskCreate(ScheduleTaskBase):
    id: UUID = Field(description="Id of a task.")


class ScheduleTaskUpdate(ScheduleTaskBase):
    id: UUID = Field(description="Id of a task.")


class ScheduleTask(ScheduleTaskBase):
    ...


class ScheduleTasks(BaseModel):
    tasks: list[ScheduleTask] | None = Field(
        default=None, description="A list consist of tasks UUID."
    )


class ScheduleTasksCreate(ScheduleTasks):
    tasks: list[ScheduleTaskCreate] | None = Field(
        default=None, min_items=1, description="A list consist of tasks UUID."
    )


class ScheduleTasksUpdate(ScheduleTasks):
    tasks: list[ScheduleTaskUpdate] | None = Field(
        default=None, min_items=1, description="A list consist of tasks UUID."
    )


class ScheduleTasksAppend(ScheduleTasks):
    tasks: list[ScheduleTaskCreate] = Field(
        min_items=1, description="A list consist of tasks UUID."
    )


class ScheduleTasksRemove(ScheduleTasks):
    tasks: list[ScheduleTaskCreate] = Field(
        min_items=1, description="A list consist of tasks UUID."
    )
