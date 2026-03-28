#!/usr/bin/env python

"""Pydantic schemas for the public-facing territory endpoint"""

from pydantic import BaseModel, EmailStr, Field


class PublicTerritoryResponse(BaseModel):
    name: str
    territory_type: str
    state: str | None = None
    county: str | None = None
    zip_code: str | None = None
    custom_geometry: str | None = None
    status: str = Field(description="available | cp_assigned | full | locked")
    chapter_president_name: str | None = None
    adjuster_count: int = 0
    max_adjusters: int = 3
    slots_remaining: int = 0
    lead_fire_enabled: bool = True
    lead_hail_enabled: bool = True
    lead_storm_enabled: bool = True
    lead_lightning_enabled: bool = False
    lead_flood_enabled: bool = True
    lead_theft_vandalism_enabled: bool = True


class TerritoryApplicationCreate(BaseModel):
    """Public territory / Chapter President application form."""

    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    state_of_interest: str = Field(..., min_length=1, max_length=100)
    city_county_of_interest: str = Field(default="", max_length=200)
    experience_background: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=2000)


class TerritoryApplicationResponse(BaseModel):
    success: bool = True
    message: str = "Application submitted successfully."
