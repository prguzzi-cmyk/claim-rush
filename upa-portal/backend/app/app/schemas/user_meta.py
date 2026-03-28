#!/usr/bin/env python

"""Schema for User Meta"""

from uuid import UUID

from pydantic import BaseModel, Field


# Shared properties
class UserMetaBase(BaseModel):
    address: str | None = Field(
        default=None, max_length=255, description="Mailing address of the user."
    )
    city: str | None = Field(
        default=None, max_length=50, description="Mailing address city name."
    )
    state: str | None = Field(
        default=None, max_length=50, description="Mailing address state Name."
    )
    zip_code: str | None = Field(
        default=None, max_length=20, description="Mailing address zip code."
    )
    phone_number: str | None = Field(
        default=None, max_length=20, description="Phone number of the user"
    )
    phone_number_extension: str | None = Field(
        default=None, max_length=20, description="Phone number extension of the user"
    )


# Properties to receive via API on creation
class UserMetaCreate(UserMetaBase):
    pass


# Properties to receive via API on update
class UserMetaUpdate(UserMetaBase):
    pass


# Properties to return via API on user fetch from DB
class UserMetaInDB(UserMetaBase):
    id: UUID | None = Field(description="User meta id.")
    avatar: str | None = Field(description="User avatar.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class UserMeta(UserMetaInDB):
    pass
