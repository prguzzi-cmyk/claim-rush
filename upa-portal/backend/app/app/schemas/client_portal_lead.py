#!/usr/bin/env python

"""Pydantic schemas for client portal leads and follow-ups."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


# ── Lead Schemas ──────────────────────────────────────────────────

class ClientPortalLeadCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    incident_type: Optional[str] = None
    claim_number: Optional[str] = None
    photo_count: int = 0
    has_3d_scan: bool = False
    source: str = "client_portal"


class ClientPortalLeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    incident_type: Optional[str] = None
    status: Optional[str] = None
    qualification_status: Optional[str] = None
    photo_count: Optional[int] = None
    last_contact_at: Optional[datetime] = None
    next_follow_up_at: Optional[datetime] = None
    follow_up_count: Optional[int] = None
    appointment_date: Optional[str] = None
    appointment_time: Optional[str] = None
    appointment_timezone: Optional[str] = None
    calendar_event_id: Optional[str] = None
    qualification_notes: Optional[str] = None
    estimated_severity: Optional[str] = None
    assigned_agent_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None


class ClientPortalLeadRead(BaseModel):
    id: UUID
    name: str
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    incident_type: Optional[str]
    claim_number: Optional[str]
    photo_count: int
    has_3d_scan: bool
    status: str
    qualification_status: str
    source: str
    last_contact_at: Optional[datetime]
    next_follow_up_at: Optional[datetime]
    follow_up_count: int
    appointment_date: Optional[str]
    appointment_time: Optional[str]
    appointment_timezone: Optional[str]
    calendar_event_id: Optional[str]
    qualification_notes: Optional[str]
    estimated_severity: Optional[str]
    lead_id: Optional[UUID]
    assigned_agent_id: Optional[UUID]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Follow-Up Schemas ─────────────────────────────────────────────

class FollowUpScheduleRequest(BaseModel):
    lead_id: UUID
    follow_up_type: str       # reminder, re_engagement, reinforcement
    channel: str              # sms, email, voice
    delay_minutes: int = 60
    message_key: Optional[str] = None
    message_text: Optional[str] = None


class FollowUpRead(BaseModel):
    id: UUID
    lead_id: UUID
    follow_up_type: str
    channel: str
    message_key: Optional[str]
    message_text: Optional[str]
    scheduled_at: datetime
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    status: str
    failure_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Qualification ─────────────────────────────────────────────────

class QualificationResult(BaseModel):
    qualified: bool
    qualification_status: str   # qualified, not_qualified
    severity: Optional[str]     # low, moderate, high, critical
    notes: str
    message: str                # Client-facing message


# ── Dashboard Metrics ─────────────────────────────────────────────

class LeadTrackingMetrics(BaseModel):
    total_leads: int
    leads_new: int
    leads_contacted: int
    leads_scheduled: int
    leads_signed: int
    leads_qualified: int
    leads_not_qualified: int
    appointments_scheduled: int
    conversion_rate: float
    follow_ups_pending: int
    follow_ups_sent_today: int
