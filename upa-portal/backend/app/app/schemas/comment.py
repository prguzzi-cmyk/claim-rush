#!/usr/bin/env python

"""Schema for Comment"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


# Shared properties
class CommentBase(BaseModel):
    text: str | None = Field(default=None, description="Comment text.")
    visibility: str | None = Field(default="internal", description="Comment visibility: internal or external.")

    can_be_removed: bool | None = Field(
        default=True, description="Is the comment can be removed?"
    )


# Properties to receive via API on creation
class CommentCreate(CommentBase):
    text: str = Field(description="Comment text.")


# Properties to receive via API on update
class CommentUpdate(CommentBase):
    text: str | None = Field(description="Comment text.")
    can_be_removed: bool | None = Field(description="Is the comment can be removed?")


# Properties to return via API on comment fetch from DB
class CommentInDB(CommentBase):
    id: UUID | None = Field(description="Id of a comment.")

    can_be_removed: bool | None = Field(description="Is the comment can be removed?")
    is_removed: bool | None = Field(description="Is the comment removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class Comment(Timestamp, Audit, CommentInDB):
    ...
