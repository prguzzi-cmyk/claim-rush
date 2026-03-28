#!/usr/bin/env python

"""Schema for Role"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# Shared properties
class RoleBase(BaseModel):
    name: str | None = Field(default=None, description="Role Name")
    display_name: str | None = Field(default=None, description="Role display name")
    can_be_removed: bool | None = Field(
        default=True, description="Is the role removable?"
    )


# Properties to receive via API on creation
class RoleCreate(RoleBase):
    display_name: str = Field(description="Role display name")


# Properties to receive via API on update
class RoleUpdate(RoleBase):
    ...


# Properties to return via API on role fetch from DB
class RoleInDB(RoleBase):
    id: UUID
    name: str
    display_name: str
    can_be_removed: bool
    is_removed: bool
    created_at: datetime
    updated_at: datetime | None

    class Config:
        orm_mode = True


# Additional properties to return via API
class Role(RoleInDB):
    ...
