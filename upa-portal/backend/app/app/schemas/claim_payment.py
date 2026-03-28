#!/usr/bin/env python

"""Schema for Claim Payment"""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import ClaimPaymentCheckTypes
from app.schemas import Audit, Timestamp


# Shared properties
class ClaimPaymentBase(BaseModel):
    payment_date: date | None = Field(default=None, description="Claim payment date.")
    check_amount: float | None = Field(
        default=None, description="Claim payment amount."
    )
    check_type: ClaimPaymentCheckTypes | None = Field(
        default=None, description="The type of the payment."
    )
    ref_number: str | None = Field(
        default=None, description="Payment Check/Reference number."
    )
    payment_type: str | None = Field(
        default=None, description="The payment type category."
    )
    issued_by: str | None = Field(
        default=None, description="Who issued the payment."
    )
    payee: str | None = Field(
        default=None, description="Payee / check issued to."
    )
    deposit_status: str | None = Field(
        default=None, description="Deposit status of the payment."
    )
    related_coverage: str | None = Field(
        default=None, description="Related coverage type."
    )
    note: str | None = Field(default=None, description="Payment note.")
    contingency_fee_percentage: float | None = Field(
        default=None, description="The contingency fee percentage.", le=100.00
    )
    appraisal_fee: float | None = Field(
        default=None, description="The appraisal fee amount."
    )
    umpire_fee: float | None = Field(default=None, description="The umpire fee amount.")
    mold_fee: float | None = Field(default=None, description="The mold fee amount.")
    misc_fee: float | None = Field(
        default=None, description="Miscellaneous fee amount."
    )


# Properties to receive via API on creation
class ClaimPaymentCreate(ClaimPaymentBase):
    payment_date: date = Field(
        default=date.today(),
        description="Claim payment date. \n\n _**Note:** The default will be today's date._",
    )
    check_amount: float = Field(description="Claim payment amount.")
    check_type: ClaimPaymentCheckTypes | None = Field(
        default=ClaimPaymentCheckTypes.STANDARD, description="The type of the payment."
    )
    contingency_fee_percentage: float = Field(
        default=10.00, description="The contingency fee percentage.", le=100.00
    )


# Properties to receive via API on creation
class ClaimPaymentCreateDB(ClaimPaymentCreate):
    claim_id: UUID = Field(description="The claim ID.")


# Properties to receive via API on update
class ClaimPaymentUpdate(ClaimPaymentBase):
    is_ready_to_process: bool | None = Field(
        description="Whether the payment is ready for payout processing or not.",
    )


# Properties to return via API on claim payment fetch from DB
class ClaimPaymentInDB(ClaimPaymentBase):
    id: UUID | None = Field(description="The claim payment ID.")
    claim_id: UUID | None = Field(description="The claim ID.")
    is_locked: bool | None = Field(
        description="Whether the payment record is locked for editing or not.",
    )
    is_ready_to_process: bool | None = Field(
        description="Whether the payment is ready for processing or not.",
    )

    class Config:
        orm_mode = True


# Additional properties to return via API
class ClaimPayment(Timestamp, Audit, ClaimPaymentInDB):
    pass


class ClaimPaymentSum(BaseModel):
    payment_type: str | None = Field(description="The claim payment type.")
    total_amount: float | None = Field(description="The claim payment total.")

    class Config:
        orm_mode = True


class ClaimPaymentSummary(BaseModel):
    aci_estimate_total: float = Field(default=0, description="ACI estimate total.")
    carrier_estimate_total: float = Field(default=0, description="Carrier estimate total.")
    total_paid: float = Field(default=0, description="Total amount paid.")
    remaining_recoverable: float = Field(
        default=0, description="Remaining recoverable amount."
    )


class LockClaimPayments(BaseModel):
    payment_ids: list[UUID] = Field(description="A list of payment IDs.")
