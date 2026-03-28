#!/usr/bin/env python

"""Pydantic schemas for the EstimateLineItem module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class EstimateLineItemBase(BaseModel):
    description: str | None = Field(default=None, max_length=500, description="Line item description.")
    quantity: float = Field(default=1.0, description="Quantity.")
    unit: str | None = Field(default=None, max_length=20, description="Unit of measurement (SF, LF, EA, etc.).")
    unit_cost: float | None = Field(default=None, description="Cost per unit.")
    total_cost: float | None = Field(default=None, description="Total cost (quantity * unit_cost).")
    notes: str | None = Field(default=None, description="Line item notes.")
    status: str | None = Field(default=None, description="Line item status (approved or suggested).")
    source: str | None = Field(default=None, description="Line item source (user or ai).")
    confidence: float | None = Field(default=None, description="AI confidence score 0.0–1.0.")
    category: str | None = Field(default=None, max_length=50, description="Line item category.")


# Properties required when creating
class EstimateLineItemCreate(EstimateLineItemBase):
    description: str = Field(max_length=500, description="Line item description.")
    status: str = Field(default="approved", description="Line item status.")
    source: str = Field(default="user", description="Line item source.")
    confidence: float | None = Field(default=None, description="AI confidence score.")
    pricing_code: str | None = Field(default=None, max_length=50, description="Pricing item code snapshot.")
    pricing_version_id: UUID | None = Field(default=None, description="Pricing version UUID.")


# Properties accepted on update
class EstimateLineItemUpdate(EstimateLineItemBase):
    pricing_code: str | None = Field(default=None, max_length=50, description="Pricing item code snapshot.")
    pricing_version_id: UUID | None = Field(default=None, description="Pricing version UUID.")


# Properties returned from DB
class EstimateLineItemInDB(EstimateLineItemBase):
    id: UUID | None = Field(description="Line item UUID.")
    room_id: UUID | None = Field(default=None, description="Parent room UUID.")
    pricing_item_id: UUID | None = Field(default=None, description="Associated pricing item UUID.")
    pricing_code: str | None = Field(default=None, description="Pricing item code snapshot for repricing.")
    pricing_version_id: UUID | None = Field(default=None, description="Pricing version UUID.")
    status: str = Field(default="approved", description="Line item status.")
    source: str = Field(default="user", description="Line item source.")
    confidence: float | None = Field(default=None, description="AI confidence score.")

    class Config:
        orm_mode = True


# Full response schema
class EstimateLineItem(Timestamp, EstimateLineItemInDB):
    ...
