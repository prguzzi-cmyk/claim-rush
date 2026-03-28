#!/usr/bin/env python

"""Schema for OutreachAttempt"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class OutreachAttemptBase(BaseModel):
    campaign_id: UUID | None = Field(default=None)
    lead_id: UUID | None = Field(default=None)
    template_id: UUID | None = Field(default=None)
    channel: str | None = Field(default=None, max_length=10)
    status: str | None = Field(default="pending", max_length=30)
    attempt_number: int | None = Field(default=1)
    recipient_phone: str | None = Field(default=None, max_length=20)
    recipient_email: str | None = Field(default=None, max_length=255)
    message_body: str | None = Field(default=None)
    response_text: str | None = Field(default=None)
    agent_id: UUID | None = Field(default=None)
    communication_log_id: UUID | None = Field(default=None)


class OutreachAttemptCreate(OutreachAttemptBase):
    campaign_id: UUID = Field()
    lead_id: UUID = Field()
    channel: str = Field(max_length=10)


class OutreachAttemptUpdate(OutreachAttemptBase):
    pass


class OutreachAttemptInDB(OutreachAttemptBase):
    id: UUID | None = Field(description="Attempt ID.")

    class Config:
        orm_mode = True


class OutreachAttempt(Timestamp, OutreachAttemptInDB):
    pass


class OutreachMetrics(BaseModel):
    total_attempts: int = 0
    sent: int = 0
    delivered: int = 0
    failed: int = 0
    responded: int = 0
    appointments: int = 0
    response_rate: float = 0.0
    appointment_rate: float = 0.0
