#!/usr/bin/env python

"""Pydantic schemas for the lead distribution engine"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# ---------- Lead Distribution History ----------

class LeadDistributionHistoryBase(BaseModel):
    lead_id: UUID
    territory_id: UUID
    assigned_agent_id: UUID
    lead_type: str = Field(max_length=30)
    assignment_reason: str | None = None


class LeadDistributionHistoryCreate(LeadDistributionHistoryBase):
    pass


class LeadDistributionHistoryInDB(LeadDistributionHistoryBase):
    id: UUID
    distributed_at: datetime | None = None

    class Config:
        orm_mode = True


class LeadDistributionHistory(Timestamp, LeadDistributionHistoryInDB):
    ...


class LeadDistributionHistoryDetail(LeadDistributionHistory):
    """Enriched response with agent/territory names."""
    agent_name: str | None = None
    territory_name: str | None = None


# ---------- Distribution Request / Response ----------

VALID_LEAD_TYPES = {"fire", "hail", "storm", "lightning", "flood", "theft_vandalism"}


class DistributeLeadRequest(BaseModel):
    lead_id: UUID = Field(description="The lead to distribute")
    lead_type: str = Field(
        description="One of: fire, hail, storm, lightning, flood, theft_vandalism",
    )
    territory_id: UUID = Field(description="County territory to distribute within")


class DistributionResult(BaseModel):
    lead_id: UUID
    lead_type: str
    territory_id: str
    assigned_agents: list[dict] = Field(
        default_factory=list,
        description="List of {agent_id, agent_name} dicts",
    )
    is_exclusive: bool = Field(
        description="True if fire (only 1 agent), False if multi-agent",
    )
    history_ids: list[UUID] = Field(
        default_factory=list,
        description="IDs of created LeadDistributionHistory records",
    )
    assignment_reason: str | None = Field(
        default=None,
        description="Why this assignment was made: cp_priority, rotation, or national_queue",
    )


# ---------- Rotation State ----------

class TerritoryRotationState(BaseModel):
    territory_id: UUID
    last_assigned_agent_id: UUID | None = None
    rotation_index: int = 0

    class Config:
        orm_mode = True
