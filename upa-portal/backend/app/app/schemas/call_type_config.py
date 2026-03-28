#!/usr/bin/env python

"""Pydantic schemas for the CallTypeConfig module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class CallTypeConfigBase(BaseModel):
    code: str | None = Field(default=None, max_length=20, description="Call type code (e.g. 'SF').")
    description: str | None = Field(default=None, max_length=100, description="Human-readable description.")
    is_enabled: bool | None = Field(default=None, description="Whether this call type is active for filtering.")
    auto_lead_enabled: bool | None = Field(default=None, description="Whether this call type triggers automatic lead creation.")
    sort_order: int | None = Field(default=None, description="Display order.")


# Properties required when creating
class CallTypeConfigCreate(CallTypeConfigBase):
    code: str = Field(max_length=20, description="Call type code (e.g. 'SF').")
    description: str = Field(max_length=100, description="Human-readable description.")


# Properties accepted on update
class CallTypeConfigUpdate(CallTypeConfigBase):
    pass


# Properties returned from DB
class CallTypeConfigInDB(CallTypeConfigBase):
    id: UUID | None = Field(description="Config UUID primary key.")

    class Config:
        orm_mode = True


# Full response schema (includes timestamps)
class CallTypeConfig(Timestamp, CallTypeConfigInDB):
    ...
