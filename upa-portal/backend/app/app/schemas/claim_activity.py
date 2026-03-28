#!/usr/bin/env python

"""Schema for Claim Activity"""

from uuid import UUID

from pydantic import Field

from app.core.enums import ClaimActivityType
from app.schemas import Audit, Timestamp
from app.schemas.user_activity import (
    UserActivityBase,
    UserActivityCreate,
    UserActivityInDB,
    UserActivityUpdate,
)


# Shared properties
class ClaimActivityBase(UserActivityBase):
    activity_type: ClaimActivityType | None = Field(
        default=None, description="Claim activity type."
    )
    title: str | None = Field(default=None, description="Claim activity title.")


# Properties to receive via API on creation
class ClaimActivityCreate(UserActivityCreate):
    activity_type: ClaimActivityType = Field(description="Claim activity type.")
    title: str = Field(description="Claim activity title.")


# Properties to receive via API on creation
class ClaimActivityCreateDB(ClaimActivityCreate, UserActivityBase):
    claim_id: UUID = Field(description="The claim ID.")


# Properties to receive via API on update
class ClaimActivityUpdate(UserActivityUpdate, ClaimActivityBase):
    ...


# Properties to return via API on claim activity fetch from DB
class ClaimActivityInDB(ClaimActivityBase, UserActivityInDB):
    claim_id: UUID | None = Field(description="The claim ID.")


# Additional properties to return via API
class ClaimActivity(Timestamp, Audit, ClaimActivityInDB):
    ...
