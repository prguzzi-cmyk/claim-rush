#!/usr/bin/env python

"""Schema for Task"""

from typing import Text
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, TaskMeta, TaskMetaCreate, TaskMetaUpdate, Timestamp


# Shared properties
class TaskBase(BaseModel):
    title: str | None = Field(default=None, max_length=255, description="Task title.")
    description: Text | None = Field(default=None, description="Task description.")
    is_active: bool | None = Field(default=None, description="Is task active?")
    estimated_duration: int | None = Field(
        default=None, description="Estimated duration to complete the task."
    )

    task_meta: list[TaskMeta] | None = Field(
        default=None, description="Task related meta object."
    )

    can_be_removed: bool | None = Field(
        default=True, description="Is the task can be removed?"
    )


# Properties to receive via API on creation
class TaskCreate(TaskBase):
    title: str = Field(max_length=255, description="Task title")
    is_active: bool = Field(default=True, description="Is task active?")
    estimated_duration: int = Field(
        description="Estimated duration to complete the task."
    )

    task_meta: list[TaskMetaCreate] | None = Field(
        default=None, min_items=1, description="Task related meta object."
    )


# Properties to receive via API on update
class TaskUpdate(TaskBase):
    task_meta: list[TaskMetaUpdate] | None = Field(
        default=None,
        min_items=1,
        description="Task related meta object. \n\n"
        "_If provided then must have all meta records because "
        "system will delete all existing meta records._",
    )

    can_be_removed: bool | None = Field(description="Is the task can be removed?")
    is_removed: bool | None = Field(default=None, description="Is the task removed?")


# Properties to return via API on permission fetch from DB
class TaskInDB(TaskBase):
    id: UUID | None = Field(description="Id of a task.")
    can_be_removed: bool | None = Field(description="Is the task can be removed?")
    is_removed: bool | None = Field(description="Is the task removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class Task(Timestamp, Audit, TaskInDB):
    pass
