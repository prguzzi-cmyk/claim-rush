#!/usr/bin/env python

"""Pydantic schemas for in-app notifications"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class InAppNotificationBase(BaseModel):
    user_id: UUID
    title: str = Field(max_length=200)
    message: str
    link: str | None = None
    notification_type: str = Field(default="lead_assignment", max_length=30)
    lead_id: UUID | None = None


class InAppNotificationCreate(InAppNotificationBase):
    pass


class InAppNotificationUpdate(BaseModel):
    is_read: bool | None = None
    read_at: datetime | None = None


class InAppNotificationInDB(InAppNotificationBase):
    id: UUID
    is_read: bool = False
    read_at: datetime | None = None

    class Config:
        orm_mode = True


class InAppNotification(Timestamp, InAppNotificationInDB):
    ...


class UnreadCountResponse(BaseModel):
    unread_count: int
