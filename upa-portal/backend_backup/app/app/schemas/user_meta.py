#!/usr/bin/env python

"""Schema for User Meta"""

from uuid import UUID

from pydantic import BaseModel, Field


# Shared properties
class UserMetaBase(BaseModel):
    address: str | None = Field(default=None, description="Mailing address of the user")
    city: str | None = Field(default=None, description="Mailing address city name")
    state: str | None = Field(default=None, description="Mailing address state Name")
    zip_code: str | None = Field(default=None, description="Mailing address zip code")
    phone_number: str | None = Field(
        default=None, description="Phone number of the user"
    )


# Properties to receive via API on creation
class UserMetaCreate(UserMetaBase):
    ...


# Properties to receive via API on update
class UserMetaUpdate(UserMetaBase):
    ...


# Properties to return via API on user fetch from DB
class UserMetaInDB(UserMetaBase):
    id: UUID | None = Field(default=None, description="Id of the user meta")
    user_id: UUID = Field(description="User id")
    avatar: str | None = None

    class Config:
        orm_mode = True


# Additional properties to return via API
class UserMeta(UserMetaInDB):
    ...
