#!/usr/bin/env python

"""Pydantic schemas for the CrimeIncident module"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class CrimeIncidentBase(BaseModel):
    data_source: str | None = Field(default=None, max_length=100)
    external_id: str | None = Field(default=None, max_length=255)
    incident_type: str | None = Field(default=None, max_length=50)
    raw_incident_type: str | None = Field(default=None, max_length=255)
    occurred_at: datetime | None = None
    reported_at: datetime | None = None
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=2)
    zip_code: str | None = Field(default=None, max_length=10)
    county: str | None = Field(default=None, max_length=100)
    latitude: float | None = None
    longitude: float | None = None
    severity: str | None = Field(default="moderate", max_length=20)
    claim_relevance_score: float | None = Field(default=0.5)
    estimated_loss: float | None = None
    property_type: str | None = Field(default=None, max_length=50)
    description: str | None = None
    source_freshness: str | None = Field(default=None, max_length=30)
    is_mock: bool | None = Field(default=False)
    active: bool | None = Field(default=True)


# Properties required when creating
class CrimeIncidentCreate(CrimeIncidentBase):
    data_source: str = Field(max_length=100)
    external_id: str = Field(max_length=255)
    incident_type: str = Field(max_length=50)


# Properties accepted on update
class CrimeIncidentUpdate(CrimeIncidentBase):
    pass


# Properties returned from DB
class CrimeIncidentInDB(CrimeIncidentBase):
    id: UUID | None = Field(description="Crime incident UUID primary key.")

    class Config:
        orm_mode = True


# Full response schema (includes timestamps)
class CrimeIncident(Timestamp, CrimeIncidentInDB):
    ...


# Paginated response
class CrimeIncidentListResponse(BaseModel):
    items: list[CrimeIncident]
    total: int
