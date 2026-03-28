#!/usr/bin/env python

"""Pydantic schemas for the FireDataSourceConfig module"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class FireDataSourceConfigBase(BaseModel):
    source_type: str | None = Field(
        default=None, max_length=20, description="Source type: socrata, nifc, firms."
    )
    name: str | None = Field(
        default=None, max_length=200, description="Human-readable name (e.g. 'Seattle Fire 911')."
    )
    endpoint_url: str | None = Field(
        default=None, max_length=500, description="API endpoint URL."
    )
    api_key: str | None = Field(
        default=None, max_length=200, description="API key (for FIRMS)."
    )
    dataset_id: str | None = Field(
        default=None, max_length=100, description="Dataset ID (for Socrata)."
    )
    is_active: bool | None = Field(
        default=True, description="Whether this source is actively being polled."
    )
    poll_interval_seconds: int | None = Field(
        default=300, description="Polling interval in seconds."
    )
    extra_config: str | None = Field(
        default=None, description="JSON string for source-specific parameters."
    )


# Properties required when creating
class FireDataSourceConfigCreate(FireDataSourceConfigBase):
    source_type: str = Field(max_length=20, description="Source type: socrata, nifc, firms.")
    name: str = Field(max_length=200, description="Human-readable name.")
    endpoint_url: str = Field(max_length=500, description="API endpoint URL.")


# Properties accepted on update
class FireDataSourceConfigUpdate(FireDataSourceConfigBase):
    pass


# Properties returned from DB
class FireDataSourceConfigInDB(FireDataSourceConfigBase):
    id: UUID | None = Field(description="Config UUID primary key.")
    last_polled_at: datetime | None = Field(
        default=None, description="When this source was last polled."
    )

    class Config:
        orm_mode = True


# Full response schema (includes timestamps)
class FireDataSourceConfig(Timestamp, FireDataSourceConfigInDB):
    ...
