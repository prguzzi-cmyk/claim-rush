#!/usr/bin/env python

"""Schema for CampaignStep"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp
from app.schemas.outreach_template import OutreachTemplate as OutreachTemplateSchema


class CampaignStepBase(BaseModel):
    campaign_id: UUID | None = Field(default=None)
    step_number: int | None = Field(default=None)
    channel: str | None = Field(default=None, max_length=10)
    template_id: UUID | None = Field(default=None)
    delay_minutes: int | None = Field(default=0)
    subject: str | None = Field(default=None, max_length=200)


class CampaignStepCreate(CampaignStepBase):
    campaign_id: UUID = Field()
    step_number: int = Field()
    channel: str = Field(max_length=10)
    template_id: UUID = Field()


class CampaignStepUpdate(CampaignStepBase):
    pass


class CampaignStepInDB(CampaignStepBase):
    id: UUID | None = Field(description="Step ID.")
    template: OutreachTemplateSchema | None = Field(default=None)

    class Config:
        orm_mode = True


class CampaignStep(Timestamp, CampaignStepInDB):
    pass
