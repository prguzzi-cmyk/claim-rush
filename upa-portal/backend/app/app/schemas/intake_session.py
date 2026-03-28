#!/usr/bin/env python

"""Schemas for AI Intake Session"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class IntakeSessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    QUALIFIED = "qualified"
    NOT_QUALIFIED = "not-qualified"


class IntakeStep(str, Enum):
    GREETING = "greeting"
    NAME = "name"
    ADDRESS = "address"
    CONTACT = "contact"
    INCIDENT = "incident"
    DATE_OF_LOSS = "date_of_loss"
    INSURANCE = "insurance"
    POLICY = "policy"
    QUALIFICATION = "qualification"
    APPOINTMENT = "appointment"
    COMPLETE = "complete"


# ── Chat message from the frontend ──
class IntakeChatMessage(BaseModel):
    session_id: UUID | None = Field(default=None, description="Existing session ID, or null to start new.")
    message: str = Field(description="The homeowner's message text.")


# ── AI response back to frontend ──
class IntakeChatResponse(BaseModel):
    success: bool = Field(default=True, description="Whether the request was processed successfully.")
    session_id: UUID | None = Field(default=None, description="The intake session ID.")
    ai_message: str = Field(default="", description="AI assistant response text.")
    current_step: str = Field(default="greeting", description="Current conversation step.")
    is_complete: bool = Field(default=False, description="Whether intake is fully complete.")
    is_qualified: bool | None = Field(default=None, description="Qualification result if determined.")
    collected_data: dict[str, Any] = Field(default_factory=dict, description="Data collected so far.")
    lead_id: UUID | None = Field(default=None, description="Created lead ID if intake completed.")
    fallback: bool = Field(default=False, description="True if the response was generated from a recovery path.")


# ── CRUD schemas ──
class IntakeSessionBase(BaseModel):
    homeowner_name: str | None = None
    property_address: str | None = None
    phone: str | None = None
    email: str | None = None
    incident_type: str | None = None
    date_of_loss: datetime | None = None
    insurance_company: str | None = None
    policy_number: str | None = None
    status: str | None = "active"
    current_step: str | None = "greeting"
    is_qualified: bool | None = None
    qualification_reason: str | None = None
    qualification_score: float | None = None


class IntakeSessionCreate(IntakeSessionBase):
    pass


class IntakeSessionUpdate(IntakeSessionBase):
    conversation_log: str | None = None
    lead_id: UUID | None = None


class IntakeSessionInDB(IntakeSessionBase):
    id: UUID | None = Field(description="Session ID.")
    conversation_log: str | None = None
    lead_id: UUID | None = None
    created_by_user_id: UUID | None = None

    class Config:
        orm_mode = True


class IntakeSession(Timestamp, IntakeSessionInDB):
    pass


# ── Dashboard metrics ──
class IntakeDashboardMetrics(BaseModel):
    conversations_started: int = 0
    completed_intakes: int = 0
    appointments_booked: int = 0
    clients_signed: int = 0
    qualification_rate: float = 0.0
    avg_qualification_score: float = 0.0
