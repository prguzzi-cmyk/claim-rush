#!/usr/bin/env python

"""Schema for InspectionSchedule"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class InspectionScheduleBase(BaseModel):
    lead_id: UUID | None = Field(default=None)
    homeowner_name: str | None = Field(default=None, max_length=200)
    homeowner_phone: str | None = Field(default=None, max_length=20)
    homeowner_email: str | None = Field(default=None, max_length=255)
    property_address: str | None = Field(default=None, max_length=500)
    adjuster_id: UUID | None = Field(default=None)
    inspection_date: str | None = Field(default=None, max_length=10)
    inspection_time: str | None = Field(default=None, max_length=5)
    end_time: str | None = Field(default=None, max_length=5)
    status: str | None = Field(default="scheduled", max_length=30)
    notes: str | None = Field(default=None)
    claim_id: UUID | None = Field(default=None)
    conversation_id: UUID | None = Field(default=None)


class InspectionScheduleCreate(InspectionScheduleBase):
    homeowner_name: str = Field(max_length=200)
    property_address: str = Field(max_length=500)
    inspection_date: str = Field(max_length=10)
    inspection_time: str = Field(max_length=5)


class InspectionScheduleUpdate(InspectionScheduleBase):
    pass


class InspectionScheduleInDB(InspectionScheduleBase):
    id: UUID | None = Field(description="Inspection ID.")
    reminders_sent: int | None = Field(default=0)
    created_by_id: UUID | None = Field(default=None)

    class Config:
        orm_mode = True


class InspectionSchedule(Timestamp, InspectionScheduleInDB):
    pass


class InspectionReminderRequest(BaseModel):
    target: str = Field(description="Reminder target: 'homeowner' or 'adjuster'")
    channel: str = Field(description="Reminder channel: 'sms' or 'email'")
