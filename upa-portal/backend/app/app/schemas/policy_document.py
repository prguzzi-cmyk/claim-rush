#!/usr/bin/env python

"""Schemas for the Policy Document Vault module"""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.policy_clause import PolicyClauseInDB
from app.schemas.policy_intelligence import PolicyIntelligenceInDB


class PolicyDocumentBase(BaseModel):
    insured_name: str | None = Field(None, max_length=200)
    carrier: str | None = Field(None, max_length=200)
    policy_number: str | None = Field(None, max_length=100)
    claim_number: str | None = Field(None, max_length=100)
    policy_type: str | None = Field(None, max_length=64)
    effective_date: date | None = None
    expiration_date: date | None = None
    property_address: str | None = Field(None, max_length=256)
    property_city: str | None = Field(None, max_length=100)
    property_state: str | None = Field(None, max_length=2)
    property_zip: str | None = Field(None, max_length=10)
    notes: str | None = None
    claim_id: UUID | None = None
    client_id: UUID | None = None
    lead_id: UUID | None = None
    fire_claim_id: UUID | None = None
    adjuster_case_id: UUID | None = None


class PolicyDocumentCreate(PolicyDocumentBase):
    file_name: str = Field(..., max_length=256)
    file_key: str = Field(..., max_length=512)
    file_size: int | None = None
    content_type: str = Field("application/pdf", max_length=64)
    parent_id: UUID | None = None
    version: int = 1


class PolicyDocumentUpdate(PolicyDocumentBase):
    extraction_status: str | None = Field(None, max_length=32)
    ai_summary: str | None = None
    assistant_ready: bool | None = None
    claim_guidance_notes: str | None = None


class PolicyDocumentInDB(PolicyDocumentBase):
    id: UUID
    file_name: str
    file_key: str
    file_size: int | None = None
    content_type: str = "application/pdf"
    ai_extracted_text: str | None = None
    ai_metadata_json: str | None = None
    extraction_status: str = "pending"
    ai_summary: str | None = None
    assistant_ready: bool = False
    claim_guidance_notes: str | None = None
    clauses: list[PolicyClauseInDB] = []
    intelligence: PolicyIntelligenceInDB | None = None
    parent_id: UUID | None = None
    version: int = 1
    is_removed: bool = False
    can_be_removed: bool = True
    created_by_id: UUID | None = None
    updated_by_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        orm_mode = True


class PolicyDocumentList(BaseModel):
    id: UUID
    file_name: str
    insured_name: str | None = None
    carrier: str | None = None
    policy_number: str | None = None
    claim_number: str | None = None
    policy_type: str | None = None
    effective_date: date | None = None
    expiration_date: date | None = None
    property_state: str | None = None
    extraction_status: str = "pending"
    assistant_ready: bool = False
    version: int = 1
    parent_id: UUID | None = None
    claim_id: UUID | None = None
    client_id: UUID | None = None
    adjuster_case_id: UUID | None = None
    created_at: datetime | None = None

    class Config:
        orm_mode = True


class PolicyDocumentAttach(BaseModel):
    policy_document_id: UUID
    claim_id: UUID | None = None
    client_id: UUID | None = None
    lead_id: UUID | None = None
    fire_claim_id: UUID | None = None
    adjuster_case_id: UUID | None = None


class ImportFromClaimFileRequest(BaseModel):
    claim_file_id: UUID = Field(description="The claim file ID to import.")
    fire_claim_id: UUID = Field(description="The fire claim ID to link the policy to.")
