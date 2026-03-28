#!/usr/bin/env python

"""Schema for AdjusterAvailability and AdjusterBlockedSlot"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class AdjusterBlockedSlotBase(BaseModel):
    date: str = Field(max_length=10)
    start_time: str = Field(max_length=5)
    end_time: str = Field(max_length=5)
    reason: str | None = Field(default=None, max_length=200)


class AdjusterBlockedSlotCreate(AdjusterBlockedSlotBase):
    pass


class AdjusterBlockedSlot(AdjusterBlockedSlotBase):
    id: UUID | None = Field(default=None)
    availability_id: UUID | None = Field(default=None)

    class Config:
        orm_mode = True


class AdjusterAvailabilityBase(BaseModel):
    available_days: str | None = Field(default="[1,2,3,4,5]", max_length=20)
    start_hour: int | None = Field(default=8)
    end_hour: int | None = Field(default=17)


class AdjusterAvailabilityCreate(AdjusterAvailabilityBase):
    blocked_slots: list[AdjusterBlockedSlotCreate] = Field(default_factory=list)


class AdjusterAvailabilityUpdate(AdjusterAvailabilityBase):
    blocked_slots: list[AdjusterBlockedSlotCreate] | None = Field(default=None)


class AdjusterAvailabilityInDB(AdjusterAvailabilityBase):
    id: UUID | None = Field(description="Availability record ID.")
    adjuster_id: UUID | None = Field(default=None)
    blocked_slots: list[AdjusterBlockedSlot] = Field(default_factory=list)

    class Config:
        orm_mode = True


class AdjusterAvailability(Timestamp, AdjusterAvailabilityInDB):
    pass
