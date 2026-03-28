#!/usr/bin/env python

"""Pydantic schemas for Intake Config (admin control layer)"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class IntakeConfigBase(BaseModel):
    # Identity
    intake_name: str | None = Field(default="ACI Claim Intake", max_length=150)
    slug: str | None = Field(default=None, max_length=100)
    is_active: bool | None = Field(default=True)
    campaign_tag: str | None = Field(default=None, max_length=100)

    # Representative
    rep_name: str | None = None
    rep_title: str | None = None
    rep_phone: str | None = None
    rep_email: str | None = None
    ai_secretary_enabled: bool | None = Field(default=False)

    # Hierarchy
    assigned_cp_id: UUID | None = None
    assigned_rvp_id: UUID | None = None
    assigned_agent_id: UUID | None = None
    territory_id: UUID | None = None

    # Routing
    default_assignee_id: UUID | None = None
    fallback_home_office: bool | None = Field(default=True)
    rescue_enabled: bool | None = Field(default=True)
    territory_enforcement: bool | None = Field(default=False)

    # Scripts
    voice_script_version: str | None = None
    sms_script_version: str | None = None
    intake_opening_script: str | None = None
    brochure_link: str | None = None

    # Links (usually server-generated, but editable)
    public_url: str | None = None
    tracked_outreach_url: str | None = None
    qr_link: str | None = None


class IntakeConfigCreate(IntakeConfigBase):
    slug: str = Field(max_length=100, description="Unique slug for the public intake link")


class IntakeConfigUpdate(IntakeConfigBase):
    pass


class IntakeConfigInDB(IntakeConfigBase):
    id: UUID

    class Config:
        orm_mode = True


class IntakeConfig(Timestamp, IntakeConfigInDB):
    # Resolved names for display
    assigned_cp_name: str | None = None
    assigned_rvp_name: str | None = None
    assigned_agent_name: str | None = None
    default_assignee_name: str | None = None
    territory_name: str | None = None
