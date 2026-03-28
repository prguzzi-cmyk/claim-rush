#!/usr/bin/env python

"""Schemas for audit"""

from pydantic import BaseModel, Field

from app.schemas import UserAudit


class Audit(BaseModel):
    created_by: UserAudit | None = Field(description="Record added by")
    updated_by: UserAudit | None = Field(description="Record updated by")
