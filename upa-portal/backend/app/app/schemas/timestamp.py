#!/usr/bin/env python

"""Schema for timestamp"""

from datetime import datetime

from pydantic import BaseModel, Field


class Timestamp(BaseModel):
    created_at: datetime | None = Field(description="Record created date and time.")
    updated_at: datetime | None = Field(
        default=None, description="Record updated date and time."
    )
