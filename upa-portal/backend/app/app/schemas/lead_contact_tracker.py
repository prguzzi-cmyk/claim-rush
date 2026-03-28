#!/usr/bin/env python

"""Pydantic schemas for lead contact tracking and escalation"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# -- LeadContactTracker --

class LeadContactTrackerBase(BaseModel):
    lead_id: UUID
    territory_id: UUID
    lead_type: str = Field(max_length=30)


class LeadContactTrackerCreate(LeadContactTrackerBase):
    current_agent_id: UUID | None = None
    contact_status: str = "new"
    ai_call_status: str = "pending"


class LeadContactTrackerUpdate(BaseModel):
    ai_call_status: str | None = None
    ai_call_sid: str | None = None
    ai_call_started_at: datetime | None = None
    ai_call_ended_at: datetime | None = None
    ai_call_result: str | None = None
    ai_call_transcript_url: str | None = None
    qualification_data_json: str | None = None
    current_escalation_level: int | None = None
    current_agent_id: UUID | None = None
    escalation_started_at: datetime | None = None
    contact_status: str | None = None
    is_resolved: bool | None = None
    resolved_at: datetime | None = None
    resolution_type: str | None = None


class LeadContactTrackerInDB(LeadContactTrackerBase):
    id: UUID
    ai_call_status: str
    ai_call_sid: str | None = None
    ai_call_started_at: datetime | None = None
    ai_call_ended_at: datetime | None = None
    ai_call_result: str | None = None
    ai_call_transcript_url: str | None = None
    qualification_data_json: str | None = None
    current_escalation_level: int
    current_agent_id: UUID | None = None
    escalation_started_at: datetime | None = None
    contact_status: str
    is_resolved: bool
    resolved_at: datetime | None = None
    resolution_type: str | None = None

    class Config:
        orm_mode = True


class LeadContactTracker(Timestamp, LeadContactTrackerInDB):
    ...


# -- EscalationAttempt --

class EscalationAttemptBase(BaseModel):
    tracker_id: UUID
    lead_id: UUID
    agent_id: UUID
    escalation_level: int
    escalation_label: str = Field(max_length=30)


class EscalationAttemptCreate(EscalationAttemptBase):
    transfer_status: str = "pending"
    timeout_at: datetime | None = None


class EscalationAttemptUpdate(BaseModel):
    transfer_status: str | None = None
    transfer_call_sid: str | None = None
    transfer_attempted_at: datetime | None = None
    transfer_answered_at: datetime | None = None
    transfer_ended_at: datetime | None = None
    sms_sent: bool | None = None
    email_sent: bool | None = None
    in_app_sent: bool | None = None


class EscalationAttemptInDB(EscalationAttemptBase):
    id: UUID
    transfer_status: str
    transfer_call_sid: str | None = None
    transfer_attempted_at: datetime | None = None
    transfer_answered_at: datetime | None = None
    transfer_ended_at: datetime | None = None
    sms_sent: bool
    email_sent: bool
    in_app_sent: bool
    timeout_at: datetime | None = None

    class Config:
        orm_mode = True


class EscalationAttempt(Timestamp, EscalationAttemptInDB):
    ...


# -- Response schemas for admin endpoints --

class EscalationStatusResponse(BaseModel):
    tracker: LeadContactTracker
    attempts: list[EscalationAttempt] = []
    current_agent_name: str | None = None


class ActiveEscalationSummary(BaseModel):
    id: UUID
    lead_id: UUID
    lead_type: str
    contact_status: str
    current_escalation_level: int
    current_agent_name: str | None = None
    escalation_started_at: datetime | None = None
    created_at: datetime

    class Config:
        orm_mode = True
