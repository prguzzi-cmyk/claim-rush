#!/usr/bin/env python

"""Schema for Network"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import ExplorationType, NetworkEnv
from app.schemas import Audit, Timestamp


# Shared properties
class NetworkBase(BaseModel):
    title: str | None = Field(
        default=None, max_length=255, description="Network title."
    )
    environment: NetworkEnv | None = Field(
        default=None, description="Network environment."
    )
    summary: str | None = Field(
        default=None, max_length=500, description="Network summary."
    )
    key_elements: str | None = Field(default=None, description="Network key elements.")
    exploration_type: ExplorationType | None = Field(
        default=None, description="Network exploration type."
    )
    exploration_term: str | None = Field(
        default=None, max_length=150, description="Network exploration term."
    )
    is_active: bool | None = Field(default=None, description="Is Network active?")

    can_be_removed: bool | None = Field(
        default=True, description="Is the Network can be removed?"
    )


# Properties to receive via API on creation
class NetworkCreate(NetworkBase):
    title: str = Field(max_length=255, description="Network title.")
    environment: NetworkEnv = Field(description="Network environment.")
    summary: str = Field(max_length=500, description="Network summary.")
    key_elements: str = Field(description="Network key elements.")
    exploration_type: ExplorationType = Field(description="Network exploration type.")
    exploration_term: str = Field(
        max_length=150, description="Network exploration term."
    )
    is_active: bool | None = Field(default=True, description="Is Network active?")


# Properties to receive via API on update
class NetworkUpdate(NetworkBase):
    can_be_removed: bool | None = Field(description="Is the Network can be removed?")


# Properties to return via API on Network fetch from DB
class NetworkInDB(NetworkBase):
    id: UUID | None = Field(description="Id of a Network.")
    can_be_removed: bool | None = Field(description="Is the Network can be removed?")
    is_removed: bool | None = Field(description="Is the Network removed?")

    class Config:
        orm_mode = True


# Additional properties to return via API
class Network(Timestamp, Audit, NetworkInDB):
    ...
