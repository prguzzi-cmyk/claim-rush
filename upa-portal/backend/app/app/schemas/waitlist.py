#!/usr/bin/env python

"""Schema for AI Estimate Waitlist"""

from datetime import date, datetime
from typing import List
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, HttpUrl


# Shared properties
class WaitlistBase(BaseModel):
    """Base Waitlist Schema"""

    # Customer Information
    first_name: str = Field(
        ..., max_length=100, description="First name of the applicant"
    )
    last_name: str = Field(
        ..., max_length=100, description="Last name of the applicant"
    )
    email: EmailStr = Field(..., description="Email address of the applicant")
    phone: str = Field(..., max_length=20, description="Phone number of the applicant")
    address: str = Field(..., description="Primary address")
    customer_city: str = Field(..., max_length=100, description="Customer's city")
    customer_state: str = Field(
        ..., max_length=2, description="Customer's state (2-letter code)"
    )
    customer_zip_code: str = Field(
        ..., max_length=10, description="Customer's ZIP code"
    )

    # Loss Information
    loss_address: str | None = Field(
        None, description="Address where the loss occurred"
    )
    loss_city: str | None = Field(
        None, max_length=100, description="City where loss occurred"
    )
    loss_state: str | None = Field(
        None, max_length=2, description="State where loss occurred"
    )
    loss_zip_code: str | None = Field(
        None, max_length=10, description="ZIP code where loss occurred"
    )
    cause_of_loss: str = Field(..., max_length=255, description="Cause of the loss")
    date_of_loss: date = Field(..., description="Date when the loss occurred")
    damage_description: str = Field(
        ..., description="Detailed description of the damage"
    )

    # Insurance Information
    insurance_company: str = Field(
        ..., max_length=255, description="Name of insurance company"
    )
    policy_number: str = Field(
        ..., max_length=100, description="Insurance policy number"
    )
    claim_number: str | None = Field(None, max_length=100, description="Claim number")
    mortgage_company: str | None = Field(
        None, max_length=255, description="Mortgage company name"
    )

    # Additional Information
    initials: str | None = Field(None, max_length=3, description="Customer's initials")
    notes: str | None = Field(None, description="Additional notes or comments")


class WaitlistCreate(WaitlistBase):
    """Create Waitlist Schema"""

    # File Information
    policy_file_path: str = Field(
        ..., max_length=500, description="Path to uploaded policy file"
    )
    damage_photos_paths: List[str] = Field(
        ..., description="List of paths to damage photos"
    )


class WaitlistUpdate(WaitlistBase):
    """Update Waitlist Schema - all fields optional"""

    # Make all fields optional for updates
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    customer_city: str | None = None
    customer_state: str | None = None
    customer_zip_code: str | None = None
    loss_address: str | None = None
    loss_city: str | None = None
    loss_state: str | None = None
    loss_zip_code: str | None = None
    cause_of_loss: str | None = None
    date_of_loss: date | None = None
    damage_description: str | None = None
    insurance_company: str | None = None
    policy_number: str | None = None
    claim_number: str | None = None
    mortgage_company: str | None = None
    policy_file_path: str | None = None
    damage_photos_paths: List[str] | None = None
    initials: str | None = None
    notes: str | None = None


class WaitlistInDBBase(WaitlistBase):
    """Base DB Schema for Waitlist"""

    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by_id: UUID | None
    updated_by_id: UUID | None
    is_active: bool = True
    status: str = "pending"

    class Config:
        orm_mode = True


class Waitlist(WaitlistInDBBase):
    """Complete Waitlist Schema"""

    pass


class WaitlistInDB(WaitlistInDBBase):
    """Internal DB Schema for Waitlist"""

    pass


# For list responses
class WaitlistList(BaseModel):
    """List of Waitlist Entries Schema"""

    total: int
    items: List[Waitlist]


class WaitlistResponse(WaitlistInDBBase):
    """Response Schema for Waitlist"""

    passcode: str = Field(..., description="Unique 5-character passcode")


class AIEstimateResponse(BaseModel):
    passcode: str
    claim_info: dict
    ai_estimate: str
    status: str
