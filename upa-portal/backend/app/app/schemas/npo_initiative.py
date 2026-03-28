#!/usr/bin/env python

"""Schema for NPO Initiative"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


# Shared properties
class NPOInitiativeBase(BaseModel):
    title: str | None = Field(
        default=None, max_length=255, description="NPO Initiative title."
    )
    target: str | None = Field(
        default=None, max_length=255, description="NPO Initiative target."
    )
    mission: str | None = Field(default=None, description="NPO Initiative mission.")
    key_elements: str | None = Field(
        default=None, description="NPO Initiative key elements."
    )
    search_term: str | None = Field(
        default=None, max_length=150, description="NPO Initiative search term."
    )
    is_active: bool | None = Field(
        default=None, description="Is NPO Initiative active?"
    )

    can_be_removed: bool | None = Field(
        default=True, description="Is the NPO Initiative can be removed?"
    )


# Properties to receive via API on creation
class NPOInitiativeCreate(NPOInitiativeBase):
    title: str = Field(max_length=255, description="NPO Initiative title.")
    target: str = Field(max_length=255, description="NPO Initiative target.")
    mission: str = Field(description="NPO Initiative mission.")
    key_elements: str = Field(description="NPO Initiative key elements.")
    search_term: str = Field(max_length=150, description="NPO Initiative search term.")
    is_active: bool | None = Field(
        default=True, description="Is NPO Initiative active?"
    )


# Properties to receive via API on update
class NPOInitiativeUpdate(NPOInitiativeBase):
    can_be_removed: bool | None = Field(
        description="Is the NPO Initiative can be removed?"
    )


# Properties to return via API on NpoInitiative fetch from DB
class NPOInitiativeInDB(NPOInitiativeBase):
    id: UUID | None = Field(description="Id of a NPO Initiative.")
    can_be_removed: bool | None = Field(
        description="Is the NPO Initiative can be removed?"
    )
    is_removed: bool | None = Field(description="Is the NPO Initiative removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class NPOInitiative(Timestamp, Audit, NPOInitiativeInDB):
    ...
