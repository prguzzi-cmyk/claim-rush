#!/usr/bin/env python

"""Schemas for the Adjuster Case Document module"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AdjusterCaseDocumentBase(BaseModel):
    file_name: str | None = Field(None, max_length=256)
    file_key: str | None = Field(None, max_length=512)
    file_type: str | None = Field(None, max_length=64)
    step: str | None = Field(None, max_length=32)
    ai_extracted_text: str | None = None


class AdjusterCaseDocumentCreate(AdjusterCaseDocumentBase):
    case_id: UUID
    file_name: str = Field(..., max_length=256)
    file_key: str = Field(..., max_length=512)
    file_type: str = Field(..., max_length=64)
    step: str = Field(..., max_length=32)


class AdjusterCaseDocumentInDB(AdjusterCaseDocumentBase):
    id: UUID
    case_id: UUID
    created_at: datetime | None = None

    class Config:
        orm_mode = True
