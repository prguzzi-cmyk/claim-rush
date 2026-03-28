#!/usr/bin/env python

"""Schemas for the Policy Clause module — AI-extracted structured policy data."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PolicyClauseBase(BaseModel):
    clause_type: str = Field(..., max_length=64)
    title: str = Field(..., max_length=256)
    summary: str | None = None
    raw_text: str | None = None
    amount: float | None = None
    percentage: float | None = None
    section_reference: str | None = Field(None, max_length=128)
    applies_to: str | None = Field(None, max_length=256)
    ai_confidence: float = 0.0
    sort_order: int = 0


class PolicyClauseCreate(PolicyClauseBase):
    policy_document_id: UUID


class PolicyClauseUpdate(BaseModel):
    clause_type: str | None = Field(None, max_length=64)
    title: str | None = Field(None, max_length=256)
    summary: str | None = None
    raw_text: str | None = None
    amount: float | None = None
    percentage: float | None = None
    section_reference: str | None = Field(None, max_length=128)
    applies_to: str | None = Field(None, max_length=256)
    ai_confidence: float | None = None
    sort_order: int | None = None


class PolicyClauseInDB(PolicyClauseBase):
    id: UUID
    policy_document_id: UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        orm_mode = True


class AssistantActionRequest(BaseModel):
    action_type: str
    claim_context: str | None = None


class AssistantActionResponse(BaseModel):
    action_type: str
    result_text: str
    clauses_referenced: list[UUID] = []
