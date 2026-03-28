#!/usr/bin/env python

"""Pydantic schemas for the CommunicationLog module."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.timestamp import Timestamp


class CommunicationLogCreate(BaseModel):
    lead_id: UUID | None = Field(default=None)
    agent_id: UUID | None = Field(default=None)
    channel: str = Field(description="email or sms")
    purpose: str = Field(description="lead_assignment, brochure, admin_test, etc.")
    direction: str = Field(default="outbound", description="inbound or outbound")
    fire_incident_id: UUID | None = Field(default=None)
    template_type: str | None = Field(default=None)
    recipient_email: str | None = Field(default=None)
    recipient_phone: str | None = Field(default=None)
    provider_message_id: str | None = Field(default=None)
    subject: str | None = Field(default=None)
    body_preview: str | None = Field(default=None)
    send_status: str = Field(default="pending")
    failure_reason: str | None = Field(default=None)
    sent_at: datetime | None = Field(default=None)
    delivered_at: datetime | None = Field(default=None)
    is_queued_for_quiet_hours: bool = Field(default=False)
    scheduled_send_at: datetime | None = Field(default=None)
    is_manual_override: bool = Field(default=False)


class CommunicationLogUpdate(BaseModel):
    send_status: str | None = Field(default=None)
    failure_reason: str | None = Field(default=None)
    provider_message_id: str | None = Field(default=None)
    sent_at: datetime | None = Field(default=None)
    delivered_at: datetime | None = Field(default=None)
    opened_at: datetime | None = Field(default=None)
    clicked_at: datetime | None = Field(default=None)
    unsubscribed_at: datetime | None = Field(default=None)
    is_queued_for_quiet_hours: bool | None = Field(default=None)
    scheduled_send_at: datetime | None = Field(default=None)


class CommunicationLogInDB(BaseModel):
    id: UUID | None = Field(default=None)
    lead_id: UUID | None = Field(default=None)
    agent_id: UUID | None = Field(default=None)
    channel: str | None = Field(default=None)
    purpose: str | None = Field(default=None)
    direction: str | None = Field(default="outbound")
    fire_incident_id: UUID | None = Field(default=None)
    template_type: str | None = Field(default=None)
    recipient_email: str | None = Field(default=None)
    recipient_phone: str | None = Field(default=None)
    provider_message_id: str | None = Field(default=None)
    subject: str | None = Field(default=None)
    body_preview: str | None = Field(default=None)
    send_status: str | None = Field(default=None)
    failure_reason: str | None = Field(default=None)
    sent_at: datetime | None = Field(default=None)
    delivered_at: datetime | None = Field(default=None)
    opened_at: datetime | None = Field(default=None)
    clicked_at: datetime | None = Field(default=None)
    unsubscribed_at: datetime | None = Field(default=None)
    is_queued_for_quiet_hours: bool | None = Field(default=None)
    scheduled_send_at: datetime | None = Field(default=None)
    is_manual_override: bool | None = Field(default=None)

    class Config:
        orm_mode = True


class CommunicationLog(Timestamp, CommunicationLogInDB):
    ...


class CommunicationMetrics(BaseModel):
    total_attempted: int = 0
    total_sent: int = 0
    total_delivered: int = 0
    total_bounced: int = 0
    total_opened: int = 0
    total_clicked: int = 0
    total_failed: int = 0
    open_rate: float = 0.0
    click_rate: float = 0.0


class TestEmailResponse(BaseModel):
    communication_log_id: UUID
    smtp_message_id: str | None = None
    send_status: str
    tracking_pixel_url: str | None = None
    sample_click_url: str | None = None
