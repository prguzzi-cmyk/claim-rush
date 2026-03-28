#!/usr/bin/env python

"""Schema for claim contact"""

from uuid import UUID

from pydantic import BaseModel, Field


# Shared properties
class ClaimContactBase(BaseModel):
    # Claim Contact Loss Address
    address_loss: str | None = Field(
        default=None, max_length=255, description="Loss address."
    )
    city_loss: str | None = Field(
        default=None, max_length=50, description="Loss city name."
    )
    state_loss: str | None = Field(
        default=None, max_length=50, description="Loss state name."
    )
    zip_code_loss: str | None = Field(
        default=None, max_length=20, description="Loss zip code."
    )


# Properties to receive via API on creation
class ClaimContactCreate(ClaimContactBase):
    ...


# Properties to receive via API on update
class ClaimContactUpdate(ClaimContactBase):
    ...


# Properties to return via API on claim contact fetch from DB
class ClaimContactInDB(ClaimContactBase):
    id: UUID | None = Field(default=None, description="Id of the contact.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class ClaimContact(ClaimContactInDB):
    ...
