#!/usr/bin/env python

"""Schema for follow up"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.tags import FollowUpType
from app.schemas import Audit, Timestamp


# Shared properties
class FollowUpBase(BaseModel):
    type: FollowUpType | None = Field(default=None, description="Follow-up type")
    dated: datetime | None = Field(
        default=None, description="Follow-up creation date and time"
    )
    note: str | None = Field(default=None, description="Note for the follow up")
    next_date: datetime | None = Field(
        default=None, description="Next follow-up date and time"
    )


# Properties to receive via API on creation
class FollowUpCreate(FollowUpBase):
    type: FollowUpType = Field(description="Follow-up type")
    dated: datetime = Field(description="Follow-up creation date and time")
    note: str = Field(description="Note for the follow up")


# Properties to receive via API on update
class FollowUpUpdate(FollowUpBase):
    can_be_removed: bool | None = Field(description="Is that follow-up can be removed?")
    is_removed: bool | None = Field(description="Is follow-up removed?")


# Properties to return via API on user fetch from DB
class FollowUpInDB(FollowUpBase):
    id: UUID | None = Field(description="Follow up id")
    can_be_removed: bool | None = Field(description="Is that follow-up can be removed?")
    is_removed: bool | None = Field(description="Is follow-up removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class FollowUp(Timestamp, Audit, FollowUpInDB):
    ...
