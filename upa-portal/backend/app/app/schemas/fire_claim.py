#!/usr/bin/env python

"""Schemas for the Fire Claim module"""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.fire_claim_media import FireClaimMedia as FireClaimMediaSchema


class FireClaimBase(BaseModel):
    claim_number: str | None = Field(None, max_length=50)
    loss_date: date | None = None
    address_line1: str | None = Field(None, max_length=255)
    address_line2: str | None = Field(None, max_length=255)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=2)
    zip: str | None = Field(None, max_length=10)
    insured_name: str | None = Field(None, max_length=200)
    insured_phone: str | None = Field(None, max_length=20)
    insured_email: str | None = Field(None, max_length=200)
    carrier_name: str | None = Field(None, max_length=200)
    policy_number: str | None = Field(None, max_length=100)
    carrier_adjuster_email: str | None = Field(None, max_length=200)
    origin_area: str | None = Field(None, max_length=30)
    origin_area_other: str | None = Field(None, max_length=200)
    rooms_affected: str | None = None
    smoke_level: str | None = Field(None, max_length=20)
    water_from_suppression: bool | None = None
    roof_opened_by_firefighters: bool | None = None
    power_shut_off: bool | None = None
    notes: str | None = None
    status: str | None = Field(None, max_length=20)
    ai_analysis: str | None = None
    ai_analysis_at: datetime | None = None
    carrier_report: str | None = None
    carrier_report_at: datetime | None = None
    estimate_project_id: UUID | None = None


class FireClaimCreate(FireClaimBase):
    loss_date: date
    address_line1: str = Field(..., max_length=255)
    city: str = Field(..., max_length=100)
    state: str = Field(..., max_length=2)
    zip: str = Field(..., max_length=10)
    insured_name: str = Field(..., max_length=200)
    insured_phone: str = Field(..., max_length=20)
    insured_email: str = Field(..., max_length=200)
    origin_area: str = Field(..., max_length=30)
    rooms_affected: str
    smoke_level: str = Field(..., max_length=20)
    water_from_suppression: bool = False
    roof_opened_by_firefighters: bool = False
    power_shut_off: bool = False
    status: str = "new"


class FireClaimUpdate(FireClaimBase):
    pass


class FireClaimInDB(FireClaimBase):
    id: UUID
    created_by_id: UUID | None = None
    updated_by_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        orm_mode = True


class FireClaim(FireClaimInDB):
    media: list[FireClaimMediaSchema] = []
