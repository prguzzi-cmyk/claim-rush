#!/usr/bin/env python

"""Resolved permissions for the current user.

GET /v1/users/me/permissions

Returns the user's role + module-level permissions (joined from
role_permission) plus a ClaimRush-vocabulary projection of which
top-level pages the user can see. ClaimRush's AxisContext consumes this
to replace its hardcoded ROLE_PERMISSIONS dict — single source of
truth lives in RIN, not the React app.

No new tables. Read-only. The Role.permissions relationship is already
defined with lazy="subquery", so the join through role_permission is
automatic on access.
"""
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app import models
from app.api.deps import get_current_active_user

router = APIRouter()


class UserPermissions(BaseModel):
    """Response model for /v1/users/me/permissions."""

    user_id: str
    role: str
    modules: dict[str, list[str]]
    pages: list[str]


# ClaimRush-vocabulary page list per role. Mirrors the ROLE_PERMISSIONS
# hardcode in claim-rush/src/portal/AxisContext.jsx — moving the truth
# server-side so the React app can drop its local table on the next pass.
_PAGES_BY_ROLE: dict[str, list[str]] = {
    "super-admin": [
        "dashboard", "payout-runs", "billing", "territory-revenue",
        "fire-leads", "protection-plans", "payout-rules", "forecast",
        "audit", "ops", "pitch", "simulator", "comp-plan", "earnings",
        "my-payouts", "storm-intel", "oversight", "clients",
    ],
    "admin": [
        "dashboard", "payout-runs", "billing", "territory-revenue",
        "fire-leads", "protection-plans", "payout-rules", "forecast",
        "audit", "ops", "pitch", "simulator", "comp-plan", "earnings",
        "my-payouts", "storm-intel", "oversight", "clients",
    ],
    # `oversight` + `pitch` added so CP can see the Manager Oversight queue
    # and Pitch Mode — both are real, fully-built ClaimRush pages that were
    # invisible because the page key wasn't granted here.
    "cp":       ["dashboard", "territory-revenue", "earnings", "fire-leads",
                 "protection-plans", "my-payouts", "clients", "oversight",
                 "pitch"],
    # `oversight` + `clients` added so RVP can see Manager Oversight and
    # the My Clients page (both already in RVP_NAV but hidden by filter).
    "rvp":      ["dashboard", "fire-leads", "earnings", "protection-plans",
                 "my-payouts", "oversight", "clients"],
    # `clients` added so Agent can see My Clients (in AGENT_NAV but hidden).
    "agent":    ["dashboard", "fire-leads", "earnings", "protection-plans",
                 "my-payouts", "clients"],
    # Adjuster left intentionally minimal until the adjuster home surface
    # (claims-side, not lead-side) is decided. ADJUSTER_NAV declares 4
    # items; this list grants 2; the remaining 2 (My Clients, etc.) stay
    # filtered out until product confirms intent.
    "adjuster": ["dashboard", "fire-leads"],
}


def _resolve_module_op(perm: models.Permission) -> tuple[str, str] | None:
    """Return (module, operation) for a Permission row.

    Defensive: prefer the `module` / `operation` columns. Fall back to
    parsing the `name` column as `<module>:<operation>` when the columns
    look like the literal strings 'module'/'operation' (some local seeds
    have this shape — the real data is encoded in `name`).
    """
    module = (perm.module or "").strip()
    operation = (perm.operation or "").strip()
    if module and operation and module != "module" and operation != "operation":
        return module, operation
    name = (perm.name or "").strip()
    if ":" in name:
        m, _, o = name.partition(":")
        if m and o:
            return m.strip(), o.strip()
    return None


@router.get("/me/permissions", response_model=UserPermissions)
def get_my_permissions(
    *,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> UserPermissions:
    """Resolve the current user's role and module/operation permissions."""
    role_name = (current_user.role.name if current_user.role else "").strip().lower()

    # Group permissions by module via the role_permission association table.
    # Role.permissions is lazy="subquery", so this is one extra SQL round-trip.
    modules: dict[str, set[str]] = {}
    if current_user.role:
        for perm in current_user.role.permissions:
            resolved = _resolve_module_op(perm)
            if resolved is None:
                continue
            module, operation = resolved
            modules.setdefault(module, set()).add(operation)

    return UserPermissions(
        user_id=str(current_user.id),
        role=role_name,
        modules={m: sorted(ops) for m, ops in modules.items()},
        pages=_PAGES_BY_ROLE.get(role_name, []),
    )
