#!/usr/bin/env python

"""Endpoints to link existing estimate records to a commission_claim.

The plumbing layer for the commission-engine ↔ estimating-engine bridge.
Both EstimateProject (firm estimate) and CarrierEstimate (parsed carrier
PDF) gained a nullable commission_claim_id FK in migration c0mm155ag06.
These two PATCH routes set / clear that link without requiring the full
create/update payload of the parent record.

Auth: gated by `commission_auth` to inherit DEV_BYPASS during the
operator-cockpit dev cycle. Switch to `Permissions(Modules.ESTIMATE_PROJECT).update()`
when real auth lands across the cockpit.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps.app import get_db_session
from app.api.deps.dev_bypass import commission_auth
from app.models.carrier_estimate import CarrierEstimate
from app.models.commission_claim import CommissionClaim
from app.models.estimate_project import EstimateProject


router = APIRouter()


def _resolve_claim(db: Session, claim_id: UUID | None) -> None:
    """Reject early if the supplied claim_id doesn't exist. None is allowed
    (callers may pass null to detach)."""
    if claim_id is None:
        return
    claim = db.get(CommissionClaim, claim_id)
    if claim is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"commission_claim {claim_id} not found",
        )


@router.patch("/project/{project_id}/attach-claim")
def attach_project_to_claim(
    project_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
    commission_claim_id: UUID | None = Body(
        None,
        embed=True,
        description="commission_claim UUID to attach. Pass null to detach.",
    ),
):
    """Attach an EstimateProject to a commission_claim (or detach with
    null). Idempotent — re-attaching to the same claim is a no-op."""
    project = db_session.get(EstimateProject, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"estimate_project {project_id} not found",
        )
    _resolve_claim(db_session, commission_claim_id)

    project.commission_claim_id = commission_claim_id
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    return {
        "id": str(project.id),
        "commission_claim_id": str(project.commission_claim_id) if project.commission_claim_id else None,
        "total_cost": project.total_cost,
    }


@router.patch("/carrier/{estimate_id}/attach-claim")
def attach_carrier_estimate_to_claim(
    estimate_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
    commission_claim_id: UUID | None = Body(
        None,
        embed=True,
        description="commission_claim UUID to attach. Pass null to detach.",
    ),
):
    """Attach a CarrierEstimate to a commission_claim (or detach with
    null). Used by the divergence-detection flow in I3."""
    carrier = db_session.get(CarrierEstimate, estimate_id)
    if carrier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"carrier_estimate {estimate_id} not found",
        )
    _resolve_claim(db_session, commission_claim_id)

    carrier.commission_claim_id = commission_claim_id
    db_session.add(carrier)
    db_session.commit()
    db_session.refresh(carrier)

    return {
        "id": str(carrier.id),
        "commission_claim_id": str(carrier.commission_claim_id) if carrier.commission_claim_id else None,
        "project_id": str(carrier.project_id),
        "total_cost": carrier.total_cost,
        "carrier_name": carrier.carrier_name,
    }
