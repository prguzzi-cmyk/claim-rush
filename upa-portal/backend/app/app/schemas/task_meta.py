#!/usr/bin/env python

"""Schema for Task Meta"""


from typing import Text
from uuid import UUID

from pydantic import BaseModel, Field


# Shared properties
class TaskMetaBase(BaseModel):
    key: str | None = Field(default=None, max_length=50, description="Meta key name.")
    content: Text | None = Field(default=None, description="Meta content.")


# Properties to receive via API on creation
class TaskMetaCreate(TaskMetaBase):
    key: str = Field(max_length=50, description="Meta key name.")
    content: Text = Field(description="Meta content.")


# Properties to receive via API on update
class TaskMetaUpdate(TaskMetaBase):
    key: str | None = Field(max_length=50, description="Meta key name.")
    content: Text | None = Field(description="Meta content.")


# Properties to return via API on task fetch from DB
class TaskMetaInDB(TaskMetaBase):
    id: UUID | None = Field(default=None, description="Id of a task meta.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class TaskMeta(TaskMetaInDB):
    ...
