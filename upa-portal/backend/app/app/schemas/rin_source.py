#!/usr/bin/env python

"""Pydantic schemas for the RinSource module (internal only — never exposed to API)"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class RinSourceBase(BaseModel):
    code: str = Field(max_length=30)
    label: str = Field(max_length=100)
    display_name: str = Field(default="RIN Network", max_length=100)
    is_active: bool = Field(default=True)


class RinSourceCreate(RinSourceBase):
    pass


class RinSourceUpdate(RinSourceBase):
    code: str | None = None
    label: str | None = None


class RinSourceInDB(RinSourceBase):
    id: UUID

    class Config:
        orm_mode = True


class RinSource(Timestamp, RinSourceInDB):
    ...
