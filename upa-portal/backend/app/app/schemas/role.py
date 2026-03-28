#!/usr/bin/env python

"""Schema for Role"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


# Shared properties
class RoleBase(BaseModel):
    display_name: str | None = Field(
        default=None, max_length=50, description="Role display name."
    )
    can_be_removed: bool | None = Field(
        default=True, description="Is the role removable?"
    )


# Properties to receive via API on creation
class RoleCreate(RoleBase):
    display_name: str = Field(max_length=50, description="Role display name.")


# Properties to receive via Service on creation
class RoleCreateRepository(RoleCreate):
    name: str = Field(max_length=50, description="Role slug name.")


# Properties to receive via API on update
class RoleUpdate(RoleBase):
    can_be_removed: bool | None = Field(description="Is the role removable?")


# Properties to receive via Service on update
class RoleUpdateRepository(RoleUpdate):
    name: str | None = Field(max_length=50, description="Role slug name.")


# Properties to return via API on role fetch from DB
class RoleInDB(RoleBase):
    id: UUID | None = Field(description="Role id.")
    name: str | None = Field(max_length=50, description="Role slug name.")
    can_be_removed: bool | None = Field(description="Is the role can be removed?")
    is_removed: bool | None = Field(description="Is the role removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class Role(Timestamp, Audit, RoleInDB):
    pass


class AppendPermissions(BaseModel):
    permissions: list[UUID] = Field(
        min_items=1,
        description="A list of permissions to be added to role.",
    )


class DetachPermissions(BaseModel):
    permissions: list[UUID] = Field(
        min_items=1,
        description="A list of permissions to be removed from the role.",
    )


class AppendModulePermissions(BaseModel):
    module_name: str = Field(description="Name of the module.")
    read_only: bool | None = Field(
        default=False,
        description="Append read-only permissions. \n\n"
        "_If False, then CRUD permissions will be appended._",
    )
    additional_permissions: list[str] | None = Field(
        default=None, min_items=1, description="A list of additional permissions."
    )
