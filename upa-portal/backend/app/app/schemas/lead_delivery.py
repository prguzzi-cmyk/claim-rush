#!/usr/bin/env python

"""Pydantic schemas for lead delivery logging"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class LeadDeliveryLogBase(BaseModel):
    distribution_history_id: UUID
    agent_id: UUID
    lead_id: UUID
    channel: str = Field(max_length=10)
    delivery_status: str = Field(default="pending", max_length=20)


class LeadDeliveryLogCreate(LeadDeliveryLogBase):
    sms_sent_at: datetime | None = None
    email_sent_at: datetime | None = None
    twilio_message_sid: str | None = None
    delivery_error: str | None = None


class LeadDeliveryLogUpdate(BaseModel):
    delivery_status: str | None = None
    sms_sent_at: datetime | None = None
    email_sent_at: datetime | None = None
    twilio_message_sid: str | None = None
    delivery_error: str | None = None


class LeadDeliveryLogInDB(LeadDeliveryLogBase):
    id: UUID
    sms_sent_at: datetime | None = None
    email_sent_at: datetime | None = None
    twilio_message_sid: str | None = None
    delivery_error: str | None = None

    class Config:
        orm_mode = True


class LeadDeliveryLog(Timestamp, LeadDeliveryLogInDB):
    ...
