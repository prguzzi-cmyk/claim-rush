"""Pydantic schemas for DB-backed roof analysis records."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class RoofAnalysisBase(BaseModel):
    property_id: str = Field(max_length=100)
    address: str = Field(max_length=500)
    city: str = Field(max_length=100)
    state: str = Field(max_length=2)
    zip_code: str = Field(max_length=10)
    county: str | None = None
    latitude: float
    longitude: float

    # Roof metadata
    roof_type: str | None = None
    roof_age_years: int | None = None
    roof_size_sqft: float | None = None

    # Storm context
    storm_event_id: UUID | str | None = None
    storm_type: str | None = None
    hail_size_inches: float | None = None
    wind_speed_mph: float | None = None


class RoofAnalysisCreate(RoofAnalysisBase):
    """Schema for creating a new roof analysis record."""
    analysis_mode: str = "rules"
    is_demo: bool = False


class RoofAnalysisUpdate(BaseModel):
    """Schema for updating an existing roof analysis record."""
    adjuster_notes: str | None = None
    outreach_status: str | None = None
    skip_trace_status: str | None = None
    owner_name: str | None = None
    recommended_action: str | None = None


class RoofAnalysisInDB(RoofAnalysisBase):
    id: UUID | None = Field(description="Roof analysis UUID.")

    # Analysis results
    damage_score: int = 0
    damage_label: str = "none"
    confidence: str = "low"
    summary: str | None = None
    indicators: str | None = None
    analysis_mode: str = "rules"

    # Imagery
    image_source: str | None = None
    image_path: str | None = None
    scan_timestamp: datetime | None = None

    # Claim estimate
    claim_range_low: float | None = None
    claim_range_high: float | None = None
    estimated_claim_value: float | None = None

    # Pipeline status
    status: str = "queued"
    recommended_action: str | None = None
    error_message: str | None = None

    # Ownership / outreach
    owner_name: str | None = None
    skip_trace_status: str = "not_started"
    outreach_status: str = "not_started"
    adjuster_notes: str | None = None

    # Territory
    territory_id: UUID | str | None = None
    territory_name: str | None = None

    batch_id: str | None = None
    is_demo: bool = False
    is_active: bool = True

    class Config:
        orm_mode = True


class RoofAnalysisOut(Timestamp, RoofAnalysisInDB):
    """Response model for a single roof analysis record."""
    ...


class RoofAnalysisListResponse(BaseModel):
    """Paginated list response."""
    items: List[RoofAnalysisOut]
    total: int


class RoofAnalysisBatchRequest(BaseModel):
    """Request to submit a batch of properties for analysis."""
    properties: List[RoofAnalysisCreate]
    storm_event_id: str | None = None
    analysis_mode: str = "rules"  # "ai_vision", "rules", "demo"

    class Config:
        json_schema_extra = {
            "example": {
                "properties": [
                    {
                        "property_id": "prop-001",
                        "address": "123 Main St",
                        "city": "Dallas",
                        "state": "TX",
                        "zip_code": "75201",
                        "latitude": 32.78,
                        "longitude": -96.80,
                    }
                ],
                "analysis_mode": "rules",
            }
        }


class RoofAnalysisBatchResponse(BaseModel):
    """Response after submitting a batch."""
    batch_id: str
    queued: int
    message: str


class RoofAnalysisBatchStatusResponse(BaseModel):
    """Status of a batch processing job."""
    batch_id: str
    total: int
    completed: int
    in_progress: int
    queued: int
    errored: int


class RoofAnalysisStatsOut(BaseModel):
    """Aggregate statistics for roof analyses."""
    total: int = 0
    by_status: dict = {}
    by_damage_label: dict = {}
    by_analysis_mode: dict = {}
