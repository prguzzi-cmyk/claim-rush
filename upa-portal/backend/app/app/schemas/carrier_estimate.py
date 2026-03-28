#!/usr/bin/env python

"""Pydantic schemas for the CarrierEstimate module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


# ── Carrier Line Item ──────────────────────────────────────────────

class CarrierLineItemBase(BaseModel):
    description: str | None = Field(default=None, max_length=500, description="Line item description.")
    quantity: float = Field(default=1.0, description="Quantity.")
    unit: str | None = Field(default=None, max_length=20, description="Unit of measure.")
    unit_cost: float | None = Field(default=None, description="Unit cost.")
    total_cost: float | None = Field(default=None, description="Total cost.")
    category: str | None = Field(default=None, max_length=50, description="Category.")
    line_item_code: str | None = Field(default=None, max_length=50, description="Xactimate line item code.")
    confidence: str | None = Field(default=None, max_length=10, description="Parse confidence: high/medium/low.")
    room_name: str | None = Field(default=None, max_length=100, description="Room name from carrier doc.")
    sort_order: int = Field(default=0, description="Sort order.")


class CarrierLineItemCreate(CarrierLineItemBase):
    description: str = Field(max_length=500, description="Line item description.")


class CarrierLineItemInDB(CarrierLineItemBase):
    id: UUID | None = Field(description="Line item UUID.")
    carrier_estimate_id: UUID | None = Field(default=None, description="Parent carrier estimate UUID.")
    matched_room_id: UUID | None = Field(default=None, description="Matched ACI room UUID.")

    class Config:
        orm_mode = True


class CarrierLineItem(Timestamp, CarrierLineItemInDB):
    ...


# ── Carrier Estimate ───────────────────────────────────────────────

class CarrierEstimateBase(BaseModel):
    carrier_name: str | None = Field(default=None, max_length=200, description="Carrier name.")
    upload_type: str | None = Field(default="pdf", max_length=20, description="Upload type.")
    file_name: str | None = Field(default=None, max_length=500, description="Original file name.")
    status: str | None = Field(default="parsed", max_length=20, description="Status.")
    parser_type: str | None = Field(default=None, max_length=30, description="Parser used: xactimate/generic/paste.")
    parse_confidence: str | None = Field(default=None, max_length=10, description="Overall parse confidence.")
    total_cost: float | None = Field(default=None, description="Total cost.")
    notes: str | None = Field(default=None, description="Notes.")


class CarrierEstimateCreate(CarrierEstimateBase):
    carrier_name: str = Field(max_length=200, description="Carrier name.")
    project_id: UUID = Field(description="Parent project UUID.")
    line_items: list[CarrierLineItemCreate] | None = Field(
        default=None, description="Line items to create."
    )


class CarrierEstimateUpdate(CarrierEstimateBase):
    pass


class CarrierEstimateInDB(CarrierEstimateBase):
    id: UUID | None = Field(description="Carrier estimate UUID.")
    project_id: UUID | None = Field(default=None, description="Parent project UUID.")
    file_key: str | None = Field(default=None, description="S3 file key.")
    line_items: list[CarrierLineItem] = Field(default_factory=list, description="Line items.")

    class Config:
        orm_mode = True


class CarrierEstimate(Timestamp, Audit, CarrierEstimateInDB):
    ...


# ── Preview / Confirm ────────────────────────────────────────────

class CarrierPreviewLineItem(BaseModel):
    """A single parsed line item returned by the preview endpoint."""
    description: str | None = None
    quantity: float = 1.0
    unit: str | None = None
    unit_cost: float | None = None
    total_cost: float | None = None
    category: str | None = None
    line_item_code: str | None = None
    confidence: str | None = None
    room_name: str | None = None


class CarrierPreviewResult(BaseModel):
    """Returned by the preview endpoint — parse without saving."""
    items: list[CarrierPreviewLineItem] = Field(default_factory=list)
    parser_type: str | None = None
    parse_confidence: str | None = None
    item_count: int = 0
    total_cost: float = 0.0
    file_key: str | None = None  # S3 key for later confirm


class CarrierConfirmRequest(BaseModel):
    """Sent by the frontend to save previewed (and possibly edited) items."""
    carrier_name: str = Field(max_length=200)
    file_key: str | None = Field(default=None, description="S3 key from preview.")
    file_name: str | None = Field(default=None, max_length=500)
    upload_type: str = Field(default="pdf", max_length=20)
    parser_type: str | None = Field(default=None, max_length=30)
    parse_confidence: str | None = Field(default=None, max_length=10)
    pasted_text: str | None = Field(default=None, description="Original pasted text, if paste flow.")
    items: list[CarrierPreviewLineItem] = Field(default_factory=list)
