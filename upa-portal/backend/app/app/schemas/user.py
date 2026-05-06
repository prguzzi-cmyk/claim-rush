#!/usr/bin/env python

"""Schema for User"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas import (
    Audit,
    PermissionMinimal,
    RoleInDB,
    Timestamp,
    UserMeta,
    UserMetaBase,
)


# Shared properties
class UserMinimal(BaseModel):
    first_name: str | None = Field(
        default=None, max_length=50, description="First name of the user."
    )
    last_name: str | None = Field(
        default=None, max_length=50, description="Last name of the user."
    )
    # Was `EmailStr | None`, but UserMinimal is the response-embed base
    # class used inside Claim.signed_by_user / Claim.assigned_user /
    # Claim.collaborators[*] / Lead.assigned_user / etc. Pydantic v1's
    # EmailStr (via `email_validator>=2.x`) rejects reserved-TLD addresses
    # like `admin@rin.local` — which causes serialization to fail with a
    # ValidationError, surfaced by the global error handler as HTTP 409.
    # The result was: any list endpoint touching a user with a non-RFC-
    # deliverable address would 409 silently. Strict input validation
    # is preserved on the `UserCreate` path (explicitly redefines
    # `email: EmailStr`), so new users still need a deliverable address.
    email: str | None = Field(
        default=None, description="Email address of the user."
    )

    class Config:
        orm_mode = True


# User Minimal with a user ID
class UserMinimalId(UserMinimal):
    id: UUID | None = Field(description="Id of the user.")


# Shared properties
class UserBase(UserMinimal):
    parent_id: UUID | None = Field(description="Parent user ID.")
    manager_id: UUID | None = Field(description="Manager user ID.")
    operating_mode: str | None = Field(
        default="neutral",
        max_length=20,
        description="Operating mode: neutral, aci, or upa.",
    )
    user_meta: UserMetaBase | None = Field(
        default=None, description="User meta object."
    )


# Properties to receive via API on creation
class UserCreate(UserBase):
    first_name: str = Field(max_length=50, description="First name of the user.")
    last_name: str = Field(max_length=50, description="Last name of the user.")
    email: EmailStr = Field(description="Email address of the user.")
    password: str = Field(description="Login password for the user.")
    is_active: bool | None = Field(default=True, description="Status of the user.")
    can_be_removed: bool | None = Field(
        default=True, description="Is the user can be removed?"
    )
    is_accepting_leads: bool | None = Field(
        default=True, description="Whether the user is accepting new lead assignments."
    )
    daily_lead_limit: int | None = Field(
        default=None, description="Max leads per day. None means unlimited."
    )

    role_id: UUID = Field(description="Role id of the user.")


# Properties to receive via API on update
class UserUpdate(UserBase):
    password: str | None = Field(description="Login password for the user.")
    is_active: bool | None = Field(description="Status of the user.")
    can_be_removed: bool | None = Field(description="Is the user can be removed?")
    is_removed: bool | None = Field(description="Is the user removed?")
    is_accepting_leads: bool | None = Field(
        default=None, description="Whether the user is accepting new lead assignments."
    )
    daily_lead_limit: int | None = Field(
        default=None, description="Max leads per day. None means unlimited."
    )

    role_id: UUID | None = Field(description="Role id of the user.")


# Properties to receive via API on own user update
class UserUpdateMe(UserBase):
    password: str | None = Field(description="Login password for the user.")
    # Required by the PUT /users/me handler when `password` is being changed.
    # Verified against the caller's stored hash before the new password is
    # accepted. Ignored when `password` is absent.
    current_password: str | None = Field(
        default=None,
        description=(
            "Caller's current password. Required when changing `password`; "
            "rejected with 400 if missing or incorrect."
        ),
    )


# Properties to return via API on user fetch from DB
class UserInDBBase(UserBase):
    id: UUID | None = Field(description="Id of the user.")
    is_active: bool | None = Field(description="Status of the user.")
    can_be_removed: bool | None = Field(description="Is the user can be removed?")
    is_removed: bool | None = Field(description="Is the user removed?")
    operating_mode: str | None = Field(
        default="neutral",
        description="Operating mode: neutral, aci, or upa.",
    )
    is_accepting_leads: bool | None = Field(
        default=True, description="Whether the user is accepting new lead assignments."
    )
    daily_lead_limit: int | None = Field(
        default=None, description="Max leads per day. None means unlimited."
    )

    profile_image_url: str | None = Field(
        default=None,
        description="Partner profile photo URL (data: URL in dev, S3/Supabase in prod).",
    )

    # Onboarding gate (R-onb02). Read-only mirror of the user-table flags
    # so the frontend can decide whether to render portal access without
    # an extra round-trip. is_agent_activated is computed by
    # agent_activation_service.is_agent_activated.
    upa_agreement_signed: bool | None = Field(
        default=False,
        description="UPA agreement signed flag.",
    )
    aci_agreement_signed: bool | None = Field(
        default=False,
        description="ACI agreement signed flag.",
    )
    agreement_signed_at: datetime | None = Field(
        default=None,
        description="Timestamp when both agreements were first signed.",
    )

    parent: UserMinimal | None = Field(description="Parent detail.")
    manager: UserMinimal | None = Field(description="Manager detail.")
    user_meta: UserMeta | None = Field(description="User meta object.")
    role: RoleInDB | None = Field(description="User role detail.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class User(Timestamp, Audit, UserInDBBase):
    pass


# Additional properties to return via API
class UserProfile(Timestamp, Audit, UserInDBBase):
    permissions: list[PermissionMinimal] | None = Field(
        description="Permissions assigned to a user."
    )


# Lead assigned user properties to return via API
class UserAssignedToLead(UserBase):
    user_meta: UserMeta | None = Field(description="User meta object.")

    class Config:
        orm_mode = True


# Claim assigned user properties to return via API
class UserAssignedToClaim(UserAssignedToLead):
    pass


# Additional properties stored in DB
class UserInDB(UserInDBBase):
    hashed_password: str
    can_be_removed: bool


class UsersByRole(BaseModel):
    name: str | None = Field(description="Name of the role.")
    display_name: str | None = Field(description="Display name of the role.")
    users_count: int | None = Field(description="Number of users has this role.")

    class Config:
        orm_mode = True
