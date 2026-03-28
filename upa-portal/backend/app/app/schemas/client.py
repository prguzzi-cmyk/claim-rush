#!/usr/bin/env python

"""Schema for Client"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, validator

from app.core.enums import RefTypes
from app.schemas import Audit, Timestamp
from app.schemas.user import UserMinimal
from app.utils.common import generate_ref_string


class ClientMinimal(BaseModel):
    full_name: str | None = Field(
        default=None, max_length=100, description="Full name of the client."
    )
    email: EmailStr | None = Field(
        default=None, description="Email address of the client."
    )
    phone_number: str | None = Field(
        default=None, max_length=20, description="Phone number of the client."
    )

    class Config:
        orm_mode = True


# Shared properties
class ClientBase(ClientMinimal):
    full_name_alt: str | None = Field(
        default=None, max_length=100, description="Full name of the alternate client."
    )
    email_alt: EmailStr | None = Field(
        default=None,
        description="Alternate email address of the client.",
    )
    phone_number_alt: str | None = Field(
        default=None,
        max_length=20,
        description="Alternate phone number of the client.",
    )
    organization: str | None = Field(
        default=None, max_length=255, description="Organization of the client."
    )

    # Contact Address
    address: str | None = Field(
        default=None, max_length=255, description="Address of the client."
    )
    city: str | None = Field(default=None, max_length=50, description="City name.")
    state: str | None = Field(default=None, max_length=50, description="State name.")
    zip_code: str | None = Field(default=None, max_length=20, description="Zip code.")

    belongs_to: UUID | None = Field(
        default=None, description="Client belongs to an agent."
    )
    can_be_removed: bool | None = Field(
        default=True, description="Is the client can be removed?"
    )


# Properties to receive via API on creation
class ClientCreate(ClientBase):
    full_name: str = Field(max_length=100, description="Full name of the client.")

    # Relationships
    belongs_to: UUID = Field(description="Client belongs to an agent.")


# Properties to receive via API on update
class ClientUpdate(ClientBase):
    ...


# Properties to return via API on client fetch from DB
class ClientInDB(ClientBase):
    id: UUID | None = Field(description="Client ID.")
    ref_number: int | None = Field(description="Client reference number.")
    ref_string: str | None = Field(description="Client reference string.")
    can_be_removed: bool | None = Field(description="Is that client can be removed?")
    is_removed: bool | None = Field(description="Is the client removed?")

    @validator("ref_string", always=True)
    def generate_ref_string(cls, value: Any, values: Any) -> str:
        return generate_ref_string(RefTypes.CLIENT, str(values["ref_number"]))

    # Relationships
    belonged_user: UserMinimal | None = Field(
        description="Client belonged user details."
    )

    class Config:
        orm_mode = True


# Additional properties to return via API
class Client(Timestamp, Audit, ClientInDB):
    ...
