#!/usr/bin/env python

"""Schema for User"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas import UserMeta, UserMetaBase
from app.schemas.role import Role as RoleSchema


# Shared properties
class UserAudit(BaseModel):
    first_name: str | None = Field(description="First name of the user")
    last_name: str | None = Field(description="Last name of the user")


class UserBase(BaseModel):
    first_name: str | None = Field(default=None, description="First name of the user")
    last_name: str | None = Field(default=None, description="Last name of the user")
    email: EmailStr | None = Field(
        default=None, description="Email address of the user"
    )
    user_meta: UserMetaBase | None = Field(default=None, description="User meta object")


# Properties to receive via API on creation
class UserCreate(UserBase):
    first_name: str = Field(description="First name of the user")
    last_name: str = Field(description="Last name of the user")
    email: EmailStr = Field(description="Email address of the user")
    password: str = Field(description="Login password for the user")
    is_active: bool | None = Field(default=True, description="Status of the user")
    can_be_removed: bool | None = Field(
        default=True, description="Is the user can be removed?"
    )
    role_id: UUID = Field(description="Role id of the user")


# Properties to receive via API on update
class UserUpdate(UserBase):
    password: str | None = Field(
        default=None, description="Login password for the user"
    )
    is_active: bool | None = Field(default=None, description="Status of the user")
    can_be_removed: bool | None = Field(
        default=None, description="Is the user can be removed?"
    )
    is_removed: bool | None = Field(default=None, description="Is the user removed?")
    role_id: UUID | None = Field(default=None, description="Role id of the user")


# Properties to receive via API on own user update
class UserUpdateMe(UserBase):
    password: str | None = Field(
        default=None, description="Login password for the user"
    )


# Properties to return via API on user fetch from DB
class UserInDBBase(UserBase):
    id: UUID | None = Field(default=None, description="Id of the user")
    role_id: UUID = Field(description="Role id of the user")
    is_active: bool | None = Field(default=None, description="Status of the user")
    can_be_removed: bool | None = Field(
        default=None, description="Is the user can be removed?"
    )
    is_removed: bool | None = Field(default=None, description="Is the user removed?")
    user_meta: UserMeta
    created_at: datetime = Field(description="User record creation date and time")
    updated_at: datetime | None = Field(
        default=None, description="User record update date and time"
    )

    class Config:
        orm_mode = True


# Additional properties to return via API
class User(UserInDBBase):
    role: RoleSchema | None = Field(default=None, description="Role object of the user")


# Additional properties stored in DB
class UserInDB(UserInDBBase):
    hashed_password: str
    can_be_removed: bool
