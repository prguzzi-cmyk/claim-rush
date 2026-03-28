#!/usr/bin/env python

"""Schema for Claim Role Permission."""

from pydantic import BaseModel, Field


class ClaimRolePermission(BaseModel):
    roles_permissions: dict[str, list[str]] | None = Field(
        description="Claim Roles with their Permissions."
    )
