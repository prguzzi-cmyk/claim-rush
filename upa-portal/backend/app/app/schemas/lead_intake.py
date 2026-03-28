#!/usr/bin/env python

"""Schemas for the Lead Intake admin view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LeadIntakeRecord(BaseModel):
    """Read-only view combining FireIncident + Lead + Territory data."""

    # Incident
    incident_id: UUID
    call_type: str
    call_type_description: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    incident_time: datetime | None = None
    source: str
    is_active: bool

    # Lead (if converted)
    lead_id: UUID | None = None
    lead_ref_string: str | None = None
    lead_status: str | None = None

    # Territory
    territory_id: UUID | None = None
    territory_name: str | None = None
    state: str | None = None

    # Routing
    auto_lead_attempted: bool
    auto_lead_skipped_reason: str | None = None
    created_at: datetime

    class Config:
        orm_mode = True


class ManualLeadIntakeRequest(BaseModel):
    """Create a test lead manually for distribution."""

    incident_type: str = Field(description="Lead peril type: fire, hail, storm, etc.")
    address: str
    city: str | None = None
    state: str = Field(max_length=2, description="2-char state code")
    zip_code: str | None = Field(None, max_length=10, description="ZIP / postal code")
    county: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    source: str = "manual"
    full_name: str = "Test Lead"
    phone_number: str = "N/A"
    auto_distribute: bool = True


class ManualLeadIntakeResponse(BaseModel):
    """Response after creating a manual test lead."""

    lead_id: UUID
    lead_ref_string: str
    territory_id: UUID | None = None
    territory_name: str | None = None
    distributed: bool
    assigned_agents: list[dict] = Field(default_factory=list)
