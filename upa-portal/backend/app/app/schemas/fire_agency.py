#!/usr/bin/env python

"""Pydantic schemas for the FireAgency module"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


# Shared properties
class FireAgencyBase(BaseModel):
    agency_id: str | None = Field(
        default=None, max_length=50, description="PulsePoint agency ID (e.g. '65060')."
    )
    name: str | None = Field(
        default=None, max_length=200, description="Human-readable agency name."
    )
    state: str | None = Field(
        default=None, max_length=2, description="Two-letter US state code."
    )
    is_active: bool | None = Field(
        default=True, description="Whether this agency is included in scheduled polling."
    )


# Properties required when creating a new agency
class FireAgencyCreate(FireAgencyBase):
    agency_id: str = Field(max_length=50, description="PulsePoint agency ID.")
    name: str = Field(max_length=200, description="Human-readable agency name.")


# Properties accepted on update
class FireAgencyUpdate(FireAgencyBase):
    pass


# Properties returned from DB
class FireAgencyInDB(FireAgencyBase):
    id: UUID | None = Field(description="Agency UUID primary key.")
    last_polled_at: datetime | None = Field(
        default=None, description="Timestamp of the most recent successful poll."
    )

    class Config:
        orm_mode = True


# Full response schema (includes timestamps and audit fields)
class FireAgency(Timestamp, Audit, FireAgencyInDB):
    ...
