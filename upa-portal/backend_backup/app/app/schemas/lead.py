#!/usr/bin/env python

"""Schema for follow up"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, validator

from app.core.tags import LeadSource, LeadStatus
from app.schemas import (
    Audit,
    Contact,
    ContactCreate,
    ContactUpdate,
    FollowUp,
    FollowUpCreate,
    Timestamp,
)


# Shared properties
class LeadBase(BaseModel):
    loss_date: datetime | None = Field(default=None, description="Loss date and time")
    peril: str | None = Field(default=None, description="Peril")
    insurance_company: str | None = Field(
        default=None, description="Insurance company name"
    )
    policy_number: str | None = Field(
        default=None, description="Insurance policy number"
    )
    claim_number: str | None | None = Field(default=None, description="Claim Number")
    status: LeadStatus | None = Field(default=None, description="Lead status")
    source: LeadSource | None = Field(default=None, description="Lead source")
    source_info: str | None | None = Field(
        default=None, description="Lead other source info"
    )
    instructions_or_notes: str | None | None = Field(
        default=None, description="Instructions or Notes for an agent"
    )
    assigned_to: UUID | None = Field(
        default=None, description="Lead assigned to an agent"
    )
    can_be_removed: bool | None = Field(
        default=True, description="Is the lead can be removed?"
    )

    @validator("source_info")
    def required_for_other_source(cls, value: Any, values: Any) -> Any:
        if (
            "source" in values
            and values["source"] == LeadSource.OTHER.value
            and value == ""
        ):
            raise ValueError(
                f"Source information can't be blank if source is {LeadSource.OTHER.value}"
            )

        return value


# Properties to receive via API on creation
class LeadCreate(LeadBase):
    loss_date: datetime = Field(description="Loss date and time")
    peril: str = Field(description="Peril")
    insurance_company: str = Field(description="Insurance company name")
    policy_number: str = Field(description="Insurance policy number")
    status: LeadStatus = Field(description="Lead status")
    source: LeadSource = Field(description="Lead source")

    # Relationships
    contact: ContactCreate = Field(description="Lead contact information")
    follow_ups: list[FollowUpCreate] | None = Field(
        default=None, description="Lead follow-up"
    )


# Properties to receive via API on update
class LeadUpdate(LeadBase):
    is_removed: bool | None = Field(default=None, description="Is the lead removed?")

    # Relationships
    contact: ContactUpdate | None = Field(
        default=None, description="Lead contact information"
    )


# Properties to return via API on user fetch from DB
class LeadInDB(LeadBase):
    id: UUID | None = Field(description="Lead id")
    can_be_removed: bool | None = Field(description="Is that lead can be removed?")
    is_removed: bool | None = Field(description="Is the lead removed?")

    # Relationships
    contact: Contact | None = Field(description="Lead contact information")
    follow_ups: list[FollowUp] | None = Field(description="Lead follow-up")

    class Config:
        orm_mode = True


# Additional properties to return via API
class Lead(Timestamp, Audit, LeadInDB):
    ...
