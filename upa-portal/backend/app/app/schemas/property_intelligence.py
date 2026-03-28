#!/usr/bin/env python

"""Pydantic schemas for the PropertyIntelligence module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class PropertyIntelligenceBase(BaseModel):
    address: str = Field(description="Full display address of the incident.")
    owner_name: str | None = Field(default=None, description="Property owner full name.")
    phone: str | None = Field(default=None, description="Owner phone number.")
    phone_type: str | None = Field(default=None, description="Phone type: Cell, Landline, Unknown.")
    email: str | None = Field(default=None, description="Owner email address.")
    property_value_estimate: str | None = Field(default=None, description="Estimated property value.")
    mortgage_lender: str | None = Field(default=None, description="Mortgage lender name.")
    insurance_probability_score: str | None = Field(default=None, description="Insurance probability score.")
    status: str = Field(default="pending", description="Enrichment status: pending, enriched, failed.")
    raw_residents: str | None = Field(default=None, description="Full JSON of skip trace results.")


# Properties required when creating
class PropertyIntelligenceCreate(PropertyIntelligenceBase):
    incident_id: UUID = Field(description="Associated fire incident UUID.")


# Properties accepted on update (for enrichment service to fill in data)
class PropertyIntelligenceUpdate(PropertyIntelligenceBase):
    address: str | None = Field(default=None, description="Full display address of the incident.")
    status: str | None = Field(default=None, description="Enrichment status.")


# Properties returned from DB
class PropertyIntelligenceInDB(PropertyIntelligenceBase):
    id: UUID | None = Field(description="Property intelligence UUID primary key.")
    incident_id: UUID = Field(description="Associated fire incident UUID.")

    class Config:
        orm_mode = True


# Full response schema (includes timestamps)
class PropertyIntelligence(Timestamp, PropertyIntelligenceInDB):
    ...
