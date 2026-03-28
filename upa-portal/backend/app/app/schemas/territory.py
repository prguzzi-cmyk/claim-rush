#!/usr/bin/env python

"""Pydantic schemas for the Territory module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# ---------- Territory ----------

class TerritoryBase(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    territory_type: str | None = Field(
        default=None, max_length=20, description="state, county, zip, custom"
    )
    state: str | None = Field(default=None, max_length=2)
    county: str | None = Field(default=None, max_length=100)
    zip_code: str | None = Field(default=None, max_length=10)
    custom_geometry: str | None = Field(default=None, description="GeoJSON for custom regions")
    is_active: bool | None = Field(default=True)
    chapter_president_id: UUID | None = Field(default=None)
    max_adjusters: int | None = Field(default=3)
    lead_fire_enabled: bool | None = Field(default=True)
    lead_hail_enabled: bool | None = Field(default=True)
    lead_storm_enabled: bool | None = Field(default=True)
    lead_lightning_enabled: bool | None = Field(default=False)
    lead_flood_enabled: bool | None = Field(default=True)
    lead_theft_vandalism_enabled: bool | None = Field(default=True)


class TerritoryCreate(TerritoryBase):
    name: str = Field(max_length=200)
    territory_type: str = Field(max_length=20)


class TerritoryUpdate(TerritoryBase):
    pass


class TerritoryInDB(TerritoryBase):
    id: UUID | None = Field(description="Territory UUID.")

    class Config:
        orm_mode = True


class Territory(Timestamp, TerritoryInDB):
    ...


# ---------- UserTerritory ----------

class UserTerritoryBase(BaseModel):
    user_id: UUID | None = Field(default=None)
    territory_id: UUID | None = Field(default=None)


class UserTerritoryCreate(BaseModel):
    user_id: UUID
    territory_id: UUID


class UserTerritoryInDB(UserTerritoryBase):
    id: UUID | None = Field(description="UserTerritory UUID.")

    class Config:
        orm_mode = True


class UserTerritory(Timestamp, UserTerritoryInDB):
    territory: Territory | None = None


# ---------- Assign / Remove ----------

class TerritoryAssign(BaseModel):
    territory_ids: list[UUID] = Field(description="Territory IDs to assign to the user")


class TerritoryRemove(BaseModel):
    territory_ids: list[UUID] = Field(description="Territory IDs to remove from the user")


class NationalAccessUpdate(BaseModel):
    national_access: bool = Field(description="Grant or revoke national access")


# ---------- User territory summary ----------

class UserTerritoryInfo(BaseModel):
    """Summary of a user's territory configuration (returned on user endpoints)."""

    national_access: bool = False
    territories: list[Territory] = Field(default_factory=list)


# ---------- Territory with assignments (map view) ----------

class UserBrief(BaseModel):
    user_id: UUID
    first_name: str
    last_name: str

    class Config:
        orm_mode = True


class TerritoryWithAssignments(Territory):
    assigned_users: list[UserBrief] = Field(default_factory=list)
    chapter_president: UserBrief | None = None
    adjusters: list[UserBrief] = Field(default_factory=list)
    adjuster_count: int = 0
    territory_status: str = Field(
        default="Available",
        description="Available, CP Assigned, Full, or Locked",
    )


# ---------- Grouped by state (for lead distribution dropdown) ----------

class TerritoryGroupedByState(BaseModel):
    state: str
    counties: list[Territory] = Field(default_factory=list)
