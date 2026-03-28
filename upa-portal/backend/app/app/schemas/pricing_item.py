#!/usr/bin/env python

"""Pydantic schemas for the PricingItem module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class PricingItemBase(BaseModel):
    code: str | None = Field(default=None, max_length=50, description="Pricing item code.")
    category: str | None = Field(default=None, max_length=100, description="Category.")
    description: str | None = Field(default=None, max_length=500, description="Item description.")
    unit: str | None = Field(default=None, max_length=20, description="Unit of measurement.")
    base_cost: float | None = Field(default=None, description="Base cost.")
    labor_cost: float | None = Field(default=None, description="Labor cost.")
    material_cost: float | None = Field(default=None, description="Material cost.")


# Properties required when creating
class PricingItemCreate(PricingItemBase):
    code: str = Field(max_length=50, description="Pricing item code.")
    version_id: UUID | None = Field(default=None, description="Associated pricing version UUID.")


# Properties accepted on update
class PricingItemUpdate(PricingItemBase):
    pass


# Properties returned from DB
class PricingItemInDB(PricingItemBase):
    id: UUID | None = Field(description="Pricing item UUID.")
    is_active: bool = Field(default=True, description="Whether the item is active.")
    version_id: UUID | None = Field(default=None, description="Associated pricing version UUID.")

    class Config:
        orm_mode = True


# Full response schema
class PricingItem(Timestamp, PricingItemInDB):
    ...
