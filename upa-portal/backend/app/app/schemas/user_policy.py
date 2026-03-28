#!/usr/bin/env python

"""Schema for User Policy"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import (
    Audit,
    PolicyPermission,
    PolicyPermissionCreate,
    PolicyPermissionUpdate,
    Timestamp,
    UserMinimal,
)


# Shared properties
class UserPolicyBase(BaseModel):
    user_id: UUID | None = Field(default=None, description="User Id for the policy.")


# Properties to receive via API on creation
class UserPolicyCreate(BaseModel):
    permissions: list[PolicyPermissionCreate] = Field(
        description="A list of permissions for the policy."
    )


# Properties to receive via API on creation
class UserPolicyCreateInDB(UserPolicyCreate):
    user_id: UUID = Field(description="User Id for the policy.")


# Properties to receive via API on update
class UserPolicyUpdate(BaseModel):
    permissions: list[PolicyPermissionUpdate] = Field(
        description="A list of permissions for the policy.\n\n"
        "_Note: Please provide a full list of permissions because "
        "it will remove already assigned permissions._"
    )


# Properties to return via API on user policy fetch from DB
class UserPolicyInDB(UserPolicyBase):
    id: UUID | None = Field(description="Id of a user policy.")
    permissions: list[PolicyPermission] | None = Field(
        description="Permissions attached to the policy."
    )
    user: UserMinimal | None = Field(description="User details.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class UserPolicy(Timestamp, Audit, UserPolicyInDB):
    pass
