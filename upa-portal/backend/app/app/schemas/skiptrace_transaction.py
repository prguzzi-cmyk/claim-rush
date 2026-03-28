#!/usr/bin/env python

"""Pydantic schemas for the SkiptraceTransaction module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class SkiptraceTransactionBase(BaseModel):
    wallet_id: UUID = Field(description="Associated wallet UUID.")
    lead_id: UUID | None = Field(default=None, description="Associated lead UUID.")
    action_type: str = Field(default="skip_trace", description="Action type: skip_trace, sms, ai_voice_call, enrichment.")
    credits_used: int = Field(default=1, description="Credits consumed.")
    lookup_status: str = Field(description="Lookup status: success, failed, no_results.")
    address_queried: str | None = Field(default=None, description="Address that was queried.")


class SkiptraceTransactionCreate(SkiptraceTransactionBase):
    pass


class SkiptraceTransactionUpdate(BaseModel):
    lookup_status: str | None = Field(default=None)


class SkiptraceTransactionInDB(SkiptraceTransactionBase):
    id: UUID = Field(description="Transaction UUID primary key.")

    class Config:
        orm_mode = True


class SkiptraceTransaction(Timestamp, SkiptraceTransactionInDB):
    ...
