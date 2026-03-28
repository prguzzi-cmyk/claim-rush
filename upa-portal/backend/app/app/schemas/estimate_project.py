#!/usr/bin/env python

"""Pydantic schemas for the EstimateProject module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp
from app.schemas.estimate_photo import EstimatePhoto
from app.schemas.estimate_room import EstimateRoom, EstimateRoomCreate


class LinkedFireClaim(BaseModel):
    """Minimal fire claim info embedded in estimate responses."""

    id: UUID
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    status: str | None = None
    insured_name: str | None = None
    claim_number: str | None = None
    carrier_name: str | None = None
    policy_number: str | None = None
    carrier_adjuster_email: str | None = None

    class Config:
        orm_mode = True


# Shared properties
class EstimateProjectBase(BaseModel):
    name: str | None = Field(default=None, max_length=200, description="Project name.")
    status: str | None = Field(default="draft", max_length=50, description="Project status.")
    estimate_mode: str | None = Field(default="residential", max_length=50, description="Estimate mode/type.")
    total_cost: float | None = Field(default=None, description="Project total cost.")
    notes: str | None = Field(default=None, description="Project notes.")


# Properties required when creating
class EstimateProjectCreate(EstimateProjectBase):
    name: str = Field(max_length=200, description="Project name.")
    estimate_mode: str = Field(default="residential", max_length=50, description="Estimate mode/type.")
    claim_id: UUID | None = Field(default=None, description="Associated claim UUID.")
    pricing_version_id: UUID | None = Field(default=None, description="Pricing version in use.")
    pricing_region: str | None = Field(default=None, description="Pricing region.")
    rooms: list[EstimateRoomCreate] | None = Field(
        default=None, description="Rooms to create with the project."
    )


# Properties accepted on update
class EstimateProjectUpdate(EstimateProjectBase):
    pass


# Properties returned from DB
class EstimateProjectInDB(EstimateProjectBase):
    id: UUID | None = Field(description="Project UUID.")
    claim_id: UUID | None = Field(default=None, description="Associated claim UUID.")
    pricing_version_id: UUID | None = Field(default=None, description="Pricing version in use.")
    pricing_region: str | None = Field(default=None, description="Pricing region.")
    rooms: list[EstimateRoom] = Field(default_factory=list, description="Project rooms.")
    photos: list[EstimatePhoto] = Field(default_factory=list, description="Project photos.")
    fire_claim: LinkedFireClaim | None = Field(default=None, description="Linked fire claim.")

    class Config:
        orm_mode = True


# Full response schema
class EstimateProject(Timestamp, Audit, EstimateProjectInDB):
    ...
