#!/usr/bin/env python

"""Pydantic schemas for the CrimeDataSourceConfig module"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class CrimeDataSourceConfigBase(BaseModel):
    source_type: str | None = Field(
        default=None, max_length=50, description="Source type: socrata, carto, fbi_api, mock."
    )
    name: str | None = Field(
        default=None, max_length=200, description="Human-readable name."
    )
    endpoint_url: str | None = Field(
        default=None, max_length=500, description="API endpoint URL."
    )
    api_key: str | None = Field(
        default=None, max_length=500, description="API key (optional)."
    )
    dataset_id: str | None = Field(
        default=None, max_length=100, description="Dataset ID (for Socrata)."
    )
    poll_interval_seconds: int | None = Field(
        default=900, description="Polling interval in seconds."
    )
    last_record_count: int | None = Field(
        default=0, description="Number of records from last poll."
    )
    connection_status: str | None = Field(
        default="pending", max_length=30, description="connected, error, pending, mock."
    )
    freshness_label: str | None = Field(
        default=None, max_length=30, description="live, near_real_time, daily_refresh, historical."
    )
    enabled: bool | None = Field(
        default=True, description="Whether this source is actively being polled."
    )
    extra_config: str | None = Field(
        default=None, description="JSON string for source-specific parameters."
    )


# Properties required when creating
class CrimeDataSourceConfigCreate(CrimeDataSourceConfigBase):
    source_type: str = Field(max_length=50, description="Source type: socrata, carto, fbi_api, mock.")
    name: str = Field(max_length=200, description="Human-readable name.")


# Properties accepted on update
class CrimeDataSourceConfigUpdate(CrimeDataSourceConfigBase):
    pass


# Properties returned from DB
class CrimeDataSourceConfigInDB(CrimeDataSourceConfigBase):
    id: UUID | None = Field(description="Config UUID primary key.")
    last_polled_at: datetime | None = Field(
        default=None, description="When this source was last polled."
    )

    class Config:
        orm_mode = True


# Full response schema (includes timestamps)
class CrimeDataSourceConfig(Timestamp, CrimeDataSourceConfigInDB):
    ...


# Source status dashboard response
class CrimeSourceStatusOut(BaseModel):
    id: UUID
    name: str
    source_type: str
    connection_status: str
    freshness_label: str | None
    last_polled_at: datetime | None
    last_record_count: int
    poll_interval_seconds: int
    enabled: bool

    class Config:
        orm_mode = True
