#!/usr/bin/env python

"""Pydantic response models for fire lead rotation dashboard endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class FireLeadSummary(BaseModel):
    total_incidents: int = Field(description="Total fire incidents in date range.")
    auto_converted: int = Field(description="Incidents auto-converted to leads.")
    assigned: int = Field(description="Leads assigned to agents.")
    unassigned: int = Field(description="Leads created but not yet assigned.")
    skip_reasons: dict[str, int] = Field(
        default_factory=dict,
        description="Counts of skip reasons (e.g. ineligible_call_type, no_territory_match).",
    )


class FireLeadAgentPerformance(BaseModel):
    agent_id: str = Field(description="Agent UUID.")
    agent_name: str = Field(description="Agent display name.")
    leads_assigned: int = Field(description="Number of fire leads assigned.")
    last_assigned_at: str | None = Field(default=None, description="ISO datetime of last assignment.")
    rotation_index: int | None = Field(default=None, description="Current rotation index.")


class FireLeadTerritoryBreakdown(BaseModel):
    territory_id: str = Field(description="Territory UUID.")
    territory_name: str = Field(description="Territory display name.")
    total_leads: int = Field(description="Total fire leads distributed in this territory.")
    active_agents: int = Field(description="Number of active agents in the territory.")


class FireLeadDeliveryStatus(BaseModel):
    sms: dict[str, int] = Field(
        default_factory=dict,
        description="SMS delivery status counts (sent, delivered, failed, skipped, pending).",
    )
    email: dict[str, int] = Field(
        default_factory=dict,
        description="Email delivery status counts (sent, delivered, failed, skipped, pending).",
    )


class ClientConversionStats(BaseModel):
    signed_today: int = Field(default=0, description="Leads signed today.")
    signed_this_month: int = Field(default=0, description="Leads signed this month.")
    total_active_claims: int = Field(default=0, description="Total active (non-closed) claims.")
    conversion_rate: float = Field(default=0.0, description="Conversion rate (signed / total leads).")
