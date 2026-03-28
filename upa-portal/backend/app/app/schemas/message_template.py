#!/usr/bin/env python

"""Pydantic schemas for the MessageTemplate module."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.timestamp import Timestamp


class MessageTemplateCreate(BaseModel):
    name: str = Field(description="Template name")
    category: str = Field(description="fire_incident, storm_damage, claim_followup, appointment_confirmation")
    channel: str = Field(description="sms, email, or voice")
    subject: str | None = Field(default=None, description="Email subject (nullable for sms)")
    body: str = Field(description="Template body text")
    is_active: bool = Field(default=True)
    created_by_id: UUID | None = Field(default=None)


class MessageTemplateUpdate(BaseModel):
    name: str | None = Field(default=None)
    category: str | None = Field(default=None)
    channel: str | None = Field(default=None)
    subject: str | None = Field(default=None)
    body: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)


class MessageTemplateInDB(BaseModel):
    id: UUID | None = Field(default=None)
    name: str | None = Field(default=None)
    category: str | None = Field(default=None)
    channel: str | None = Field(default=None)
    subject: str | None = Field(default=None)
    body: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)
    is_removed: bool | None = Field(default=None)
    created_by_id: UUID | None = Field(default=None)

    class Config:
        orm_mode = True


class MessageTemplate(Timestamp, MessageTemplateInDB):
    ...
