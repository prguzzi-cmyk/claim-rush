#!/usr/bin/env python

"""Schema for User Activity"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import UserActivityType
from app.schemas import Audit, Timestamp


# Shared properties
class UserActivityBase(BaseModel):
    user_id: UUID | None = Field(default=None, description="The user ID.")
    timestamp: datetime | None = Field(
        default=None,
        description="Timestamp when activity occurred.",
    )
    activity_type: UserActivityType | None = Field(
        default=None, description="Activity type."
    )
    details: str | None = Field(
        default=None, description="Additional details for the activity."
    )


# Properties to receive via API on creation
class UserActivityCreate(BaseModel):
    activity_type: UserActivityType = Field(description="Activity type.")
    details: str | None = Field(
        default=None, description="Additional details for the activity."
    )


# Properties to receive via API on update
class UserActivityUpdate(BaseModel):
    details: str | None = Field(
        default=None, description="Additional details for the activity."
    )


# Properties to return via API on user activity fetch from DB
class UserActivityInDB(UserActivityBase):
    id: UUID | None = Field(description="Activity ID.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class UserActivity(Timestamp, Audit, UserActivityInDB):
    ...
