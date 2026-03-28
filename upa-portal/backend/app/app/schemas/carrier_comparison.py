#!/usr/bin/env python

"""Pydantic schemas for the CarrierComparison module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


# ── Comparison Line Item (nested in result) ─────────────────────────

class ComparisonLineItem(BaseModel):
    room_name: str | None = None
    description: str | None = None
    aci_quantity: float | None = None
    aci_unit: str | None = None
    aci_unit_cost: float | None = None
    aci_total: float | None = None
    carrier_quantity: float | None = None
    carrier_unit: str | None = None
    carrier_unit_cost: float | None = None
    carrier_total: float | None = None
    difference: float | None = None
    status: str = "match"  # match, price_diff, aci_only, carrier_only
    category: str | None = None
    match_confidence: str | None = None  # "high", "medium", "low"
    match_score: float | None = None  # 0.0 - 1.0


# ── Category Breakdown & Top Underpaid ────────────────────────────

class CategoryBreakdown(BaseModel):
    category: str
    aci_total: float = 0.0
    carrier_total: float = 0.0
    difference: float = 0.0
    item_count: int = 0


class TopUnderpaidItem(BaseModel):
    description: str
    room_name: str | None = None
    aci_total: float = 0.0
    carrier_total: float = 0.0
    difference: float = 0.0
    status: str = "price_diff"


# ── Comparison Room (nested in result) ──────────────────────────────

class ComparisonRoom(BaseModel):
    room_name: str
    items: list[ComparisonLineItem] = Field(default_factory=list)
    aci_subtotal: float = 0.0
    carrier_subtotal: float = 0.0
    difference: float = 0.0


# ── Comparison Result ───────────────────────────────────────────────

class ComparisonResult(BaseModel):
    project_id: UUID | None = None
    carrier_estimate_id: UUID | None = None
    rooms: list[ComparisonRoom] = Field(default_factory=list)
    aci_total: float = 0.0
    carrier_total: float = 0.0
    supplement_total: float = 0.0
    match_count: int = 0
    aci_only_count: int = 0
    carrier_only_count: int = 0
    price_diff_count: int = 0
    price_threshold: float = 5.0
    category_breakdown: list[CategoryBreakdown] = Field(default_factory=list)
    top_underpaid_items: list[TopUnderpaidItem] = Field(default_factory=list)


# ── Request Schemas ─────────────────────────────────────────────────

class CarrierUploadPasteRequest(BaseModel):
    carrier_name: str = Field(max_length=200, description="Carrier name.")
    pasted_text: str = Field(description="Pasted carrier estimate text.")


class ComparisonRunRequest(BaseModel):
    carrier_estimate_id: UUID = Field(description="Carrier estimate to compare against.")
    price_threshold: float = Field(default=5.0, description="Price difference threshold (%).")


# ── DB Persistence ──────────────────────────────────────────────────

class CarrierComparisonBase(BaseModel):
    price_threshold: float | None = Field(default=5.0, description="Price threshold used.")
    aci_total: float | None = Field(default=None, description="ACI total.")
    carrier_total: float | None = Field(default=None, description="Carrier total.")
    supplement_total: float | None = Field(default=None, description="Supplement total.")
    match_count: int = Field(default=0, description="Match count.")
    aci_only_count: int = Field(default=0, description="ACI-only count.")
    carrier_only_count: int = Field(default=0, description="Carrier-only count.")
    price_diff_count: int = Field(default=0, description="Price diff count.")
    status: str | None = Field(default="completed", description="Status.")


class CarrierComparisonCreate(CarrierComparisonBase):
    project_id: UUID = Field(description="Parent project UUID.")
    carrier_estimate_id: UUID = Field(description="Carrier estimate UUID.")
    comparison_data: str | None = Field(default=None, description="JSON comparison data.")


class CarrierComparisonUpdate(CarrierComparisonBase):
    comparison_data: str | None = Field(default=None, description="JSON comparison data.")


class CarrierComparisonInDB(CarrierComparisonBase):
    id: UUID | None = Field(description="Comparison UUID.")
    project_id: UUID | None = Field(default=None, description="Parent project UUID.")
    carrier_estimate_id: UUID | None = Field(default=None, description="Carrier estimate UUID.")
    comparison_data: str | None = Field(default=None, description="JSON comparison data.")

    class Config:
        orm_mode = True


class CarrierComparison(Timestamp, Audit, CarrierComparisonInDB):
    ...


# ── Policy Argument Generation ────────────────────────────────────

class PolicyArgumentRequest(BaseModel):
    argument_type: str = Field(description="One of: loss_settlement, ordinance_or_law, replacement_cost, duties_after_loss, additional_coverages, general_coverage")
    carrier_estimate_id: UUID | None = None


class PolicyArgumentResponse(BaseModel):
    argument_type: str
    argument_text: str


# ── Supplement Argument Generation ────────────────────────────────

class SupplementArgumentRequest(BaseModel):
    carrier_estimate_id: UUID | None = None


class SupplementArgumentResponse(BaseModel):
    argument_text: str
    has_policy_support: bool = False


# ── Defense Note AI Draft Generation ─────────────────────────────

class DefenseNoteDraftRequest(BaseModel):
    section: str = Field(
        description=(
            "Which defense section to generate. One of: "
            "pricing_defense, omitted_scope_defense, matching_continuity_defense, "
            "quantity_scope_defense, code_standard_support, recommended_action_notes"
        )
    )
    carrier_estimate_id: UUID | None = None


class DefenseNoteDraftResponse(BaseModel):
    section: str
    draft_text: str
    has_policy_support: bool = False
