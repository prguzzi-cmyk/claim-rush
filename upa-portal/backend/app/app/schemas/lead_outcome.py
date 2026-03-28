#!/usr/bin/env python

"""Schemas for lead outcome"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.audit import Audit
from app.schemas.timestamp import Timestamp


# Properties to receive via API on creation
class LeadOutcomeCreate(BaseModel):
    outcome_status: str = Field(description="The outcome status value.")
    notes: str | None = Field(default=None, description="Optional notes about the outcome.")
    appointment_date: datetime | None = Field(
        default=None,
        description="Appointment date (required when outcome_status is appointment-scheduled).",
    )
    callback_date: datetime | None = Field(
        default=None,
        description="Custom callback date/time (optional for call-back outcomes).",
    )


# Properties for CRUD on creation (enriched by service layer)
class LeadOutcomeCreateDB(BaseModel):
    outcome_status: str = Field(description="The outcome status value.")
    category: str = Field(description="The outcome category.")
    notes: str | None = Field(default=None, description="Optional notes about the outcome.")
    lead_id: UUID = Field(description="The lead ID.")
    recorded_by_id: UUID = Field(description="The user who recorded the outcome.")
    automation_triggered: str | None = Field(
        default=None, description="Automation action triggered."
    )


# Properties to receive via API on update
class LeadOutcomeUpdate(BaseModel):
    outcome_status: str | None = Field(default=None, description="The outcome status value.")
    notes: str | None = Field(default=None, description="Optional notes about the outcome.")


# Properties to return via API on lead outcome fetch from DB
class LeadOutcomeInDB(BaseModel):
    id: UUID | None = Field(description="The lead outcome ID.")
    outcome_status: str | None = Field(description="The outcome status value.")
    category: str | None = Field(description="The outcome category.")
    notes: str | None = Field(description="Optional notes.")
    lead_id: UUID | None = Field(description="The lead ID.")
    recorded_by_id: UUID | None = Field(description="The user who recorded the outcome.")
    automation_triggered: str | None = Field(description="Automation action triggered.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class LeadOutcome(Timestamp, Audit, LeadOutcomeInDB):
    ...


# Agent performance metrics for dashboard
class AgentPerformanceMetrics(BaseModel):
    agent_id: UUID = Field(description="Agent user ID.")
    agent_name: str = Field(description="Agent display name.")
    total_leads_received: int = Field(default=0, description="Total leads assigned to agent.")
    contact_attempts: int = Field(default=0, description="Number of contact attempt outcomes.")
    appointments_scheduled: int = Field(
        default=0, description="Number of appointments scheduled."
    )
    signed_clients: int = Field(default=0, description="Number of signed clients.")
    closing_rate: float = Field(default=0.0, description="Signed clients / total leads (%).")
    no_answer: int = Field(default=0, description="No-answer outcomes (left message + no message).")
    left_message: int = Field(default=0, description="No-answer with left message outcomes.")
    callbacks_pending: int = Field(default=0, description="Call-back-later-today + call-back-tomorrow outcomes.")
    wants_info: int = Field(default=0, description="Wants more information outcomes.")

    class Config:
        orm_mode = True


# Outcome breakdown for pie chart
class OutcomeBreakdown(BaseModel):
    outcome_status: str = Field(description="The outcome status value.")
    category: str = Field(description="The outcome category.")
    count: int = Field(description="Number of occurrences.")

    class Config:
        orm_mode = True


# Per-agent outcome percentage breakdown
class OutcomePercentageItem(BaseModel):
    outcome_status: str = Field(description="The outcome status value.")
    count: int = Field(description="Number of occurrences.")
    percentage: float = Field(description="Percentage of total outcomes for this agent.")


class AgentOutcomeBreakdown(BaseModel):
    agent_id: UUID = Field(description="Agent user ID.")
    agent_name: str = Field(description="Agent display name.")
    total_outcomes: int = Field(description="Total outcomes recorded by this agent.")
    breakdown: list[OutcomePercentageItem] = Field(
        description="Outcome counts and percentages."
    )
