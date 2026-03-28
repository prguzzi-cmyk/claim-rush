#!/usr/bin/env python

"""Pydantic schemas for the Incident Intelligence Data Engine"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# --- Incident Type Enum ---
class IncidentType:
    FIRE = "fire"
    STORM = "storm"
    CRIME = "crime"
    WEATHER = "weather"


# --- Base Schemas ---

class IncidentBase(BaseModel):
    incident_type: str | None = Field(default=None, max_length=30)
    source: str | None = Field(default=None, max_length=100)
    external_id: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=2)
    zip_code: str | None = Field(default=None, max_length=10)
    latitude: float | None = None
    longitude: float | None = None
    occurred_at: datetime | None = None
    description: str | None = None
    severity: str | None = Field(default="moderate", max_length=20)
    property_type: str | None = Field(default=None, max_length=50)
    priority_score: float | None = Field(default=0.0)
    damage_probability: float | None = Field(default=0.5)
    location_density: float | None = Field(default=0.5)
    lead_converted: bool | None = Field(default=False)
    lead_id: str | None = None
    conversion_skipped_reason: str | None = None
    is_active: bool | None = Field(default=True)
    source_record_id: str | None = None


class IncidentCreate(IncidentBase):
    incident_type: str = Field(max_length=30)
    source: str = Field(max_length=100)


class IncidentUpdate(IncidentBase):
    pass


class IncidentInDB(IncidentBase):
    id: UUID | None = Field(description="Incident UUID primary key.")

    class Config:
        orm_mode = True


class Incident(Timestamp, IncidentInDB):
    ...


# --- Ingestion Request ---

class IncidentIngestRequest(BaseModel):
    """Batch ingest request for external incident data."""
    incidents: list[IncidentCreate] = Field(
        description="List of incidents to ingest.",
        min_items=1,
        max_items=500,
    )


class IncidentIngestResponse(BaseModel):
    """Response from batch ingestion."""
    total_received: int = Field(description="Total incidents in the request.")
    inserted: int = Field(description="New incidents inserted.")
    duplicates_skipped: int = Field(description="Duplicates detected and skipped.")
    errors: int = Field(description="Incidents that failed to process.")


# --- Lead Conversion ---

class IncidentConvertToLeadRequest(BaseModel):
    """Manual conversion of an incident to a lead."""
    full_name: str = Field(max_length=100)
    phone_number: str = Field(max_length=20)
    email: str | None = Field(default=None)
    assigned_to: UUID | None = Field(default=None)


class IncidentConvertToLeadResponse(BaseModel):
    incident_id: UUID
    lead_id: UUID
    message: str


# --- Dashboard Metrics ---

class IncidentDashboardMetrics(BaseModel):
    """Dashboard metrics for the Incident Intelligence engine."""
    incidents_detected_today: int = Field(description="Incidents ingested today.")
    leads_generated_today: int = Field(description="Leads created from incidents today.")
    conversion_rate: float = Field(description="Percentage of incidents converted to leads.")
    total_active_incidents: int = Field(description="Total currently active incidents.")
    incidents_by_type: dict[str, int] = Field(
        default_factory=dict,
        description="Breakdown by incident type.",
    )
    highest_priority_incidents: list["Incident"] = Field(
        default_factory=list,
        description="Top priority incidents.",
    )


# --- Map Layer ---

class IncidentMapPoint(BaseModel):
    """Lightweight incident for map rendering."""
    id: UUID
    incident_type: str
    latitude: float
    longitude: float
    address: str | None = None
    severity: str
    priority_score: float
    occurred_at: datetime | None = None
    lead_converted: bool = False

    class Config:
        orm_mode = True
