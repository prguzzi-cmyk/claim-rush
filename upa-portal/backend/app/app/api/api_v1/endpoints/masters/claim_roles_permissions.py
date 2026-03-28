#!/usr/bin/env python

"""Routes for the Role Permissions for Claim module."""

from typing import Any

from fastapi import APIRouter

from app import schemas
from app.db.data.claim_user_permissions import CLAIM_PERMISSIONS

router = APIRouter()


@router.get(
    "/claim-roles-permissions",
    summary="Get Claim Roles Permissions",
    response_description="A list of Claim Roles with Permissions",
    response_model=schemas.ClaimRolePermission,
)
def get_claim_roles_permissions() -> Any:
    """Retrieve a list of Claim Roles with Permissions."""

    return {"roles_permissions": CLAIM_PERMISSIONS}
