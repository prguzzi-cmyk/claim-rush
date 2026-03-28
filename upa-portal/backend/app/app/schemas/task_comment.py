#!/usr/bin/env python

"""Schema for Task Comment"""


from uuid import UUID

from pydantic import BaseModel, Field


# Shared properties
class TaskCommentBase(BaseModel):
    comment: str = Field(description="Comment key name.")
    user_task_id: UUID = Field(description="Comment content.")


# Properties to receive via API on creation
class TaskCommentCreate(TaskCommentBase):
    ...


# Properties to receive via API on update
class TaskCommentUpdate(TaskCommentBase):
    ...


# Properties to return via API on permission fetch from DB
class TaskCommentInDB(TaskCommentBase):
    id: UUID

    class Config:
        orm_mode = True


# Additional properties to return via API
class TaskComment(TaskCommentInDB):
    ...
