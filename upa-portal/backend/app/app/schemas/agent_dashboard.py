#!/usr/bin/env python

"""Pydantic schemas for the agent dashboard endpoints"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AgentDashboardLead(BaseModel):
    lead_id: UUID
    ref_number: int
    ref_string: str
    contact_name: str
    address: str | None = None
    peril: str | None = None
    source_label: str = "UPA Incident Intelligence Network"
    assigned_at: datetime | None = None
    timeout_at: datetime | None = None
    remaining_seconds: float = 0
    dashboard_status: str = "pending"  # pending | accepted | declined | expired | escalated
    escalation_level: int = 1
    escalation_label: str = "agent_1"
    tracker_id: UUID | None = None
    attempt_id: UUID | None = None
    latitude: float | None = None
    longitude: float | None = None
    state: str | None = None
    county: str | None = None
    zip_code: str | None = None

    class Config:
        orm_mode = True


class AcceptDeclineResponse(BaseModel):
    success: bool
    lead_id: UUID
    new_status: str
    message: str = ""


class AgentDashboardConfig(BaseModel):
    escalation_timeout_seconds: int = 300
    poll_interval_ms: int = 15000


class AgentAvailabilityUpdate(BaseModel):
    is_accepting_leads: bool | None = Field(
        default=None, description="Toggle lead acceptance on/off."
    )
    daily_lead_limit: int | None = Field(
        default=None, description="Max leads per day. Set to 0 or null for unlimited."
    )


class AgentAvailabilityResponse(BaseModel):
    is_accepting_leads: bool
    daily_lead_limit: int | None = None
    leads_assigned_today: int = 0
    message: str = ""

    class Config:
        orm_mode = True
