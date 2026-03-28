#!/usr/bin/env python

"""Schemas for the Adjuster Case Policy Analysis module"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AdjusterCasePolicyAnalysisBase(BaseModel):
    coverage_type: str | None = Field(None, max_length=128)
    limit_amount: float | None = None
    deductible: float | None = None
    exclusions: str | None = None
    ai_confidence: float | None = 0.0
    raw_ai_response: str | None = None


class AdjusterCasePolicyAnalysisCreate(AdjusterCasePolicyAnalysisBase):
    case_id: UUID
    coverage_type: str = Field(..., max_length=128)


class AdjusterCasePolicyAnalysisInDB(AdjusterCasePolicyAnalysisBase):
    id: UUID
    case_id: UUID
    created_at: datetime | None = None

    class Config:
        orm_mode = True
