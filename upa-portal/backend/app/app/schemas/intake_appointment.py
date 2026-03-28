#!/usr/bin/env python

"""Schemas for Intake Appointment"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class AppointmentType(str, Enum):
    INSPECTION = "inspection"
    ZOOM = "zoom"
    TEAMS = "teams"


class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no-show"


class IntakeAppointmentBase(BaseModel):
    appointment_type: str = Field(description="Type: inspection, zoom, or teams.")
    scheduled_at: datetime | None = Field(default=None, description="Appointment date/time.")
    homeowner_name: str | None = None
    homeowner_email: str | None = None
    homeowner_phone: str | None = None
    property_address: str | None = None
    notes: str | None = None
    status: str = "scheduled"


class IntakeAppointmentCreate(IntakeAppointmentBase):
    session_id: UUID | None = Field(default=None, description="Linked intake session.")
    assigned_to: UUID | None = Field(default=None, description="Assigned agent.")


class IntakeAppointmentUpdate(BaseModel):
    appointment_type: str | None = None
    scheduled_at: datetime | None = None
    notes: str | None = None
    status: str | None = None
    assigned_to: UUID | None = None


class IntakeAppointmentInDB(IntakeAppointmentBase):
    id: UUID | None = Field(description="Appointment ID.")
    session_id: UUID | None = None
    assigned_to: UUID | None = None

    class Config:
        orm_mode = True


class IntakeAppointment(Timestamp, IntakeAppointmentInDB):
    pass
