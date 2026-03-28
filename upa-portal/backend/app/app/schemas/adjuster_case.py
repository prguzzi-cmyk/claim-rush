#!/usr/bin/env python

"""Schemas for the Adjuster Case module"""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.adjuster_case_document import AdjusterCaseDocumentInDB
from app.schemas.adjuster_case_policy_analysis import AdjusterCasePolicyAnalysisInDB


class AdjusterCaseBase(BaseModel):
    fire_claim_id: UUID | None = None
    estimate_project_id: UUID | None = None
    assigned_pa_id: UUID | None = None
    intake_notes: str | None = None
    intake_loss_date: date | None = None
    intake_loss_type: str | None = Field(None, max_length=64)
    intake_address: str | None = Field(None, max_length=256)
    intake_insured_name: str | None = Field(None, max_length=128)
    intake_carrier: str | None = Field(None, max_length=128)
    intake_policy_number: str | None = Field(None, max_length=64)
    intake_claim_number: str | None = Field(None, max_length=64)
    scope_notes: str | None = None
    scope_ai_summary: str | None = None
    damage_ai_summary: str | None = None
    pa_notes: str | None = None


class AdjusterCaseCreate(BaseModel):
    """Intake step — only the fields needed to start a case."""
    fire_claim_id: UUID | None = None
    intake_loss_date: date | None = None
    intake_loss_type: str | None = Field(None, max_length=64)
    intake_address: str | None = Field(None, max_length=256)
    intake_insured_name: str | None = Field(None, max_length=128)
    intake_carrier: str | None = Field(None, max_length=128)
    intake_policy_number: str | None = Field(None, max_length=64)
    intake_claim_number: str | None = Field(None, max_length=64)
    intake_notes: str | None = None


class AdjusterCaseUpdate(AdjusterCaseBase):
    """All optional — used for PATCH updates at any step."""
    pass


class AdjusterCaseInDB(AdjusterCaseBase):
    id: UUID
    case_number: str
    status: str
    current_step: int
    pa_approved: bool = False
    pa_approved_at: datetime | None = None
    final_report_url: str | None = None
    created_by_id: UUID | None = None
    updated_by_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    documents: list[AdjusterCaseDocumentInDB] = []
    policy_analyses: list[AdjusterCasePolicyAnalysisInDB] = []

    class Config:
        orm_mode = True


class AdjusterCaseList(BaseModel):
    """Lightweight list view."""
    id: UUID
    case_number: str
    status: str
    current_step: int
    intake_address: str | None = None
    intake_insured_name: str | None = None
    created_at: datetime | None = None

    class Config:
        orm_mode = True
