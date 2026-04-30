#!/usr/bin/env python

"""Pydantic schemas for the Launch Control users aggregation endpoint."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TerritoryRef(BaseModel):
    territory_id: UUID
    name: str
    territory_type: str
    state: str | None = None
    county: str | None = None
    zip_code: str | None = None
    priority: int

    class Config:
        orm_mode = True


class LaunchControlUser(BaseModel):
    user_id: UUID
    name: str
    email: str
    role: str
    role_display: str | None = None

    # Partner profile photo. Surfaced so the Launch Control table can show
    # a thumbnail next to the name; empty when the user hasn't uploaded one.
    profile_image_url: str | None = None

    upline_user_id: UUID | None = None
    upline_name: str | None = None

    territories: list[TerritoryRef] = Field(default_factory=list)

    # Global routing/rotation defaults from the 'all' settings row. Per-source
    # overrides exist but the aggregation surfaces the system-wide default
    # so the UI can show one summary signal per user.
    routing_mode: str | None = None
    rotation_enabled: bool
    rotation_inactivity_minutes: int | None = None

    portal_active: bool
    login_url: str

    # Personal landing — one IntakeConfig where this user is the assigned
    # CP / RVP / Agent / default_assignee. Null if the user has no slug yet.
    personal_landing_slug: str | None = None
    personal_landing_url: str | None = None
    client_intake_url: str | None = None

    readiness: str  # 'ready' | 'missing_setup' | 'broken'
    issues: list[str] = Field(default_factory=list)

    # Deployment lifecycle on top of readiness.
    #   'broken'      → user can't function (inactive / no role / not accepting)
    #   'not_ready'   → readiness == 'missing_setup'
    #   'ready'       → readiness == 'ready' but never deployed
    #   'deployed'    → readiness == 'ready' AND portal_deployed_at IS NOT NULL
    deployment_status: str = "not_ready"
    portal_deployed_at: datetime | None = None
    portal_url: str | None = None

    # Onboarding e-sign + activation visibility (read-only surface).
    # Sourced from User flags + AgentProfile.agent_number; do not drive
    # routing or activation logic — that's owned by agent_activation_service.
    upa_agreement_signed: bool = False
    aci_agreement_signed: bool = False
    agreement_signed_at: datetime | None = None
    agent_number: str | None = None
    is_activated: bool = False

    class Config:
        orm_mode = True


# ----- Per-user portal view (returned by GET /v1/launch-control/users/{id}) -----

class PortalLeadRow(BaseModel):
    lead_id: UUID
    ref_number: int
    peril: str | None = None
    status: str | None = None
    rotation_status: str | None = None
    assigned_at: datetime | None = None
    matched_level: str | None = None
    matched_value: str | None = None

    class Config:
        orm_mode = True


class LaunchControlUserDetail(LaunchControlUser):
    recent_leads: list[PortalLeadRow] = Field(default_factory=list)
    total_leads: int = 0


class DeployResponse(BaseModel):
    user_id: UUID
    deployment_status: str
    portal_deployed_at: datetime | None
    portal_url: str | None
    login_url: str
    intake_url: str | None


# ---------- Enrollment ----------


class EnrollTerritory(BaseModel):
    territory_type: str = Field(description="state | county | zip")
    state: str | None = Field(default=None, max_length=2)
    county: str | None = Field(default=None, max_length=100)
    zip_code: str | None = Field(default=None, max_length=10)


class EnrollRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: str = Field(min_length=3, max_length=200)
    role: str = Field(description="cp | rvp | agent")
    manager_email: str | None = Field(default=None, max_length=200)
    # Multiple territories per user. Single-territory clients can still send
    # a one-element list. Backwards-compat: also accepts the legacy single
    # `territory` key — see _normalize_request() in the endpoint.
    territories: list[EnrollTerritory] = Field(default_factory=list)
    territory: EnrollTerritory | None = Field(default=None,
        description="Deprecated — pass `territories: [...]` instead.")
    password: str | None = Field(default=None, max_length=200,
        description="Optional. If absent the server generates a strong temporary password.")


class EnrollTerritoryEcho(BaseModel):
    """Per-territory echo on the enroll response."""
    territory_type: str
    state: str | None = None
    county: str | None = None
    zip_code: str | None = None
    value: str  # display label, e.g. "PA" / "PA · Bucks" / "18901"

    class Config:
        orm_mode = True


class EnrollResponse(BaseModel):
    user_id: UUID
    name: str
    email: str
    role: str
    role_display: str | None
    upline_user_id: UUID | None = None
    upline_name: str | None = None

    # Single-territory mirror (first item in `territories`) — kept so older
    # frontends keep rendering. Prefer the `territories` array.
    territory_type: str
    territory_state: str | None
    territory_county: str | None
    territory_zip: str | None
    territories: list[EnrollTerritoryEcho] = Field(default_factory=list)

    login_email: str
    temporary_password: str

    login_url: str
    portal_url: str
    intake_url: str | None
    intake_slug: str | None

    deployment_status: str

    class Config:
        orm_mode = True
