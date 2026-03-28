#!/usr/bin/env python

"""Schema for Permission"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# Shared properties
class PermissionBase(BaseModel):
    module: str | None = Field(default=None, description="Module Name")
    operation: str | None = Field(default=None, description="Operation to perform")


# Properties to receive via API on creation
class PermissionCreate(PermissionBase):
    module: str = Field(description="Module Name")
    operation: str = Field(description="Operation to perform")


# Properties to receive via API on update
class PermissionUpdate(PermissionBase):
    ...


# Properties to return via API on permission fetch from DB
class PermissionInDB(PermissionBase):
    id: UUID
    name: str
    can_be_removed: bool
    is_removed: bool
    created_at: datetime
    updated_at: datetime | None

    class Config:
        orm_mode = True


# Additional properties to return via API
class Permission(PermissionInDB):
    ...
