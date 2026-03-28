#!/usr/bin/env python

"""Schemas for audit"""

from uuid import UUID

from pydantic import BaseModel, Field


class UserAudit(BaseModel):
    id: UUID | None = Field(description="User ID.")
    first_name: str | None = Field(description="First name of the user.")
    last_name: str | None = Field(description="Last name of the user.")

    class Config:
        orm_mode = True


class Audit(BaseModel):
    created_by: UserAudit | None = Field(description="Record added by.")
    updated_by: UserAudit | None = Field(description="Record updated by.")
