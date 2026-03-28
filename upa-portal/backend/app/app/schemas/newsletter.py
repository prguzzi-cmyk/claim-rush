#!/usr/bin/env python

"""Schema for Newsletter"""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Tags, TagsCreate, TagsUpdate, Timestamp


# Shared properties
class NewsletterBase(Tags, BaseModel):
    title: str | None = Field(
        default=None, max_length=255, description="Newsletter title."
    )
    content: str | None = Field(default=None, description="Newsletter content.")
    publication_date: date | None = Field(
        default=None, description="Newsletter publication date."
    )
    is_featured: bool | None = Field(
        default=None, description="Is it a featured newsletter?"
    )

    can_be_removed: bool | None = Field(
        default=True, description="Is the newsletter can be removed?"
    )


# Properties to receive via API on creation
class NewsletterCreate(TagsCreate, NewsletterBase):
    title: str = Field(max_length=255, description="Newsletter title.")
    is_featured: bool = Field(default=False, description="Is it a featured newsletter?")


# Properties to receive via API on update
class NewsletterUpdate(TagsUpdate, NewsletterBase):
    can_be_removed: bool | None = Field(description="Is the newsletter can be removed?")


# Properties to return via API on newsletter fetch from DB
class NewsletterInDB(NewsletterBase):
    id: UUID | None = Field(description="Id of a newsletter.")

    can_be_removed: bool | None = Field(description="Is the newsletter can be removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class Newsletter(Timestamp, Audit, NewsletterInDB):
    ...
