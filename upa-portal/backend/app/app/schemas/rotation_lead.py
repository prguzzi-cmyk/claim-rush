#!/usr/bin/env python

"""Schemas for the lead rotation engine"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.timestamp import Timestamp


# ── Enums ────────────────────────────────────────────────────────────────────

class RotationLeadStatus(str, Enum):
    NEW_LEAD = "new_lead"
    ASSIGNED = "assigned"
    ATTEMPTED_CONTACT = "attempted_contact"
    NO_ANSWER = "no_answer"
    LEFT_MESSAGE = "left_message"
    CALL_BACK_LATER = "call_back_later"
    NOT_INTERESTED = "not_interested"
    INTERESTED = "interested"
    SIGNED_CLIENT = "signed_client"
    INVALID_LEAD = "invalid_lead"


class RotationActivityType(str, Enum):
    CREATED = "created"
    ASSIGNED = "assigned"
    CONTACT_ATTEMPTED = "contact_attempted"
    STATUS_CHANGED = "status_changed"
    REASSIGNED = "reassigned"
    ESCALATED = "escalated"
    NOTE_ADDED = "note_added"


# ── RotationLead Schemas ─────────────────────────────────────────────────────

class RotationLeadBase(BaseModel):
    lead_source: str | None = Field(default=None, max_length=100)
    property_address: str | None = Field(default=None, max_length=255)
    property_city: str | None = Field(default=None, max_length=100)
    property_state: str | None = Field(default=None, max_length=2)
    property_zip: str | None = Field(default=None, max_length=10)
    owner_name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=255)
    incident_type: str | None = Field(default=None, max_length=50)
    lead_status: str | None = Field(default="new_lead", max_length=30)
    assigned_agent_id: UUID | None = None
    assignment_date: datetime | None = None
    last_contact_attempt: datetime | None = None
    contact_attempt_count: int | None = Field(default=0)
    outcome: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    reassignment_count: int | None = Field(default=0)


class RotationLeadCreate(RotationLeadBase):
    lead_source: str = Field(max_length=100)
    property_address: str = Field(max_length=255)
    property_city: str = Field(max_length=100)
    property_state: str = Field(max_length=2)
    property_zip: str = Field(max_length=10)
    owner_name: str = Field(max_length=200)
    phone: str = Field(max_length=20)
    incident_type: str = Field(max_length=50)


class RotationLeadUpdate(RotationLeadBase):
    pass


class RotationLeadInDB(RotationLeadBase):
    id: UUID | None = Field(description="Rotation Lead UUID")

    class Config:
        orm_mode = True


class RotationLead(Timestamp, RotationLeadInDB):
    ...


class RotationLeadDetail(RotationLead):
    activities: list["RotationLeadActivityOut"] = []
    assigned_agent: Any | None = None


# ── RotationLeadActivity Schemas ─────────────────────────────────────────────

class RotationLeadActivityBase(BaseModel):
    rotation_lead_id: UUID | None = None
    activity_type: str | None = Field(default=None, max_length=30)
    description: str | None = None
    old_value: str | None = Field(default=None, max_length=255)
    new_value: str | None = Field(default=None, max_length=255)
    performed_by_id: UUID | None = None


class RotationLeadActivityCreate(RotationLeadActivityBase):
    rotation_lead_id: UUID
    activity_type: str = Field(max_length=30)
    description: str


class RotationLeadActivityInDB(RotationLeadActivityBase):
    id: UUID | None = Field(description="Activity UUID")

    class Config:
        orm_mode = True


class RotationLeadActivityOut(Timestamp, RotationLeadActivityInDB):
    performed_by: Any | None = None


# ── RotationConfig Schemas ───────────────────────────────────────────────────

class RotationConfigBase(BaseModel):
    territory_id: UUID | None = None
    contact_timeout_hours: int | None = Field(default=24)
    max_contact_attempts: int | None = Field(default=5)
    auto_reassign_enabled: bool | None = Field(default=True)
    rotation_index: int | None = Field(default=0)
    use_performance_weighting: bool | None = Field(
        default=False,
        description="When True, eligible agents are sorted by performance composite score before round-robin.",
    )
    weight_closing_rate: float | None = Field(
        default=0.4, ge=0, le=1,
        description="Weight factor for closing rate in composite score (0-1).",
    )
    weight_response_speed: float | None = Field(
        default=0.3, ge=0, le=1,
        description="Weight factor for response speed in composite score (0-1).",
    )
    weight_satisfaction: float | None = Field(
        default=0.3, ge=0, le=1,
        description="Weight factor for client satisfaction in composite score (0-1).",
    )
    last_assigned_agent_id: UUID | None = None


class RotationConfigCreate(RotationConfigBase):
    pass


class RotationConfigUpdate(RotationConfigBase):
    pass


class RotationConfigInDB(RotationConfigBase):
    id: UUID | None = Field(description="Config UUID")

    class Config:
        orm_mode = True


class RotationConfig(Timestamp, RotationConfigInDB):
    territory: dict | None = None


# ── Request/Response Schemas ─────────────────────────────────────────────────

class ContactAttemptRequest(BaseModel):
    outcome: str = Field(max_length=100)
    notes: str | None = None


class ReassignRequest(BaseModel):
    new_agent_id: UUID | None = None
    reason: str | None = None


class AgentBreakdown(BaseModel):
    agent_id: UUID
    agent_name: str
    leads_assigned: int = 0
    leads_contacted: int = 0
    leads_signed: int = 0
    avg_response_hours: float | None = None


class StatusBreakdown(BaseModel):
    status: str
    count: int


class RotationLeadMetrics(BaseModel):
    total_leads: int = 0
    assigned_leads: int = 0
    signed_clients: int = 0
    avg_response_hours: float | None = None
    agent_breakdown: list[AgentBreakdown] = []
    status_breakdown: list[StatusBreakdown] = []
    conversion_rate: float = 0.0


# Resolve forward references
RotationLeadDetail.update_forward_refs()
