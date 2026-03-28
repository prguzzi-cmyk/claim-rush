#!/usr/bin/env python

"""Schema for Tag"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


# Shared properties
class TagBase(BaseModel):
    name: str | None = Field(default=None, max_length=50, description="Tag name.")
    description: str | None = Field(default=None, description="Tag description.")

    can_be_removed: bool | None = Field(
        default=True, description="Is the tag can be removed?"
    )


# Properties to receive via API on creation
class TagCreate(TagBase):
    name: str = Field(max_length=50, description="Tag name.")


# Properties to receive via API on update
class TagUpdate(TagBase):
    name: str | None = Field(max_length=50, description="Tag name.")
    can_be_removed: bool | None = Field(description="Is the tag can be removed?")


# Properties to return via API on tag fetch from DB
class TagInDB(TagBase):
    id: UUID | None = Field(description="Id of a tag.")
    slug: str | None = Field(default=None, description="Tag slug.")

    can_be_removed: bool | None = Field(description="Is the tag can be removed?")
    is_removed: bool | None = Field(description="Is the tag removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class Tag(Timestamp, Audit, TagInDB):
    ...
