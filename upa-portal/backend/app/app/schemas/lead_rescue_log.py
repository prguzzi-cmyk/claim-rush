#!/usr/bin/env python

"""Pydantic schemas for the lead rescue system"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp
from app.schemas.user import UserMinimal


# -- Request schemas --

class RescueLeadRequest(BaseModel):
    """Manual rescue trigger."""
    lead_id: UUID
    score_tier: str | None = Field(
        default=None, description="Override score tier (high|strong|medium|low)",
    )


class MarkRescueConvertedRequest(BaseModel):
    """Mark a rescued lead as converted."""
    lead_id: UUID


# -- DB / Response schemas --

class LeadRescueLogBase(BaseModel):
    lead_id: UUID
    tracker_id: UUID | None = None
    original_agent_id: UUID | None = None
    new_assigned_agent_id: UUID | None = None
    rescue_reason: str
    score_tier: str | None = None
    rescue_level: str | None = None
    escalation_level_at_rescue: int | None = None
    notes: str | None = None
    is_converted: bool = False
    rvp_rescue: bool = False
    cp_rescue: bool = False


class LeadRescueLogInDB(LeadRescueLogBase):
    id: UUID

    class Config:
        orm_mode = True


class LeadRescueLog(Timestamp, LeadRescueLogInDB):
    ...


class LeadRescueLogDetail(LeadRescueLog):
    """Extended response with agent names."""
    original_agent_name: str | None = None
    new_agent_name: str | None = None


class RescueStatusResponse(BaseModel):
    """Response for checking rescue status of a lead."""
    lead_id: UUID
    is_rescued: bool
    score_tier: str | None = None
    rescue_count: int = 0
    latest_rescue: LeadRescueLogDetail | None = None


class RescueScanResponse(BaseModel):
    """Response from bulk inactivity scan."""
    scanned: int
    rescued: int
    rescue_ids: list[UUID] = []
