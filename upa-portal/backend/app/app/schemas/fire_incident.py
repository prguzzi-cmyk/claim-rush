#!/usr/bin/env python

"""Pydantic schemas for the FireIncident module"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, root_validator

from app.schemas import Timestamp
from app.schemas.fire_agency import FireAgencyInDB
from app.schemas.lead_contact import LeadContactCreate


# Shared properties
class FireIncidentBase(BaseModel):
    pulsepoint_id: str | None = Field(
        default=None, description="Internal dispatch incident ID (dedup key)."
    )
    call_type: str | None = Field(
        default=None, max_length=20, description="Call type code (e.g. 'SF', 'WF', 'SAT')."
    )
    call_type_description: str | None = Field(
        default=None, max_length=100, description="Human-readable call type (e.g. 'Structure Fire')."
    )
    address: str | None = Field(
        default=None, description="Full display address of the incident."
    )
    latitude: float | None = Field(default=None, description="Incident latitude.")
    longitude: float | None = Field(default=None, description="Incident longitude.")
    received_at: datetime | None = Field(
        default=None, description="Datetime the call was received."
    )
    units: str | None = Field(
        default=None, description="JSON-encoded list of responding unit IDs."
    )
    dispatch_status: str | None = Field(
        default="active",
        description="Dispatch lifecycle: 'active', 'cleared', or 'archived'.",
    )
    is_active: bool | None = Field(
        default=True, description="Legacy compat — True when dispatch_status='active'."
    )
    cleared_at: datetime | None = Field(
        default=None, description="Timestamp when the incident cleared from active dispatch."
    )
    auto_lead_attempted: bool | None = Field(
        default=False, description="Whether auto-lead conversion was attempted."
    )
    auto_lead_skipped_reason: str | None = Field(
        default=None, description="Reason auto-lead conversion was skipped."
    )
    data_source: str | None = Field(
        default="pulsepoint", description="Internal provider code (never exposed to API consumers)."
    )
    external_id: str | None = Field(
        default=None, description="Generic dedup key across all data sources."
    )
    source_url: str | None = Field(
        default=None, description="Link back to the original data source."
    )


# Properties required when creating an incident
class FireIncidentCreate(FireIncidentBase):
    call_type: str = Field(max_length=20, description="Call type code.")
    agency_id: UUID | None = Field(default=None, description="UUID of the parent FireAgency (nullable for some sources).")


# Properties accepted on update
class FireIncidentUpdate(FireIncidentBase):
    pass


# Properties returned from DB — strips provider-specific fields for API consumers
class FireIncidentInDB(BaseModel):
    id: UUID | None = Field(description="Incident UUID primary key.")
    call_type: str | None = Field(default=None)
    call_type_description: str | None = Field(default=None)
    address: str | None = Field(default=None)
    latitude: float | None = Field(default=None)
    longitude: float | None = Field(default=None)
    received_at: datetime | None = Field(default=None)
    units: str | None = Field(default=None)
    dispatch_status: str | None = Field(default="active")
    is_active: bool | None = Field(default=True)
    cleared_at: datetime | None = Field(default=None)
    agency_id: UUID | None = Field(default=None, description="Parent FireAgency UUID.")
    lead_id: UUID | None = Field(default=None, description="Associated lead UUID (if converted).")
    agency: FireAgencyInDB | None = Field(default=None, description="Parent agency details.")
    source_display: str = Field(default="UPA Incident Intelligence Network", description="Intelligence network source.")

    @root_validator(pre=True)
    @classmethod
    def set_source_display(cls, values):
        """Always set source_display to 'UPA Incident Intelligence Network' and strip internal fields."""
        if isinstance(values, dict):
            values["source_display"] = "UPA Incident Intelligence Network"
            values.pop("data_source", None)
            values.pop("external_id", None)
            values.pop("source_url", None)
            values.pop("pulsepoint_id", None)
        return values

    class Config:
        orm_mode = True


# Full response schema (includes timestamps)
class FireIncident(Timestamp, FireIncidentInDB):
    ...


# Schema for converting a fire incident to a lead
class FireIncidentConvertToLead(BaseModel):
    full_name: str = Field(max_length=100, description="Contact full name (required).")
    phone_number: str = Field(max_length=20, description="Contact phone number (required).")
    email: str | None = Field(default=None, description="Contact email address.")
    peril: str | None = Field(default=None, max_length=100, description="Peril type (defaults to call_type_description).")
    loss_date: datetime | None = Field(default=None, description="Loss date (defaults to incident received_at).")
    insurance_company: str | None = Field(default=None, max_length=100, description="Insurance company name.")
    instructions_or_notes: str | None = Field(default=None, description="Instructions or notes for the agent.")
    assigned_to: UUID | None = Field(default=None, description="Assign the lead to a user.")
    skip_traced: bool = Field(default=False, description="Whether this lead was created from skip trace data.")


# Skip trace response schemas
class SkipTraceResident(BaseModel):
    full_name: str = Field(description="Resident full name.")
    phone_numbers: list[str] = Field(default_factory=list, description="Phone numbers found.")
    emails: list[str] = Field(default_factory=list, description="Email addresses found.")
    age: str | None = Field(default=None, description="Estimated age.")


class SkipTraceResponse(BaseModel):
    residents: list[SkipTraceResident] = Field(default_factory=list, description="Residents found at the address.")
    source: str = Field(description="Skip trace provider used.")
    address_queried: str = Field(description="Address that was looked up.")


class SendSmsRequest(BaseModel):
    phone: str = Field(max_length=20, description="Recipient phone number in E.164 format.")
    message: str = Field(max_length=500, description="SMS body text.")


class SendSmsResponse(BaseModel):
    success: bool = Field(description="Whether the SMS was sent successfully.")
    communication_log_id: UUID = Field(description="UUID of the CommunicationLog record.")
    message: str = Field(description="Status message.")
