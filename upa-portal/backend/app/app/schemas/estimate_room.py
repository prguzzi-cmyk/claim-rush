#!/usr/bin/env python

"""Pydantic schemas for the EstimateRoom module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp
from app.schemas.estimate_line_item import EstimateLineItem, EstimateLineItemCreate
from app.schemas.estimate_measurement import EstimateMeasurement
from app.schemas.estimate_photo import EstimatePhoto as EstimatePhotoSchema


# Shared properties
class EstimateRoomBase(BaseModel):
    name: str | None = Field(default=None, max_length=100, description="Room name.")
    room_type: str | None = Field(default=None, max_length=50, description="Room type.")
    floor_level: str | None = Field(default=None, max_length=20, description="Floor level.")
    notes: str | None = Field(default=None, description="Room notes.")


# Properties required when creating
class EstimateRoomCreate(EstimateRoomBase):
    name: str = Field(max_length=100, description="Room name.")
    line_items: list[EstimateLineItemCreate] | None = Field(
        default=None, description="Line items to create with the room."
    )


# Properties accepted on update
class EstimateRoomUpdate(EstimateRoomBase):
    pass


# Properties returned from DB
class EstimateRoomInDB(EstimateRoomBase):
    id: UUID | None = Field(description="Room UUID.")
    project_id: UUID | None = Field(default=None, description="Parent project UUID.")
    line_items: list[EstimateLineItem] = Field(default_factory=list, description="Room line items.")
    measurements: list[EstimateMeasurement] = Field(default_factory=list, description="Room measurements.")
    photos: list[EstimatePhotoSchema] = Field(default_factory=list, description="Room photos.")

    class Config:
        orm_mode = True


# Full response schema
class EstimateRoom(Timestamp, EstimateRoomInDB):
    ...
