#!/usr/bin/env python

"""Schema for Partnership"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


# Shared properties
class PartnershipBase(BaseModel):
    title: str | None = Field(
        default=None, max_length=255, description="Partnership title."
    )
    target: str | None = Field(
        default=None, max_length=255, description="Partnership target."
    )
    mission: str | None = Field(default=None, description="Partnership mission.")
    key_elements: str | None = Field(
        default=None, description="Partnership key elements."
    )
    search_term: str | None = Field(
        default=None, max_length=150, description="Partnership search term."
    )
    is_active: bool | None = Field(default=None, description="Is Partnership active?")

    can_be_removed: bool | None = Field(
        default=True, description="Is the Partnership can be removed?"
    )


# Properties to receive via API on creation
class PartnershipCreate(PartnershipBase):
    title: str = Field(max_length=255, description="Partnership title.")
    target: str = Field(max_length=255, description="Partnership target.")
    mission: str = Field(description="Partnership mission.")
    key_elements: str = Field(description="Partnership key elements.")
    search_term: str = Field(max_length=150, description="Partnership search term.")
    is_active: bool | None = Field(default=True, description="Is Partnership active?")


# Properties to receive via API on update
class PartnershipUpdate(PartnershipBase):
    can_be_removed: bool | None = Field(
        description="Is the Partnership can be removed?"
    )


# Properties to return via API on Partnership fetch from DB
class PartnershipInDB(PartnershipBase):
    id: UUID | None = Field(description="Id of a Partnership.")
    can_be_removed: bool | None = Field(
        description="Is the Partnership can be removed?"
    )
    is_removed: bool | None = Field(description="Is the Partnership removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class Partnership(Timestamp, Audit, PartnershipInDB):
    ...
