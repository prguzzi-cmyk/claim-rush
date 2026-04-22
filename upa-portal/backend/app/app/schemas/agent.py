#!/usr/bin/env python

"""Pydantic schemas for the agent profile / license / banking API."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


TaxClassification = Literal["1099", "W2", "S_CORP", "LLC"]
BackgroundCheckStatus = Literal["PENDING", "PASSED", "FAILED", "EXEMPT"]
LicenseStatus = Literal["ACTIVE", "LAPSED", "REVOKED", "SUSPENDED", "PENDING_RENEWAL"]
PayoutMethod = Literal["ACH", "CHECK", "WIRE", "NONE"]
AdjusterCompType = Literal[
    "SALARIED", "HOURLY", "COMMISSION", "SALARY_PLUS_BONUS", "HYBRID"
]


# ─── AgentProfile ───────────────────────────────────────────────────────────


class AgentProfileBase(BaseModel):
    """Shared fields for create / update / read."""
    ssn_or_itin_last4: str | None = Field(None, min_length=4, max_length=4)
    tax_classification: TaxClassification | None = None
    w9_signed_at: date | None = None
    w9_file_id: UUID | None = None

    employment_start_date: date | None = None
    employment_end_date: date | None = None
    termination_reason: str | None = None

    background_check_status: BackgroundCheckStatus | None = None
    background_check_completed_at: date | None = None
    drug_test_passed_at: date | None = None
    non_compete_signed_at: date | None = None
    non_compete_file_id: UUID | None = None

    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    beneficiary_name: str | None = None
    beneficiary_relationship: str | None = None

    commission_tier_override: Decimal | None = Field(None, ge=0, le=100)

    # Adjuster compensation — only meaningful when user.role == 'ADJUSTER'.
    # Percent is % of house_share on each paid claim; app-layer validated 1–25.
    adjuster_comp_type: AdjusterCompType | None = None
    adjuster_comp_percent: Decimal | None = Field(None, ge=1, le=25)
    adjuster_annual_salary: Decimal | None = Field(None, ge=0)
    adjuster_hourly_rate: Decimal | None = Field(None, ge=0)
    adjuster_comp_effective_date: date | None = None

    notes: str | None = None


class AgentProfileCreateRequest(AgentProfileBase):
    """POST /v1/agents/ body. agent_number is auto-generated server-side."""
    user_id: UUID


class AgentProfileUpdateRequest(AgentProfileBase):
    """PATCH /v1/agents/{id} body — all fields optional; provide only what to change."""
    pass


class AgentProfileDTO(AgentProfileBase):
    """Read shape. Includes server-generated fields."""
    id: UUID
    user_id: UUID
    agent_number: str
    # Denormalized helpers for the UI (saves a second hop to GET user).
    user_name: str
    user_email: str
    user_role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None



# ─── AgentLicense ───────────────────────────────────────────────────────────


class AgentLicenseCreateRequest(BaseModel):
    state: str = Field(..., min_length=2, max_length=2)
    license_type: str
    license_number: str
    issued_on: date | None = None
    expires_on: date | None = None
    status: LicenseStatus = "ACTIVE"
    notes: str | None = None


class AgentLicenseUpdateRequest(BaseModel):
    state: str | None = Field(None, min_length=2, max_length=2)
    license_type: str | None = None
    license_number: str | None = None
    issued_on: date | None = None
    expires_on: date | None = None
    status: LicenseStatus | None = None
    verified_at: datetime | None = None
    verified_by_id: UUID | None = None
    notes: str | None = None


class AgentLicenseDTO(BaseModel):
    id: UUID
    user_id: UUID
    state: str = Field(..., min_length=2, max_length=2)
    license_type: str
    license_number: str
    issued_on: date | None = None
    expires_on: date | None = None
    verified_at: datetime | None = None
    verified_by_id: UUID | None = None
    status: LicenseStatus
    file_id: UUID | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    # Pydantic v1 — read attributes from ORM instances.
    class Config:
        orm_mode = True


# ─── Document (user_personal_file) ──────────────────────────────────────────


class AgentDocumentDTO(BaseModel):
    """Read-only list view of an agent's personal files (license scans,
    W-9 PDFs, etc.) — joins user_personal_file + file for display."""
    id: UUID                 # user_personal_file.id (== file.id)
    state: str               # document state (free-form label)
    expiration_date: str | None = None
    # File table columns used by the UI
    name: str | None = None
    type: str | None = None
    size: int | None = None



# ─── AgentBanking ───────────────────────────────────────────────────────────


class AgentBankingDTO(BaseModel):
    """Display-safe banking view. Full account/routing numbers live in
    encrypted-at-rest infrastructure (TBD) — this DTO never carries them."""
    id: UUID
    user_id: UUID
    payout_method: PayoutMethod | None = None
    account_holder_name: str | None = None
    bank_name: str | None = None
    account_number_last4: str | None = Field(None, min_length=4, max_length=4)
    routing_number_last4: str | None = Field(None, min_length=4, max_length=4)
    ach_authorization_signed_at: date | None = None
    ach_authorization_file_id: UUID | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        orm_mode = True

