#!/usr/bin/env python

"""Schema for Announcement Activity"""

from uuid import UUID

from pydantic import Field

from app.core.enums import AnnouncementActivityType
from app.schemas import Audit, Timestamp
from app.schemas.user_activity import (
    UserActivityBase,
    UserActivityCreate,
    UserActivityInDB,
    UserActivityUpdate,
)


# Shared properties
class AnnouncementActivityBase(UserActivityBase):
    activity_type: AnnouncementActivityType | None = Field(
        default=None, description="Announcement activity type."
    )


# Properties to receive via API on creation
class AnnouncementActivityCreate(UserActivityCreate):
    activity_type: AnnouncementActivityType = Field(
        description="Announcement activity type."
    )


# Properties to receive via API on creation
class AnnouncementActivityCreateDB(AnnouncementActivityCreate, UserActivityBase):
    announcement_id: UUID = Field(description="The announcement ID.")


# Properties to receive via API on update
class AnnouncementActivityUpdate(UserActivityUpdate, AnnouncementActivityBase):
    ...


# Properties to return via API on announcement activity fetch from DB
class AnnouncementActivityInDB(AnnouncementActivityBase, UserActivityInDB):
    announcement_id: UUID | None = Field(description="The announcement ID.")


# Additional properties to return via API
class AnnouncementActivity(Timestamp, Audit, AnnouncementActivityInDB):
    ...
