#!/usr/bin/env python

"""Schema for OutreachCampaign"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp
from app.schemas.outreach_template import OutreachTemplate as OutreachTemplateSchema


class OutreachCampaignBase(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    lead_source: str | None = Field(default=None, max_length=30)
    territory_state: str | None = Field(default=None, max_length=2)
    contact_method: str | None = Field(default=None, max_length=10)
    template_id: UUID | None = Field(default=None)
    delay_minutes: int | None = Field(default=0)
    max_attempts: int | None = Field(default=3)
    trigger_on: str | None = Field(default=None, max_length=30)
    is_active: bool | None = Field(default=True)
    # Campaign Manager fields
    description: str | None = Field(default=None, max_length=500)
    campaign_type: str | None = Field(default="sms", max_length=20)
    status: str | None = Field(default="draft", max_length=20)
    incident_type: str | None = Field(default=None, max_length=50)
    target_zip_code: str | None = Field(default=None, max_length=10)
    target_radius_miles: int | None = Field(default=None)


class OutreachCampaignCreate(OutreachCampaignBase):
    name: str = Field(max_length=200)
    contact_method: str = Field(max_length=10)
    template_id: UUID = Field()
    trigger_on: str = Field(max_length=30)


class OutreachCampaignUpdate(OutreachCampaignBase):
    pass


class CampaignStepNested(BaseModel):
    """Nested step representation for campaign responses."""
    id: UUID | None = Field(default=None)
    step_number: int
    channel: str
    template_id: UUID
    delay_minutes: int = 0
    subject: str | None = None

    class Config:
        orm_mode = True


class OutreachCampaignInDB(OutreachCampaignBase):
    id: UUID | None = Field(description="Campaign ID.")
    created_by_id: UUID | None = Field(default=None)
    template: OutreachTemplateSchema | None = Field(default=None)
    total_targeted: int = Field(default=0)
    total_sent: int = Field(default=0)
    total_delivered: int = Field(default=0)
    total_responded: int = Field(default=0)
    launched_at: datetime | None = Field(default=None)
    completed_at: datetime | None = Field(default=None)
    steps: list[CampaignStepNested] = Field(default_factory=list)

    class Config:
        orm_mode = True


class OutreachCampaign(Timestamp, OutreachCampaignInDB):
    pass


# ── Campaign Manager specific schemas ──


class CampaignStepCreateNested(BaseModel):
    """Step definition when creating a campaign with steps."""
    step_number: int
    channel: str = Field(max_length=10)
    template_id: UUID
    delay_minutes: int = Field(default=0)
    subject: str | None = Field(default=None, max_length=200)


class OutreachCampaignCreateWithSteps(OutreachCampaignCreate):
    steps: list[CampaignStepCreateNested] = Field(default_factory=list)


class CampaignPreviewResponse(BaseModel):
    total_leads: int
    sample_leads: list[dict]


class CampaignDashboardMetrics(BaseModel):
    active_campaigns: int = 0
    total_leads_targeted: int = 0
    total_contact_attempts: int = 0
    overall_contact_rate: float = 0.0
    overall_response_rate: float = 0.0
    by_channel: dict = Field(default_factory=dict)
    by_campaign: list[dict] = Field(default_factory=list)
