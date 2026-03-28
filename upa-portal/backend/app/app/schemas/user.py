#!/usr/bin/env python

"""Schema for User"""

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas import (
    Audit,
    PermissionMinimal,
    RoleInDB,
    Timestamp,
    UserMeta,
    UserMetaBase,
)


# Shared properties
class UserMinimal(BaseModel):
    first_name: str | None = Field(
        default=None, max_length=50, description="First name of the user."
    )
    last_name: str | None = Field(
        default=None, max_length=50, description="Last name of the user."
    )
    email: EmailStr | None = Field(
        default=None, description="Email address of the user."
    )

    class Config:
        orm_mode = True


# User Minimal with a user ID
class UserMinimalId(UserMinimal):
    id: UUID | None = Field(description="Id of the user.")


# Shared properties
class UserBase(UserMinimal):
    parent_id: UUID | None = Field(description="Parent user ID.")
    manager_id: UUID | None = Field(description="Manager user ID.")
    operating_mode: str | None = Field(
        default="neutral",
        max_length=20,
        description="Operating mode: neutral, aci, or upa.",
    )
    user_meta: UserMetaBase | None = Field(
        default=None, description="User meta object."
    )


# Properties to receive via API on creation
class UserCreate(UserBase):
    first_name: str = Field(max_length=50, description="First name of the user.")
    last_name: str = Field(max_length=50, description="Last name of the user.")
    email: EmailStr = Field(description="Email address of the user.")
    password: str = Field(description="Login password for the user.")
    is_active: bool | None = Field(default=True, description="Status of the user.")
    can_be_removed: bool | None = Field(
        default=True, description="Is the user can be removed?"
    )
    is_accepting_leads: bool | None = Field(
        default=True, description="Whether the user is accepting new lead assignments."
    )
    daily_lead_limit: int | None = Field(
        default=None, description="Max leads per day. None means unlimited."
    )

    role_id: UUID = Field(description="Role id of the user.")


# Properties to receive via API on update
class UserUpdate(UserBase):
    password: str | None = Field(description="Login password for the user.")
    is_active: bool | None = Field(description="Status of the user.")
    can_be_removed: bool | None = Field(description="Is the user can be removed?")
    is_removed: bool | None = Field(description="Is the user removed?")
    is_accepting_leads: bool | None = Field(
        default=None, description="Whether the user is accepting new lead assignments."
    )
    daily_lead_limit: int | None = Field(
        default=None, description="Max leads per day. None means unlimited."
    )

    role_id: UUID | None = Field(description="Role id of the user.")


# Properties to receive via API on own user update
class UserUpdateMe(UserBase):
    password: str | None = Field(description="Login password for the user.")


# Properties to return via API on user fetch from DB
class UserInDBBase(UserBase):
    id: UUID | None = Field(description="Id of the user.")
    is_active: bool | None = Field(description="Status of the user.")
    can_be_removed: bool | None = Field(description="Is the user can be removed?")
    is_removed: bool | None = Field(description="Is the user removed?")
    operating_mode: str | None = Field(
        default="neutral",
        description="Operating mode: neutral, aci, or upa.",
    )
    is_accepting_leads: bool | None = Field(
        default=True, description="Whether the user is accepting new lead assignments."
    )
    daily_lead_limit: int | None = Field(
        default=None, description="Max leads per day. None means unlimited."
    )

    parent: UserMinimal | None = Field(description="Parent detail.")
    manager: UserMinimal | None = Field(description="Manager detail.")
    user_meta: UserMeta | None = Field(description="User meta object.")
    role: RoleInDB | None = Field(description="User role detail.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class User(Timestamp, Audit, UserInDBBase):
    pass


# Additional properties to return via API
class UserProfile(Timestamp, Audit, UserInDBBase):
    permissions: list[PermissionMinimal] | None = Field(
        description="Permissions assigned to a user."
    )


# Lead assigned user properties to return via API
class UserAssignedToLead(UserBase):
    user_meta: UserMeta | None = Field(description="User meta object.")

    class Config:
        orm_mode = True


# Claim assigned user properties to return via API
class UserAssignedToClaim(UserAssignedToLead):
    pass


# Additional properties stored in DB
class UserInDB(UserInDBBase):
    hashed_password: str
    can_be_removed: bool


class UsersByRole(BaseModel):
    name: str | None = Field(description="Name of the role.")
    display_name: str | None = Field(description="Display name of the role.")
    users_count: int | None = Field(description="Number of users has this role.")

    class Config:
        orm_mode = True
