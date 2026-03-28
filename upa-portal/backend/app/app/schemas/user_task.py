#!/usr/bin/env python

"""Schema for User Task"""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import Priority, TaskStatus
from app.schemas import Audit, Timestamp


# Shared properties
class UserTaskBase(BaseModel):
    title: str | None = Field(default=None, max_length=255, description="Task title.")
    description: str | None = Field(default=None, description="Task description.")
    due_date: date | None = Field(default=None, description="Task due date.")
    priority: Priority | None = Field(default=None, description="Task priority.")

    is_active: bool | None = Field(default=None, description="Is task active?")


# Properties to receive via API on creation
class UserTaskCreate(UserTaskBase):
    title: str = Field(max_length=255, description="Task title.")
    priority: Priority = Field(default=Priority.MEDIUM, description="Task priority.")
    is_active: bool = Field(default=True, description="Is task active?")


# Properties for CRUD on creation
class UserTaskCreateDB(UserTaskCreate):
    status: TaskStatus = Field(description="Task status.")
    assignee_id: UUID = Field(description="Task assignee ID.")


# Properties to receive via API on update
class UserTaskUpdate(UserTaskBase):
    title: str | None = Field(max_length=255, description="Task title.")
    status: TaskStatus | None = Field(description="Task status.")
    can_be_removed: bool | None = Field(description="Is the task can be removed?")


# Properties to return via API on user task fetch from DB
class UserTaskInDB(UserTaskBase):
    id: UUID | None = Field(description="ID of a task.")
    status: TaskStatus | None = Field(title="Task Status", description="Task status.")
    start_date: datetime | None = Field(description="Task start date and time.")
    completion_date: datetime | None = Field(
        description="Task completion date and time."
    )

    assignee_id: UUID | None = Field(description="Task assignee ID.")

    can_be_removed: bool | None = Field(description="Is the task can be removed?")
    is_removed: bool | None = Field(description="Is the task removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class UserTask(Timestamp, Audit, UserTaskInDB):
    ...
