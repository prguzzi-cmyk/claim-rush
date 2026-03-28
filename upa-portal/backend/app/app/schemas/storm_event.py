#!/usr/bin/env python

"""Pydantic schemas for the StormEvent module"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class StormEventBase(BaseModel):
    event_type: str | None = Field(default=None, max_length=20, description="hail, wind, hurricane, lightning")
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None)
    severity: str | None = Field(default=None, max_length=20, description="low, moderate, high, severe, extreme")
    latitude: float | None = Field(default=None)
    longitude: float | None = Field(default=None)
    radius_miles: float | None = Field(default=None)
    state: str | None = Field(default=None, max_length=2)
    county: str | None = Field(default=None, max_length=100)
    zip_codes: str | None = Field(default=None, description="JSON array of zip codes")
    reported_at: datetime | None = Field(default=None)
    expires_at: datetime | None = Field(default=None)
    source: str | None = Field(default=None, max_length=100)
    is_active: bool | None = Field(default=True)
    hail_size_inches: float | None = Field(default=None)
    wind_speed_mph: float | None = Field(default=None)
    gust_speed_mph: float | None = Field(default=None)
    hurricane_category: int | None = Field(default=None)
    hurricane_name: str | None = Field(default=None)
    track_points: str | None = Field(default=None, description="JSON array of {lat, lng}")
    strike_count: int | None = Field(default=None)
    external_id: str | None = Field(default=None, max_length=200)
    data_source: str | None = Field(default="nws", max_length=20)


class StormEventCreate(StormEventBase):
    event_type: str = Field(max_length=20)
    title: str = Field(max_length=200)
    severity: str = Field(max_length=20)
    latitude: float = Field(...)
    longitude: float = Field(...)
    state: str = Field(max_length=2)
    county: str = Field(max_length=100)


class StormEventUpdate(StormEventBase):
    pass


class StormEventInDB(StormEventBase):
    id: UUID | None = Field(description="Storm event UUID.")

    class Config:
        orm_mode = True


class StormEvent(Timestamp, StormEventInDB):
    ...


class StormTargetAreaResponse(BaseModel):
    county: str
    state: str
    zip_codes: list[str] = Field(default_factory=list)
    primary_event_type: str
    severity: str
    event_count: int
    estimated_properties: int = 0
    risk_score: float = 0
    events: list[StormEvent] = Field(default_factory=list)
