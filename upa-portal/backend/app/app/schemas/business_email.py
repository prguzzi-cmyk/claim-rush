#!/usr/bin/env python

"""Schema for Business email"""

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# Shared properties
class BusinessEmailBase(BaseModel):
    first_name: str | None = Field(
        default=None, max_length=50, description="First name for email address."
    )
    last_name: str | None = Field(
        default=None, max_length=50, description="Last name for email address."
    )
    username: str | None = Field(
        default=None, max_length=75, description="Username for email address."
    )
    email: EmailStr | None = Field(default=None, description="Business email address.")
    is_active: bool | None = Field(
        default=None, description="Status of the email address."
    )


# Properties to receive via API on Incoming Email
class BusinessEmailIncoming(BaseModel):
    sender: EmailStr = Field(description="Sender email address.")
    recipient: EmailStr = Field(description="Recipient email address.")
    subject: str = Field(description="Email subject.")


# Properties to receive via API on Email Pipe Forwarder
class BusinessEmailPipeCreate(BaseModel):
    email: str = Field(description="Email address.")
    script_path: str = Field(description="Email pipe script path.")
    domain: str | None = Field(description="Domain name.")


# Properties to receive via API on creation
class BusinessEmailCreate(BusinessEmailBase):
    username: str = Field(max_length=75, description="Username for email address.")
    password: str = Field(description="Email password.")


# Properties to receive via API on update
class BusinessEmailUpdate(BusinessEmailBase):
    pass


# Properties to return via API on Business Email fetch from DB
class BusinessEmailInDB(BusinessEmailBase):
    id: UUID | None = Field(description="Id of a business email.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class BusinessEmail(BusinessEmailInDB):
    pass


# Minimal Business Email attributes
class BusinessEmailMinimal(BaseModel):
    email: EmailStr | None = Field(default=None, description="Business email address.")

    class Config:
        orm_mode = True
