#!/usr/bin/env python

"""Schema for Policy Permission"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import PolicyEffect


# Shared properties
class PolicyPermissionBase(BaseModel):
    permission_id: UUID | None = Field(default=None, description="The permission ID.")
    effect: PolicyEffect | None = Field(default=None, description="The policy effect.")


# Properties to receive via API on creation
class PolicyPermissionCreate(PolicyPermissionBase):
    permission_id: UUID = Field(description="The permission ID.")
    effect: PolicyEffect = Field(
        default=PolicyEffect.PERMIT, description="The policy effect."
    )


# Properties to receive via API on creation
class PolicyPermissionCreateInDB(PolicyPermissionBase):
    policy_id: UUID = Field(description="The policy ID.")
    permission_id: UUID = Field(description="The permission ID.")
    effect: PolicyEffect = Field(
        default=PolicyEffect.PERMIT, description="The policy effect."
    )


# Properties to receive via API on update
class PolicyPermissionUpdate(PolicyPermissionBase):
    permission_id: UUID = Field(description="The permission ID.")
    effect: PolicyEffect = Field(
        default=PolicyEffect.PERMIT, description="The policy effect."
    )


# Properties to receive via API on creation
class PolicyPermissionUpdateInDB(PolicyPermissionBase):
    policy_id: UUID = Field(description="The policy ID.")
    permission_id: UUID = Field(description="The permission ID.")
    effect: PolicyEffect = Field(
        default=PolicyEffect.PERMIT, description="The policy effect."
    )


# Properties to return via API on policy permission fetch from DB
class PolicyPermissionInDB(PolicyPermissionBase):
    class Config:
        orm_mode = True


# Additional properties to return via API
class PolicyPermission(PolicyPermissionInDB):
    ...
