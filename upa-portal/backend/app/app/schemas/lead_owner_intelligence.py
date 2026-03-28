#!/usr/bin/env python

"""Pydantic schemas for the LeadOwnerIntelligence module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class LeadOwnerIntelligenceBase(BaseModel):
    owner_first_name: str | None = Field(default=None, description="Owner first name.")
    owner_last_name: str | None = Field(default=None, description="Owner last name.")
    owner_email: str | None = Field(default=None, description="Owner email.")
    owner_phone: str | None = Field(default=None, description="Owner phone number.")
    owner_mailing_street: str | None = Field(default=None, description="Mailing street.")
    owner_mailing_city: str | None = Field(default=None, description="Mailing city.")
    owner_mailing_state: str | None = Field(default=None, description="Mailing state.")
    owner_mailing_zip: str | None = Field(default=None, description="Mailing zip code.")
    raw_residents: str | None = Field(default=None, description="Full JSON of skip trace results.")
    lookup_status: str = Field(description="Lookup status: success, failed, no_results.")


class LeadOwnerIntelligenceCreate(LeadOwnerIntelligenceBase):
    lead_id: UUID = Field(description="Associated lead UUID.")


class LeadOwnerIntelligenceUpdate(BaseModel):
    owner_first_name: str | None = Field(default=None)
    owner_last_name: str | None = Field(default=None)
    owner_email: str | None = Field(default=None)
    owner_phone: str | None = Field(default=None)
    owner_mailing_street: str | None = Field(default=None)
    owner_mailing_city: str | None = Field(default=None)
    owner_mailing_state: str | None = Field(default=None)
    owner_mailing_zip: str | None = Field(default=None)
    raw_residents: str | None = Field(default=None)
    lookup_status: str | None = Field(default=None)


class LeadOwnerIntelligenceInDB(LeadOwnerIntelligenceBase):
    id: UUID = Field(description="Owner intelligence UUID primary key.")
    lead_id: UUID = Field(description="Associated lead UUID.")

    class Config:
        orm_mode = True


class LeadOwnerIntelligence(Timestamp, LeadOwnerIntelligenceInDB):
    ...
