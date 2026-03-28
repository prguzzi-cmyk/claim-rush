#!/usr/bin/env python

"""Schema for Claim"""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, validator

from app.core.enums import ClaimFeeType, ClaimOriginType, ClaimPhases, EscalationPath, ClaimSubStatus, RecoveryMode, RefTypes
from app.schemas import (
    Audit,
    ClaimBusinessEmailMinimal,
    ClaimContact,
    ClaimContactCreate,
    ClaimContactUpdate,
    ClaimPaymentSum,
    ClientMinimal,
    Timestamp,
    ClaimCoverage,
    ClaimCoverageCreate,
    ClaimCoverageUpdate,
    Collaborator,
)
from app.schemas.user import UserAssignedToClaim, UserMinimal
from app.utils.common import generate_ref_string
from app.utils.masters import PolicyTypes


# Shared properties
class ClaimBase(BaseModel):
    loss_date: datetime | None = Field(default=None, description="Loss date and time.")
    peril: str | None = Field(default=None, max_length=100, description="Peril type.")
    insurance_company: str | None = Field(
        default=None, max_length=100, description="Insurance company name."
    )
    policy_number: str | None = Field(
        default=None, max_length=50, description="Insurance policy number."
    )
    policy_type: str | None = Field(
        default=None, max_length=100, description="Insurance policy type."
    )
    sub_policy_type: str | None = Field(
        default=None, max_length=255, description="Insurance sub policy type."
    )
    date_logged: date | None = Field(default=None, description="Policy logged date.")
    lawsuit_deadline: date | None = Field(default=None, description="Lawsuit deadline.")
    mortgage_company: str | None = Field(
        default=None, max_length=100, description="Name of the Mortgage company."
    )
    fema_claim: bool | None = Field(default=False, description="Is the claim Fema?")
    state_of_emergency: bool | None = Field(
        default=False, description="Is it State of Emergency?"
    )
    inhabitable: bool | None = Field(default=False, description="Is Inhabitable?")
    contract_sign_date: date | None = Field(
        default=None, description="The Contract Sign date."
    )
    coverages: list[ClaimCoverage] | None = Field(
        default=None, description="A list of Claim Coverages."
    )
    anticipated_amount: float | None = Field(
        default=None, description="Anticipated amount for the claim."
    )
    fee_type: ClaimFeeType | None = Field(default=None, description="Claim fee type.")
    fee: float | None = Field(default=None, description="Claim fee.")
    claim_number: str | None = Field(
        default=None, max_length=50, description="Claim number."
    )
    current_phase: ClaimPhases | None = Field(
        default=None, title="Claim Phase", description="Claim phase."
    )
    escalation_path: EscalationPath | None = Field(
        default=None, description="Escalation path."
    )
    sub_status: ClaimSubStatus | None = Field(
        default=None, description="Sub-status."
    )
    origin_type: ClaimOriginType | None = Field(
        default=None, description="How the claim entered the platform."
    )
    date_aci_entered: date | None = Field(
        default=None, description="Date ACI entered the claim."
    )
    prior_carrier_payments: float | None = Field(
        default=None, description="Prior carrier payments before ACI involvement."
    )
    recovery_mode: RecoveryMode | None = Field(
        default=None, description="Recovery mode for the claim."
    )
    source: UUID | None = Field(
        default=None, description="The user who sourced the claim."
    )
    source_info: str | None = Field(
        default=None, max_length=100, description="Claim source information."
    )
    signed_by: UUID | None = Field(
        default=None, description="The user who signed the claim."
    )
    adjusted_by: UUID | None = Field(
        default=None, description="The user who adjusted the claim."
    )
    instructions_or_notes: str | None = Field(
        default=None, description="Instructions or Notes for an agent."
    )
    assigned_to: UUID | None = Field(
        default=None, description="Claim assigned to an agent."
    )
    client_id: UUID | None = Field(
        default=None, description="Claim belongs to a client."
    )
    can_be_removed: bool | None = Field(
        default=True, description="Is the claim can be removed?"
    )


# Properties to receive via API on creation
class ClaimCreate(ClaimBase):
    fee_type: ClaimFeeType = Field(
        default=ClaimFeeType.PERCENTAGE, description="Claim fee type."
    )
    current_phase: ClaimPhases = Field(
        default=ClaimPhases.CLAIM_REPORTED,
        title="Claim Phase",
        description="Claim phase.",
    )
    escalation_path: EscalationPath = Field(
        default=EscalationPath.NONE, description="Escalation path."
    )
    sub_status: ClaimSubStatus = Field(
        default=ClaimSubStatus.NONE, description="Sub-status."
    )
    origin_type: ClaimOriginType = Field(
        default=ClaimOriginType.NEW_CLAIM, description="How the claim entered the platform."
    )
    recovery_mode: RecoveryMode = Field(
        default=RecoveryMode.NONE, description="Recovery mode."
    )

    assigned_to: UUID = Field(description="Claim assigned to an agent.")
    client_id: UUID = Field(description="Claim belongs to a client.")

    # Relationships
    coverages: list[ClaimCoverageCreate] | None = Field(
        default=None, description="A list of Claim Coverages."
    )
    claim_contact: ClaimContactCreate | None = Field(
        description="Claim contact information."
    )


# Properties to receive via API on update
class ClaimUpdate(ClaimBase):
    fema_claim: bool | None = Field(description="Is the claim Fema?")
    state_of_emergency: bool | None = Field(description="Is it State of Emergency?")
    inhabitable: bool | None = Field(description="Is Inhabitable?")
    can_be_removed: bool | None = Field(description="Is the claim can be removed?")

    # Relationships
    coverages: list[ClaimCoverageUpdate] | None = Field(
        default=None, description="A list of Claim Coverages."
    )
    claim_contact: ClaimContactUpdate | None = Field(
        default=None, description="Claim contact information."
    )


# Properties to return via API on claim fetch from DB
class ClaimInDB(ClaimBase):
    id: UUID | None = Field(description="Claim ID.")
    claim_role: str | None = Field(description="The user role for a claim.")
    ref_number: int | None = Field(description="Claim reference number.")
    ref_string: str | None = Field(description="Claim reference string.")
    policy_type_name: str | None = Field(description="Insurance policy type name.")
    sub_policy_type_name: str | None = Field(
        description="Insurance sub policy type name."
    )
    lawsuit_deadline: date | None = Field(description="Lawsuit deadline.")
    mortgage_company: str | None = Field(
        max_length=100, description="Name of the Mortgage company."
    )
    fema_claim: bool | None = Field(description="Is the claim Fema?")
    state_of_emergency: bool | None = Field(description="Is it State of Emergency?")
    inhabitable: bool | None = Field(description="Is Inhabitable?")
    contract_sign_date: date | None = Field(description="The Contract Sign date.")
    claim_business_email: ClaimBusinessEmailMinimal | None = Field(
        description="Business email data."
    )
    can_be_removed: bool | None = Field(description="Is that claim can be removed?")
    is_removed: bool | None = Field(description="Is the claim removed?")

    @validator("ref_string", always=True)
    def generate_ref_string(cls, value: Any, values: Any) -> str:
        return generate_ref_string(RefTypes.CLAIM, str(values["ref_number"]))

    @validator("policy_type_name", always=True)
    def get_policy_type_name(cls, value: Any, values: Any) -> str:
        if values["policy_type"]:
            policy_type = PolicyTypes().get_policy_type(
                policy_slug=str(values["policy_type"])
            )
            return policy_type.name if policy_type else None

    @validator("sub_policy_type_name", always=True)
    def get_sub_policy_type_name(cls, value: Any, values: Any) -> str:
        if values["sub_policy_type"] and values["policy_type"]:
            sub_policy_type = PolicyTypes().get_sub_policy_type(
                policy_slug=str(values["policy_type"]),
                sub_policy_slug=str(values["sub_policy_type"]),
            )
            return sub_policy_type.name if sub_policy_type else None

    # Relationships
    client: ClientMinimal | None = Field(description="Claim client information.")
    claim_contact: ClaimContact | None = Field(description="Claim contact information.")
    source_user: UserMinimal | None = Field(
        default=None, description="The user who sourced the claim."
    )
    signed_by_user: UserMinimal | None = Field(
        default=None, description="The user who signed the claim."
    )
    adjusted_by_user: UserMinimal | None = Field(
        default=None, description="The user who adjusted the claim."
    )
    assigned_user: UserAssignedToClaim | None = Field(
        description="Claim assigned user details."
    )

    class Config:
        orm_mode = True


# Additional properties to return via API
class Claim(Timestamp, Audit, ClaimInDB, Collaborator):
    is_collaborator: bool = Field(
        False, const=True, description="If the user is a collaborator."
    )


class ClaimPaymentsSum(BaseModel):
    payments_sum: list[ClaimPaymentSum] | None = Field(
        description="A sum of claim payments by their type."
    )


class ClaimDetailed(ClaimPaymentsSum, Claim):
    pass


class ClaimPhase(BaseModel):
    display_name: str | None = Field(description="The key of the claim phase.")
    slug: str | None = Field(description="The value of the claim phase.")


class ClaimEscalationPath(BaseModel):
    display_name: str | None = Field(description="Display name.")
    slug: str | None = Field(description="Slug value.")


class ClaimSubStatusOption(BaseModel):
    display_name: str | None = Field(description="Display name.")
    slug: str | None = Field(description="Slug value.")


class ClaimOriginTypeOption(BaseModel):
    display_name: str | None = Field(description="Display name.")
    slug: str | None = Field(description="Slug value.")


class RecoveryModeOption(BaseModel):
    display_name: str | None = Field(description="Display name.")
    slug: str | None = Field(description="Slug value.")


class ClaimsByPhase(BaseModel):
    current_phase: str | None = Field(description="Current phase of the claim.")
    claims_count: int | None = Field(
        description="Number of claims in the current phase."
    )

    class Config:
        orm_mode = True


class ClaimPayout(BaseModel):
    id: UUID | None = Field(description="Claim ID.")
    loss_date: datetime | None = Field(description="Loss date and time.")
    ref_number: int | None = Field(description="Claim reference number.")
    ref_string: str | None = Field(description="Claim reference string.")
    fee_type: ClaimFeeType | None = Field(description="Claim fee type.")
    fee: float | None = Field(description="Claim fee.")
    client_id: UUID | None = Field(description="Claim belongs to a client.")
    source: UUID | None = Field(description="The user who sourced the claim.")
    signed_by: UUID | None = Field(description="The user who signed the claim.")
    adjusted_by: UUID | None = Field(description="The user who adjusted the claim.")

    @validator("ref_string", always=True)
    def generate_ref_string(cls, value: Any, values: Any) -> str:
        return generate_ref_string(RefTypes.CLAIM, str(values["ref_number"]))

    # Relationships
    source_user: UserMinimal | None = Field(
        default=None, description="The user who sourced the claim."
    )
    signed_by_user: UserMinimal | None = Field(
        default=None, description="The user who signed the claim."
    )
    adjusted_by_user: UserMinimal | None = Field(
        default=None, description="The user who adjusted the claim."
    )

    class Config:
        orm_mode = True
