#!/usr/bin/env python

"""Schema for claim business email"""

from uuid import UUID

from pydantic import Field

from app.schemas.business_email import (
    BusinessEmailBase,
    BusinessEmailCreate,
    BusinessEmailInDB,
    BusinessEmailMinimal,
    BusinessEmailUpdate,
)


# Shared properties
class ClaimBusinessEmailBase(BusinessEmailBase):
    pass


# Properties to receive via API on creation
class ClaimBusinessEmailCreate(BusinessEmailCreate):
    claim_id: UUID = Field(description="The claim ID.")


# Properties to receive via API on update
class ClaimBusinessEmailUpdate(BusinessEmailUpdate, ClaimBusinessEmailBase):
    pass


# Properties to return via API on claim business email fetch from DB
class ClaimBusinessEmailInDB(BusinessEmailInDB, ClaimBusinessEmailBase):
    claim_id: UUID | None = Field(description="The claim ID.")


# Additional properties to return via API
class ClaimBusinessEmail(ClaimBusinessEmailInDB):
    pass


# Minimal Claim Business Email attributes
class ClaimBusinessEmailMinimal(BusinessEmailMinimal):
    class Config:
        orm_mode = True
