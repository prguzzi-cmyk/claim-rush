#!/usr/bin/env python

"""Schemas for the Policy Intelligence module — consolidated structured policy data."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PolicyIntelligenceBase(BaseModel):
    carrier: str | None = Field(None, max_length=200)
    insured_name: str | None = Field(None, max_length=200)
    policy_number: str | None = Field(None, max_length=100)

    # Coverage limits
    coverage_a_dwelling: float | None = None
    coverage_b_other_structures: float | None = None
    coverage_c_personal_property: float | None = None
    coverage_d_loss_of_use: float | None = None
    coverage_e_liability: float | None = None
    coverage_f_medical: float | None = None
    other_coverage_json: str | None = None

    # Deductibles
    deductible_amount: float | None = None
    deductible_percentage: float | None = None
    deductible_wind_hail: float | None = None
    deductible_hurricane: float | None = None
    deductible_details: str | None = None

    # Clause text
    endorsements_json: str | None = None
    exclusions_json: str | None = None
    replacement_cost_language: str | None = None
    ordinance_and_law: str | None = None
    matching_language: str | None = None
    loss_settlement_clause: str | None = None
    appraisal_clause: str | None = None
    duties_after_loss: str | None = None
    ale_loss_of_use_details: str | None = None
    deadline_notice_details: str | None = None

    # AI
    ai_summary: str | None = None
    confidence_score: float | None = None


class PolicyIntelligenceCreate(PolicyIntelligenceBase):
    policy_document_id: UUID


class PolicyIntelligenceUpdate(BaseModel):
    carrier: str | None = None
    insured_name: str | None = None
    policy_number: str | None = None
    coverage_a_dwelling: float | None = None
    coverage_b_other_structures: float | None = None
    coverage_c_personal_property: float | None = None
    coverage_d_loss_of_use: float | None = None
    coverage_e_liability: float | None = None
    coverage_f_medical: float | None = None
    other_coverage_json: str | None = None
    deductible_amount: float | None = None
    deductible_percentage: float | None = None
    deductible_wind_hail: float | None = None
    deductible_hurricane: float | None = None
    deductible_details: str | None = None
    endorsements_json: str | None = None
    exclusions_json: str | None = None
    replacement_cost_language: str | None = None
    ordinance_and_law: str | None = None
    matching_language: str | None = None
    loss_settlement_clause: str | None = None
    appraisal_clause: str | None = None
    duties_after_loss: str | None = None
    ale_loss_of_use_details: str | None = None
    deadline_notice_details: str | None = None
    ai_summary: str | None = None
    confidence_score: float | None = None


class PolicyIntelligenceInDB(PolicyIntelligenceBase):
    id: UUID
    policy_document_id: UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        orm_mode = True
