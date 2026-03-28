#!/usr/bin/env python

"""Pydantic schemas for the EstimateMeasurement module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class EstimateMeasurementBase(BaseModel):
    length: float | None = Field(default=None, description="Length measurement.")
    width: float | None = Field(default=None, description="Width measurement.")
    height: float | None = Field(default=None, description="Height measurement.")
    square_feet: float | None = Field(default=None, description="Calculated square feet.")
    notes: str | None = Field(default=None, description="Measurement notes.")


# Properties required when creating
class EstimateMeasurementCreate(EstimateMeasurementBase):
    pass


# Properties accepted on update
class EstimateMeasurementUpdate(EstimateMeasurementBase):
    pass


# Properties returned from DB
class EstimateMeasurementInDB(EstimateMeasurementBase):
    id: UUID | None = Field(description="Measurement UUID.")
    room_id: UUID | None = Field(default=None, description="Parent room UUID.")

    class Config:
        orm_mode = True


# Full response schema
class EstimateMeasurement(Timestamp, EstimateMeasurementInDB):
    ...
