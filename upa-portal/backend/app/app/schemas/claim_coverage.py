#!/usr/bin/env python

"""Schema for Claim Coverage"""

from uuid import UUID

from pydantic import Field, BaseModel, validator

from app.utils.masters import CoverageTypes


# Shared properties
class ClaimCoverageBase(BaseModel):
    coverage_type: str | None = Field(
        default=None, description="Claim coverage type slug."
    )
    policy_limit: float | None = Field(
        default=None, description="Claim policy limit."
    )

    @validator("coverage_type")
    def validate_coverage_type(cls, v):
        if v not in CoverageTypes().coverage_types_slug:
            raise ValueError(f"Invalid coverage type slug: {v}")

        return v


# Properties to receive via API on creation
class ClaimCoverageCreate(ClaimCoverageBase):
    coverage_type: str = Field(description="Claim coverage type slug.")


# Properties to receive via API on update
class ClaimCoverageUpdate(ClaimCoverageBase):
    coverage_type: str = Field(description="Claim coverage type slug.")


# Properties to return via API on claim activity fetch from DB
class ClaimCoverageInDB(ClaimCoverageBase):
    claim_id: UUID | None = Field(description="The claim ID.")


# Additional properties to return via API
class ClaimCoverage(ClaimCoverageInDB):
    class Config:
        orm_mode = True
