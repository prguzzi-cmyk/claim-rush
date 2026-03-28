#!/usr/bin/env python

"""Schema for contact"""

from uuid import UUID

from pydantic import BaseModel, Field


# Shared properties
class ContactBase(BaseModel):
    full_name: str | None = Field(default=None, description="Full name of the person")
    full_name_alt: str | None = Field(
        default=None, description="Full name of the alternate person"
    )
    email: str | None = Field(default=None, description="Email address of the person")
    email_alt: str | None = Field(
        default=None, description="Alternate email address of the person"
    )
    phone_number: str | None = Field(
        default=None, description="Phone number of the person"
    )
    phone_number_alt: str | None = Field(
        default=None, description="Alternate phone number of the person"
    )

    # Contact Address
    address: str | None = Field(default=None, description="Address of the person")
    city: str | None = Field(default=None, description="City name")
    state: str | None = Field(default=None, description="State name")
    zip_code: str | None = Field(default=None, description="Zip code")

    # Contact Loss Address
    address_loss: str | None = Field(
        default=None, description="Loss address of the person"
    )
    city_loss: str | None = Field(default=None, description="Loss city name")
    state_loss: str | None = Field(default=None, description="Loss state name")
    zip_code_loss: str | None = Field(default=None, description="Loss zip code")


# Properties to receive via API on creation
class ContactCreate(ContactBase):
    full_name: str = Field(description="Full name of the person")
    email: str = Field(description="Email address of the person")
    phone_number: str = Field(description="Phone number of the person")

    # Contact Address
    address: str = Field(description="Address of the person")
    city: str = Field(description="City name")
    state: str = Field(description="State name")
    zip_code: str = Field(description="Zip code")


# Properties to receive via API on update
class ContactUpdate(ContactBase):
    ...


# Properties to return via API on user fetch from DB
class ContactInDB(ContactBase):
    id: UUID | None = Field(default=None, description="Id of the contact")

    class Config:
        orm_mode = True


# Additional properties to return via API
class Contact(ContactInDB):
    ...
