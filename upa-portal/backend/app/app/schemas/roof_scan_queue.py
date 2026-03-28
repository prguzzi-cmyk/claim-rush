#!/usr/bin/env python

"""Pydantic schemas for the RoofScanQueue model"""

from datetime import datetime

from pydantic import BaseModel, Field


class RoofScanQueueCreate(BaseModel):
    property_id: str = Field(max_length=100)
    address: str | None = None
    latitude: float
    longitude: float
    zone_id: str = Field(max_length=100)
    storm_event_id: str | None = None
    source: str = "osm"
    building_type: str | None = None
    building_area_sqft: float | None = None


class RoofScanQueueUpdate(BaseModel):
    scan_status: str | None = None
    roof_analysis_id: str | None = None
    error_message: str | None = None


class RoofScanQueueOut(BaseModel):
    id: str
    property_id: str
    address: str | None = None
    latitude: float
    longitude: float
    zone_id: str
    scan_status: str
    source: str
    roof_analysis_id: str | None = None
    building_type: str | None = None
    building_area_sqft: float | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class RoofScanQueueStats(BaseModel):
    total: int = 0
    pending: int = 0
    queued: int = 0
    scanning: int = 0
    completed: int = 0
    errored: int = 0


class ZoneScanRequest(BaseModel):
    zone_id: str
    center: list[float]  # [lat, lng]
    radius_meters: float
    storm_event_id: str | None = None
    max_properties: int = 200


class ZoneScanResponse(BaseModel):
    zone_id: str
    properties_found: int
    queued_for_scan: int
    message: str
