#!/usr/bin/env python

"""Pydantic schemas for the StormOutreachBatch module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class StormOutreachBatchBase(BaseModel):
    county: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=2)
    zip_codes: str | None = Field(default=None, description="JSON array of zip codes")
    event_type: str | None = Field(default=None, max_length=20)
    severity: str | None = Field(default=None, max_length=20)
    estimated_properties: int | None = Field(default=None)
    risk_score: float | None = Field(default=None)
    status: str | None = Field(default="pending", max_length=20)


class StormOutreachBatchCreate(StormOutreachBatchBase):
    county: str = Field(max_length=100)
    state: str = Field(max_length=2)
    event_type: str = Field(max_length=20)
    severity: str = Field(max_length=20)


class StormOutreachBatchUpdate(StormOutreachBatchBase):
    pass


class StormOutreachBatchInDB(StormOutreachBatchBase):
    id: UUID | None = Field(description="Outreach batch UUID.")
    created_by_id: UUID | None = Field(default=None)

    class Config:
        orm_mode = True


class StormOutreachBatch(Timestamp, StormOutreachBatchInDB):
    ...
