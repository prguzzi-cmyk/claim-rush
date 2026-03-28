#!/usr/bin/env python

"""Pydantic schemas for the LeadSkipTrace module"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class LeadSkipTraceBase(BaseModel):
    owner_first_name: str | None = Field(default=None, description="Owner first name.")
    owner_middle_name: str | None = Field(default=None, description="Owner middle name.")
    owner_last_name: str | None = Field(default=None, description="Owner last name.")
    owner_full_name: str | None = Field(default=None, description="Owner full name.")
    owner_age: str | None = Field(default=None, description="Owner age.")
    owner_email: str | None = Field(default=None, description="Owner email address.")
    owner_phone: str | None = Field(default=None, description="Owner phone number.")
    owner_mailing_street: str | None = Field(default=None, description="Mailing street address.")
    owner_mailing_street2: str | None = Field(default=None, description="Mailing street line 2.")
    owner_mailing_city: str | None = Field(default=None, description="Mailing city.")
    owner_mailing_state: str | None = Field(default=None, description="Mailing state.")
    owner_mailing_zip: str | None = Field(default=None, description="Mailing ZIP code.")
    skiptrace_status: str = Field(default="pending", description="Status: pending, success, partial, failed.")
    skiptrace_ran_at: datetime | None = Field(default=None, description="Timestamp of last skip trace run.")


# Properties required when creating
class LeadSkipTraceCreate(LeadSkipTraceBase):
    lead_id: UUID = Field(description="Associated lead UUID.")


# Properties accepted on update
class LeadSkipTraceUpdate(LeadSkipTraceBase):
    skiptrace_status: str | None = Field(default=None, description="Status.")
    skiptrace_raw_response: str | None = Field(default=None, description="Raw JSON response.")


# Properties returned from DB
class LeadSkipTraceInDB(LeadSkipTraceBase):
    id: UUID | None = Field(description="Skip trace UUID primary key.")
    lead_id: UUID = Field(description="Associated lead UUID.")

    class Config:
        orm_mode = True


# Full response schema (includes timestamps)
class LeadSkipTrace(Timestamp, LeadSkipTraceInDB):
    ...
