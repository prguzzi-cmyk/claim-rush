#!/usr/bin/env python

"""Schema for lead contact"""

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# Shared properties
class LeadContactBase(BaseModel):
    full_name: str | None = Field(
        default=None, max_length=100, description="Full name of the person."
    )
    full_name_alt: str | None = Field(
        default=None, max_length=100, description="Full name of the alternate person."
    )
    email: EmailStr | None = Field(
        default=None, description="Email address of the person."
    )
    email_alt: EmailStr | None = Field(
        default=None,
        description="Alternate email address of the person.",
    )
    phone_number: str | None = Field(
        default=None, max_length=20, description="Phone number of the person."
    )
    phone_number_alt: str | None = Field(
        default=None,
        max_length=20,
        description="Alternate phone number of the person.",
    )

    # Contact Address
    address: str | None = Field(
        default=None, max_length=255, description="Address of the person."
    )
    city: str | None = Field(default=None, max_length=50, description="City name.")
    state: str | None = Field(default=None, max_length=50, description="State name.")
    zip_code: str | None = Field(default=None, max_length=20, description="Zip code.")

    # Contact Loss Address
    address_loss: str | None = Field(
        default=None, max_length=255, description="Loss address of the person."
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
class LeadContactCreate(LeadContactBase):
    full_name: str = Field(max_length=100, description="Full name of the person.")
    phone_number: str = Field(max_length=20, description="Phone number of the person.")


# Properties to receive via API on update
class LeadContactUpdate(LeadContactBase):
    ...


# Properties to return via API on lead contact fetch from DB
class LeadContactInDB(LeadContactBase):
    id: UUID | None = Field(default=None, description="Id of the contact.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class LeadContact(LeadContactInDB):
    ...
