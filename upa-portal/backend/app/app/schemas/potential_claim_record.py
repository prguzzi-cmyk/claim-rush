#!/usr/bin/env python

"""Pydantic schemas for the PotentialClaim model (Claim Zone → Lead Pipeline)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class PotentialClaimBase(BaseModel):
    zone_id: str | None = Field(default=None, max_length=100)
    property_address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=2)
    zip_code: str | None = Field(default=None, max_length=10)
    county: str | None = Field(default=None, max_length=100)
    latitude: float | None = None
    longitude: float | None = None
    property_type: str | None = Field(default=None, max_length=50)
    event_type: str | None = Field(default=None, max_length=30)
    claim_probability: int | None = Field(default=None, ge=0, le=100)
    estimated_claim_value: float | None = None
    event_timestamp: datetime | None = None
    severity: str | None = Field(default=None, max_length=10)
    status: str | None = Field(default="pending", max_length=30)
    lead_id: UUID | None = None
    territory_id: UUID | None = None
    storm_event_id: UUID | None = None


class PotentialClaimCreate(PotentialClaimBase):
    zone_id: str = Field(max_length=100)
    property_address: str = Field(max_length=500)
    state: str = Field(max_length=2)
    latitude: float
    longitude: float
    event_type: str = Field(max_length=30)
    claim_probability: int = Field(ge=0, le=100)
    severity: str = Field(max_length=10)


class PotentialClaimUpdate(PotentialClaimBase):
    pass


class PotentialClaimInDB(PotentialClaimBase):
    id: UUID | None = Field(description="PotentialClaim UUID.")

    class Config:
        orm_mode = True


class PotentialClaimOut(Timestamp, PotentialClaimInDB):
    ...


class PotentialClaimListResponse(BaseModel):
    items: list[PotentialClaimOut]
    total: int


class PipelineRunSummary(BaseModel):
    """Summary returned after a pipeline run."""
    zone_id: str
    properties_discovered: int
    claims_created: int
    leads_created: int
    leads_assigned: int
    errors: int
