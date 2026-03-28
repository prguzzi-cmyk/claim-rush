#!/usr/bin/env python

"""Schema for Announcement"""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import AnnouncementActivityInDB, Audit, Timestamp


# Shared properties
class AnnouncementBase(BaseModel):
    title: str | None = Field(
        default=None, max_length=255, description="Announcement title."
    )
    content: str | None = Field(default=None, description="Announcement content.")
    announcement_date: date | None = Field(
        default=None, description="Announcement publication date."
    )
    expiration_date: date | None = Field(
        default=None, description="Announcement expiration date."
    )

    can_be_removed: bool | None = Field(
        default=True, description="Is the announcement can be removed?"
    )


# Properties to receive via API on creation
class AnnouncementCreate(AnnouncementBase):
    title: str = Field(max_length=255, description="Announcement title.")
    announcement_date: date = Field(
        default=date.today(),
        description="Announcement publication date. _Default will be today date._",
    )


# Properties to receive via API on update
class AnnouncementUpdate(AnnouncementBase):
    can_be_removed: bool | None = Field(
        description="Is the announcement can be removed?"
    )


# Properties to return via API on announcement fetch from DB
class AnnouncementInDB(AnnouncementBase):
    id: UUID | None = Field(description="Id of a announcement.")

    can_be_removed: bool | None = Field(
        description="Is the announcement can be removed?"
    )

    announcement_activities: list[AnnouncementActivityInDB] | None = Field(
        description="The announcement activities."
    )

    class Config:
        orm_mode = True


# Additional properties to return via API
class Announcement(Timestamp, Audit, AnnouncementInDB):
    ...
