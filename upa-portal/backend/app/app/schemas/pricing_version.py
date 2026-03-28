#!/usr/bin/env python

"""Pydantic schemas for the PricingVersion module"""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


# Shared properties
class PricingVersionBase(BaseModel):
    source: str | None = Field(default=None, max_length=50, description="Pricing source (craftsman, xactimate, manual).")
    version_label: str | None = Field(default=None, max_length=50, description="Version label (e.g. 2026-Q1).")
    effective_date: date | None = Field(default=None, description="Date this pricing becomes effective.")
    region: str | None = Field(default="national", max_length=100, description="Region/market for this pricing.")
    status: str | None = Field(default="draft", max_length=20, description="Version status (draft, active, archived).")
    notes: str | None = Field(default=None, description="Notes about this version.")


# Properties required when creating
class PricingVersionCreate(PricingVersionBase):
    source: str = Field(max_length=50, description="Pricing source.")
    version_label: str = Field(max_length=50, description="Version label.")
    effective_date: date = Field(description="Effective date.")


# Properties accepted on update
class PricingVersionUpdate(PricingVersionBase):
    pass


# Properties returned from DB
class PricingVersionInDB(PricingVersionBase):
    id: UUID | None = Field(description="Pricing version UUID.")
    item_count: int = Field(default=0, description="Number of items in this version.")
    imported_by: UUID | None = Field(default=None, description="User who imported this version.")

    class Config:
        orm_mode = True


# Full response schema
class PricingVersion(Timestamp, Audit, PricingVersionInDB):
    ...
