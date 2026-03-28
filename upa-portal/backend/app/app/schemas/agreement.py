#!/usr/bin/env python

"""Pydantic schemas for the E-Sign Agreement Engine."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AgreementCreate(BaseModel):
    lead_id: Optional[UUID] = None
    agent_id: Optional[UUID] = None
    signer_name: str
    signer_email: Optional[str] = None
    signer_phone: Optional[str] = None
    title: str = "Claim Representation Agreement"
    source: str = "system"
    signing_mode: str = "standard"
    field_config: Optional[list] = None


class AgreementUpdate(BaseModel):
    title: Optional[str] = None
    signer_name: Optional[str] = None
    signer_email: Optional[str] = None
    signer_phone: Optional[str] = None
    status: Optional[str] = None
    signing_mode: Optional[str] = None
    original_pdf_url: Optional[str] = None
    signed_pdf_url: Optional[str] = None
    signature_method: Optional[str] = None
    field_config: Optional[list] = None


class AgreementRead(BaseModel):
    id: UUID
    lead_id: Optional[UUID]
    agent_id: Optional[UUID]
    signer_name: str
    signer_email: Optional[str]
    signer_phone: Optional[str]
    title: str
    source: str
    original_pdf_url: Optional[str]
    signed_pdf_url: Optional[str]
    version: str
    signing_mode: str
    signature_method: Optional[str]
    status: str
    sent_at: Optional[datetime]
    viewed_at: Optional[datetime]
    started_at: Optional[datetime]
    signed_at: Optional[datetime]
    expires_at: Optional[datetime]
    insured_copy_sent: bool
    agent_copy_sent: bool
    reminder_count: int
    field_config: Optional[list]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class AuditEntryRead(BaseModel):
    id: UUID
    agreement_id: UUID
    action: str
    details: Optional[str]
    ip_address: Optional[str]
    device_type: Optional[str]
    browser: Optional[str]
    platform: Optional[str]
    field_id: Optional[str]
    field_type: Optional[str]
    signature_method: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SignRequest(BaseModel):
    signature_method: str  # draw, type, font, i_agree
    signature_data: Optional[str] = None  # base64 image for draw, text for type
    font_name: Optional[str] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    browser: Optional[str] = None
    platform: Optional[str] = None
    completed_fields: list = []  # [{field_id, field_type, value}]


class AgreementMetrics(BaseModel):
    agreements_sent: int
    agreements_viewed: int
    agreements_signed: int
    conversion_rate: float
    certified_usage: int
    pending_signatures: int
    avg_time_to_sign_hours: Optional[float]
