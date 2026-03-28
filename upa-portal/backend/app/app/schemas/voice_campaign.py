#!/usr/bin/env python

"""Pydantic schemas for voice campaign, call log, and usage record"""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.timestamp import Timestamp


# ─── Voice Campaign ──────────────────────────────────────────────

class VoiceCampaignBase(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    status: str | None = Field(default=None, max_length=20)
    script_template: str | None = None
    lead_source_filter: str | None = Field(default=None, max_length=30)
    territory_state_filter: str | None = Field(default=None, max_length=2)
    incident_type_filter: str | None = Field(default=None, max_length=50)
    call_window_start: str | None = Field(default=None, max_length=5)
    call_window_end: str | None = Field(default=None, max_length=5)
    call_window_timezone: str | None = Field(default=None, max_length=50)
    max_retries: int | None = None
    retry_delay_minutes: int | None = None
    max_calls_per_day: int | None = None


class VoiceCampaignCreate(VoiceCampaignBase):
    name: str = Field(max_length=200)


class VoiceCampaignUpdate(VoiceCampaignBase):
    pass


class VoiceCampaignInDB(VoiceCampaignBase):
    id: UUID | None = Field(default=None, description="Campaign ID.")
    total_leads_targeted: int | None = Field(default=0)
    total_calls_placed: int | None = Field(default=0)
    total_calls_answered: int | None = Field(default=0)
    total_appointments_booked: int | None = Field(default=0)
    launched_at: datetime | None = None
    completed_at: datetime | None = None
    created_by_id: UUID | None = None

    class Config:
        orm_mode = True


class VoiceCampaign(Timestamp, VoiceCampaignInDB):
    pass


class VoiceCampaignStats(BaseModel):
    calls_placed: int = 0
    calls_answered: int = 0
    appointments_booked: int = 0
    conversion_rate: float = 0.0


# ─── Voice Call Log ──────────────────────────────────────────────

class VoiceCallLogBase(BaseModel):
    campaign_id: UUID | None = None
    lead_id: UUID | None = None
    lead_name: str | None = Field(default=None, max_length=200)
    phone_number: str | None = Field(default=None, max_length=20)
    call_sid: str | None = None
    status: str | None = Field(default=None, max_length=30)
    outcome: str | None = Field(default=None, max_length=50)
    duration_seconds: int | None = None
    transcript_summary: str | None = None
    retry_count: int | None = None
    cost_cents: int | None = None
    agent_id: UUID | None = None


class VoiceCallLogCreate(VoiceCallLogBase):
    phone_number: str = Field(max_length=20)


class VoiceCallLogInDB(VoiceCallLogBase):
    id: UUID | None = Field(default=None, description="Call Log ID.")
    started_at: datetime | None = None
    ended_at: datetime | None = None

    class Config:
        orm_mode = True


class VoiceCallLogSchema(Timestamp, VoiceCallLogInDB):
    pass


class VoiceCallLogDetail(VoiceCallLogSchema):
    transcript_text: str | None = None
    transcript_url: str | None = None
    recording_url: str | None = None
    campaign_name: str | None = None


# ─── Voice Usage Record ─────────────────────────────────────────

class VoiceUsageRecordBase(BaseModel):
    account_id: UUID | None = None
    period_start: date | None = None
    period_end: date | None = None
    minutes_used: float | None = None
    plan_limit_minutes: float | None = None
    overage_minutes: float | None = None
    cost_cents: int | None = None
    call_count: int | None = None


class VoiceUsageRecordInDB(VoiceUsageRecordBase):
    id: UUID | None = Field(default=None, description="Usage Record ID.")

    class Config:
        orm_mode = True


class VoiceUsageRecordSchema(Timestamp, VoiceUsageRecordInDB):
    pass


# ─── Analytics & Summaries ──────────────────────────────────────

class VoiceCampaignAnalytics(BaseModel):
    total_calls: int = 0
    calls_answered: int = 0
    conversion_rate: float = 0.0
    avg_duration_seconds: float = 0.0
    outcome_breakdown: dict[str, int] = Field(default_factory=dict)
    daily_trend: list[dict] = Field(default_factory=list)


class VoiceUsageSummary(BaseModel):
    minutes_used: float = 0.0
    plan_limit_minutes: float = 500.0
    percent_used: float = 0.0
    call_count: int = 0
    overage_minutes: float = 0.0


class CampaignLaunchRequest(BaseModel):
    lead_ids: list[UUID] = Field(default_factory=list)
