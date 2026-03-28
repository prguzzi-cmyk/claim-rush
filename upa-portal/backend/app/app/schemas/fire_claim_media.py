#!/usr/bin/env python

"""Schemas for the Fire Claim Media module"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FireClaimMediaBase(BaseModel):
    fire_claim_id: UUID | None = None
    media_type: str | None = Field(None, max_length=10)
    storage_key: str | None = Field(None, max_length=500)
    file_url: str | None = Field(None, max_length=500)
    caption: str | None = Field(None, max_length=255)


class FireClaimMediaCreate(FireClaimMediaBase):
    fire_claim_id: UUID
    media_type: str = Field(..., max_length=10)
    storage_key: str = Field(..., max_length=500)
    file_url: str = Field(..., max_length=500)


class FireClaimMediaUpdate(FireClaimMediaBase):
    pass


class FireClaimMediaInDB(FireClaimMediaBase):
    id: UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        orm_mode = True


class FireClaimMedia(FireClaimMediaInDB):
    pass
