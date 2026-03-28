#!/usr/bin/env python

"""Schema for Permission"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


# Shared properties
class PermissionBase(BaseModel):
    module: str | None = Field(default=None, max_length=50, description="Module name.")
    operation: str | None = Field(
        default=None, max_length=50, description="Operation to perform."
    )


# Properties to receive via API on creation
class PermissionCreate(PermissionBase):
    module: str = Field(max_length=50, description="Module name.")
    operation: str = Field(max_length=50, description="Operation to perform.")


# Properties to receive via Service on creation
class PermissionCreateRepository(PermissionCreate):
    name: str = Field(description="Permission name.")


# Properties to receive via API on update
class PermissionUpdate(PermissionBase):
    pass


# Properties to receive via Service on update
class PermissionUpdateRepository(PermissionUpdate):
    name: str | None = Field(description="Permission name.")


# Minimal properties
class PermissionMinimal(PermissionBase):
    id: UUID | None = Field(description="Id of a permission.")
    name: str | None = Field(description="Permission name.")
    effect: str | None = Field(description="Policy effect.")

    class Config:
        orm_mode = True


# Properties to return via API on permission fetch from DB
class PermissionInDB(PermissionMinimal):
    can_be_removed: bool | None = Field(description="Is the permission can be removed?")
    is_removed: bool | None = Field(description="Is the permission removed?")


# Additional properties to return via API
class Permission(Timestamp, Audit, PermissionInDB):
    pass
