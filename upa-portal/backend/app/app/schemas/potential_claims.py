"""Pydantic schemas for the Potential Claims module."""

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class PotentialClaimEventOut(BaseModel):
    """A storm event enriched with claim probability."""
    id: str
    event_type: str
    city: str
    state: str
    county: str
    timestamp: datetime
    severity: str  # critical / high / moderate / monitor
    claim_probability: int = Field(ge=0, le=100)
    description: str
    source: str


class PotentialClaimZoneOut(BaseModel):
    """An aggregated claim zone derived from storm target areas."""
    id: str
    name: str
    event_type: str
    center: List[float]  # [lat, lng]
    radius_meters: float
    severity: str
    priority: str  # P1-P4
    claim_probability: int = Field(ge=0, le=100)
    estimated_homes_affected: int
    affected_zips: List[str]
    county: str
    state: str
    linked_property_ids: List[str]
    timestamp: datetime
    active: bool
    auto_lead_generated: bool = False


class PotentialClaimRowOut(BaseModel):
    """A scored potential claim row for the dashboard table."""
    id: str
    property_address: str
    city: str | None = None
    state: str
    zip_code: str | None = None
    claim_probability_score: int = Field(ge=0, le=100)
    estimated_claim_value: float
    storm_event_id: str | None = None
    impact_level: str  # critical / high / moderate / low
    event_type: str
    status: str  # pending / lead_created / assigned / dismissed
    created_at: datetime


class GenerateLeadResultOut(BaseModel):
    """Result of converting a PotentialClaim into a Lead."""
    lead_id: str
    assigned_agents_count: int
    territory_name: str


class AssignAgentRequest(BaseModel):
    """Request to assign an agent to a claim opportunity."""
    event_type: str
    address: str = ""
    city: str = ""
    state: str
    county: str = ""
    estimated_claim_value: float = 0
    opportunity_score: int = 0
    damage_probability: float = 0
    source: str = "opportunity-scoring"


class OutreachStatus(BaseModel):
    """Status of a single outreach channel."""
    channel: str  # sms, voice, email
    dispatched: bool
    error: str | None = None


class AssignAgentResultOut(BaseModel):
    """Full result of agent assignment + outreach dispatch."""
    lead_id: str
    territory_name: str
    assigned_agent_name: str
    assigned_agent_id: str
    agent_performance_score: float
    assignment_reason: str
    outreach: List[OutreachStatus]
    outcome_logged: bool


class ClaimTickerMessageOut(BaseModel):
    """A human-readable ticker message derived from recent storms."""
    id: str
    text: str
    severity: str
    timestamp: datetime
