#!/usr/bin/env python

"""Pydantic schemas for the commission engine API.

One schema per Angular engine view-model. Field names kept identical to the
Angular model (`commission-engine.model.ts`) so the frontend data service can
consume responses without transformation.
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─── Enumerations (as Literal types to preserve the string values) ──────────

Bucket = Literal["HOUSE", "WRITING_AGENT", "RVP_OVERRIDE", "CP_OVERRIDE", "RESERVE"]
TxnType = Literal[
    "COMMISSION_EARNED",
    "PAYOUT_ISSUED",
    "ADVANCE_ISSUED",
    "INTEREST_APPLIED",
    "REPAYMENT_OFFSET",
    "ADJUSTMENT",
]
OrgRole = Literal["AGENT", "RVP", "CP", "ADMIN"]
StatementPeriodType = Literal["week", "month", "year", "custom"]


# ─── Read DTOs (match Angular view-models exactly) ──────────────────────────


class AgentSimpleEarningsDTO(BaseModel):
    user_id: str
    total_earned: float
    paid_to_date: float
    remaining_balance: float


class EarningsTrendPointDTO(BaseModel):
    month_label: str
    month_key: str
    earned: float
    is_current: bool


class EarningsTrendDTO(BaseModel):
    user_id: str
    points: list[EarningsTrendPointDTO]
    current_month: float
    prior_month: float
    delta_percent: float


class RecentActivityItemDTO(BaseModel):
    id: str
    type: TxnType
    bucket: Bucket
    claim_ref: str | None = None
    amount: float
    timestamp: datetime
    memo: str | None = None


class ActiveClaimContributionDTO(BaseModel):
    claim_id: str
    claim_ref: str
    client_name: str
    stage: str
    stage_label: str
    projected_agent_share: float


class ClaimEarningsRowDTO(BaseModel):
    claim_id: str
    claim_ref: str
    client_name: str
    stage: str
    stage_label: str
    earned: float
    paid: float
    remaining: float


class NextExpectedPayoutDTO(BaseModel):
    estimated_date: str
    estimated_amount: float
    status_label: str
    has_pending: bool


class Taxable1099DTO(BaseModel):
    user_id: str
    year: int
    ytd_total: float
    payout_total: float
    advance_total: float
    transaction_count: int


class StatementPeriodDTO(BaseModel):
    type: StatementPeriodType
    start: datetime
    end: datetime
    label: str


class StatementClaimDetailDTO(BaseModel):
    claim_id: str
    claim_ref: str
    client_name: str
    stage_label: str
    earned_in_period: float
    paid_in_period: float
    advances_in_period: float


class StatementTransactionRowDTO(BaseModel):
    id: str
    date: datetime
    claim_ref: str | None = None
    type: TxnType
    type_label: str
    amount: float
    memo: str | None = None


class StatementDTO(BaseModel):
    user_id: str
    user_name: str
    user_role: str
    period: StatementPeriodDTO
    generated_at: datetime
    opening_balance: float
    total_earned: float
    total_paid: float
    advances_issued: float
    closing_balance: float
    taxable_1099_ytd: float
    claim_details: list[StatementClaimDetailDTO]
    transactions: list[StatementTransactionRowDTO]


class AdminAggregateRowDTO(BaseModel):
    user_id: str
    user_name: str
    org_role: OrgRole
    commissions_earned_mtd: float
    advances_outstanding: float
    remaining_balance: float
    active_claims: int
    taxable_1099_ytd: float


class AdminOverviewDTO(BaseModel):
    total_gross_fee_mtd: float
    house_share_mtd: float
    field_share_mtd: float
    reserve_mtd: float
    outstanding_advances_total: float
    rows: list[AdminAggregateRowDTO]


# Financial Detail (matches Angular FinancialDetailView)


class FinancialDetailRowDTO(BaseModel):
    date: datetime
    claim_ref: str
    type: TxnType
    bucket: Bucket
    amount: float
    memo: str | None = None
    running_balance: float


class BucketFieldDetailDTO(BaseModel):
    bucket: Bucket
    label: str
    percent_of_field: float
    percent_of_gross: float
    amount: float
    recipient_user_id: str | None = None


class HouseSectionDTO(BaseModel):
    percent_of_gross: float
    amount: float


class FieldTotalDTO(BaseModel):
    percent_of_gross: float
    amount: float


class ClaimTwoSectionBreakdownDTO(BaseModel):
    claim_id: str
    claim_ref: str
    gross_fee: float
    house: HouseSectionDTO
    field_total: FieldTotalDTO
    field_buckets: list[BucketFieldDetailDTO]


class FinancialDetailDTO(BaseModel):
    writing_agent_id: str
    advances_total: float
    offsets_total: float
    interest_total: float
    adjustments_total: float
    remaining_balance: float
    rows: list[FinancialDetailRowDTO]
    bucket_breakdown_by_claim: list[ClaimTwoSectionBreakdownDTO]


# ─── Write DTOs (POST requests) ─────────────────────────────────────────────


class CreateClaimRequest(BaseModel):
    client_name: str
    claim_number: str
    stage: str = "INTAKE_SIGNED"
    writing_agent_id: UUID
    rvp_id: UUID | None = None
    cp_id: UUID | None = None
    direct_cp: bool = False
    gross_fee: Decimal = Decimal("0")


class RecordGrossFeeRequest(BaseModel):
    gross_fee: Decimal
    ts: datetime | None = None  # optional override; defaults to now

    model_config = ConfigDict(json_schema_extra={
        "example": {"gross_fee": "6400.00"}
    })


class CreatePayoutRequest(BaseModel):
    user_id: UUID
    amount: Decimal
    issued_at: datetime | None = None
    method: str | None = None
    reference: str | None = None
    claim_id: UUID | None = None


class CreateAdvanceRequest(BaseModel):
    user_id: UUID
    amount: Decimal
    issued_at: datetime | None = None
    notes: str | None = None
    claim_id: UUID | None = None


# ─── Summary response wrappers ──────────────────────────────────────────────


class ClaimDTO(BaseModel):
    id: str
    client_name: str
    claim_number: str
    stage: str
    gross_fee: float
    writing_agent_id: str
    rvp_id: str | None = None
    cp_id: str | None = None
    direct_cp: bool
    created_at: datetime


class PayoutDTO(BaseModel):
    id: str
    user_id: str
    amount: float
    issued_at: datetime
    method: str | None = None
    reference: str | None = None
    claim_id: str | None = None


class AdvanceDTO(BaseModel):
    id: str
    user_id: str
    amount: float
    issued_at: datetime
    repaid_amount: float
    notes: str | None = None
    claim_id: str | None = None
