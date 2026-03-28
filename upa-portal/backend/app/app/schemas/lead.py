#!/usr/bin/env python

"""Schema for Lead"""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, validator

from app.core.enums import LeadSource, LeadStatus, LeadStatusCreate, RefTypes
from app.schemas import (
    Audit,
    LeadContact,
    LeadContactCreate,
    LeadContactUpdate,
    Timestamp,
)
from app.schemas.user import UserAssignedToLead, UserMinimal
from app.utils.common import generate_ref_string


# Shared properties
class LeadBase(BaseModel):
    loss_date: datetime | None = Field(default=None, description="Loss date and time.")
    peril: str | None = Field(default=None, max_length=100, description="Peril type.")
    insurance_company: str | None = Field(
        default=None, max_length=100, description="Insurance company name."
    )
    policy_number: str | None = Field(
        default=None, max_length=50, description="Insurance policy number."
    )
    claim_number: str | None = Field(
        default=None, max_length=50, description="Claim number."
    )
    status: LeadStatus | None = Field(default=None, description="Lead status.")
    source: UUID | None = Field(
        default=None, description="The user who sourced the lead."
    )
    source_info: str | None = Field(
        default=None,
        max_length=100,
        description="Lead other source info.\n\n"
        "_**Note:** "
        f"Required when source value is `{LeadSource.OTHER.value}`._",
    )
    instructions_or_notes: str | None = Field(
        default=None, description="Instructions or Notes for an agent."
    )
    assigned_to: UUID | None = Field(
        default=None, description="Lead assigned to an agent."
    )
    lead_user_id: UUID | None = Field(
        default=None, description="The user account id for a lead."
    )
    client_id: UUID | None = Field(
        default=None, description="Lead belongs to a client."
    )
    can_be_removed: bool | None = Field(
        default=True, description="Is the lead can be removed?"
    )
    last_outcome_status: str | None = Field(
        default=None, max_length=50, description="Denormalized latest outcome status."
    )
    score_tier: str | None = Field(
        default=None, max_length=20, description="Lead score tier (high|strong|medium|low)."
    )
    is_rescued: bool | None = Field(
        default=False, description="Whether this lead has been rescued."
    )
    info_sent_at: datetime | None = Field(
        default=None, description="Timestamp when brochure/info was sent."
    )

    @validator("source_info")
    def required_for_other_source(cls, value: Any, values: Any) -> Any:
        if (
            "source" in values
            and values["source"] == LeadSource.OTHER.value
            and value == ""
        ):
            raise ValueError(
                f"Source information can't be blank "
                f"if source is {LeadSource.OTHER.value}"
            )

        return value


# Properties to receive via API on creation
class LeadCreate(LeadBase):
    status: LeadStatusCreate = Field(
        default=LeadStatusCreate.CALLBACK,
        title="Lead Status",
        description="Lead status.",
    )

    # Relationships
    contact: LeadContactCreate = Field(description="Lead contact information.")


# Properties to receive via API on update
class LeadUpdate(LeadBase):
    is_removed: bool | None = Field(default=None, description="Is the lead removed?")

    # Relationships
    contact: LeadContactUpdate | None = Field(
        default=None, description="Lead contact information."
    )


# Properties to return via API on lead fetch from DB
class LeadInDB(LeadBase):
    id: UUID | None = Field(description="Lead ID.")
    ref_number: int | None = Field(description="Lead reference number.")
    ref_string: str | None = Field(description="Lead reference string.")
    can_be_removed: bool | None = Field(description="Is that lead can be removed?")
    is_removed: bool | None = Field(description="Is the lead removed?")

    @validator("ref_string", always=True)
    def generate_ref_string(cls, value: Any, values: Any) -> str:
        return generate_ref_string(RefTypes.LEAD, str(values["ref_number"]))

    # Relationships
    source_user: UserMinimal | None = Field(
        default=None, description="The user who sourced the lead."
    )
    contact: LeadContact | None = Field(description="Lead contact information.")
    assigned_user: UserAssignedToLead | None = Field(
        description="Lead assigned user details."
    )

    class Config:
        orm_mode = True


# Additional properties to return via API
class Lead(Timestamp, Audit, LeadInDB):
    pass


class LeadsByStatus(BaseModel):
    status: str | None = Field(description="Status of the lead.")
    leads_count: int | None = Field(description="Number of leads in the status.")

    class Config:
        orm_mode = True


class LeadsBySource(BaseModel):
    user_name: str | None = Field(description="The user name who sourced the lead.")
    email: str | None = Field(description="The user email who sourced the lead.")
    source: UUID | None = Field(description="The user ID who sourced the lead.")
    leads_count: int | None = Field(description="Number of leads in the source.")

    class Config:
        orm_mode = True


class LeadsByAssignedUser(BaseModel):
    display_name: str | None = Field(description="The user display name.")
    leads_count: int | None = Field(description="Number of leads assigned to the user.")

    class Config:
        orm_mode = True


class LeadConvertRequest(BaseModel):
    contract_sign_date: date | None = Field(default=None, description="Contract sign date.")
    fee_type: str | None = Field(default=None, description="Fee type: 'percentage' or 'flat'.")
    fee: float | None = Field(default=None, description="Fee amount.")
    notes: str | None = Field(default=None, description="Optional conversion notes.")
