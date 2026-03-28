#!/usr/bin/env python

"""Pydantic schemas for the VoiceScript module."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.timestamp import Timestamp


class VoiceScriptCreate(BaseModel):
    name: str = Field(description="Script name")
    description: str | None = Field(default=None, description="Script description")
    category: str = Field(description="fire_incident, storm_damage, claim_followup, appointment_confirmation")
    script_text: str = Field(description="Main script text")
    greeting: str = Field(description="Greeting text")
    closing: str = Field(description="Closing text")
    objection_handling: str | None = Field(default=None, description="Objection handling text")
    is_active: bool = Field(default=True)
    created_by_id: UUID | None = Field(default=None)


class VoiceScriptUpdate(BaseModel):
    name: str | None = Field(default=None)
    description: str | None = Field(default=None)
    category: str | None = Field(default=None)
    script_text: str | None = Field(default=None)
    greeting: str | None = Field(default=None)
    closing: str | None = Field(default=None)
    objection_handling: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)


class VoiceScriptInDB(BaseModel):
    id: UUID | None = Field(default=None)
    name: str | None = Field(default=None)
    description: str | None = Field(default=None)
    category: str | None = Field(default=None)
    script_text: str | None = Field(default=None)
    greeting: str | None = Field(default=None)
    closing: str | None = Field(default=None)
    objection_handling: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)
    is_removed: bool | None = Field(default=None)
    created_by_id: UUID | None = Field(default=None)

    class Config:
        orm_mode = True


class VoiceScript(Timestamp, VoiceScriptInDB):
    ...
