#!/usr/bin/env python

"""Routes for the Claim Recovery Dashboard"""

import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, case, and_
from sqlalchemy.orm import Session, joinedload

from app import models
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.enums import ClaimActivityType
from app.core.rbac import Modules
from app.models.carrier_comparison import CarrierComparison
from app.models.carrier_estimate import CarrierEstimate
from app.models.carrier_payment import CarrierPayment
from app.models.claim import Claim
from app.models.claim_activity import ClaimActivity
from app.models.claim_payment import ClaimPayment
from app.models.client import Client
from app.models.estimate_project import EstimateProject
from app.models.fire_claim import FireClaim
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()

module = Modules.ESTIMATE_PROJECT
permissions = Permissions(module.value)


@router.get(
    "/dashboard",
    summary="Claim Recovery Dashboard",
    response_description="Aggregated recovery metrics and claim list from live claim data",
    dependencies=[Depends(permissions.read())],
)
async def get_claim_recovery_dashboard(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> dict[str, Any]:
    """
    Return live claim recovery data from the claims table.

    Data flow:
    - Primary: Claim table (all active claims)
    - Left join: EstimateProject → CarrierComparison for ACI/carrier totals
    - Aggregate: ClaimPayment.check_amount for total payments received
    - Aggregate: CarrierPayment.payment_amount for carrier-side payments
    - Activity: ClaimActivity for last activity date and supplement tracking

    Nulls are treated as zero for all financial calculations.
    Each claim is processed independently — one broken record never crashes the dashboard.
    """

    # ── 1. Load all active claims ──────────────────────────────
    # Use joinedload for performance, but fall back to plain query if
    # any relationship FK is orphaned.

    try:
        claims = (
            db_session.query(Claim)
            .options(
                joinedload(Claim.client),
                joinedload(Claim.assigned_user),
            )
            .filter(Claim.is_removed == False)
            .order_by(Claim.created_at.desc())
            .all()
        )
    except Exception as e:
        logger.warning(
            "claim-recovery/dashboard: joinedload failed (%s), falling back to plain query", e
        )
        db_session.rollback()
        try:
            claims = (
                db_session.query(Claim)
                .filter(Claim.is_removed == False)
                .order_by(Claim.created_at.desc())
                .all()
            )
        except Exception as e2:
            logger.error("claim-recovery/dashboard: plain claim query also failed: %s", e2)
            return _empty_dashboard()

    if not claims:
        return _empty_dashboard()

    claim_ids = [c.id for c in claims]

    # ── 2. Get ACI/carrier totals from carrier comparisons ──────
    comparison_data: dict[UUID, dict] = {}
    try:
        comp_rows = (
            db_session.query(
                EstimateProject.claim_id,
                CarrierComparison.aci_total,
                CarrierComparison.carrier_total,
                CarrierComparison.supplement_total,
                CarrierComparison.status,
                EstimateProject.id.label("project_id"),
                EstimateProject.name.label("project_name"),
            )
            .join(EstimateProject, CarrierComparison.project_id == EstimateProject.id)
            .filter(
                EstimateProject.claim_id.in_(claim_ids),
                EstimateProject.is_removed == False,
                CarrierComparison.status == "completed",
            )
            .order_by(CarrierComparison.created_at.desc())
            .all()
        )
        for row in comp_rows:
            cid = row.claim_id
            if cid and cid not in comparison_data:
                comparison_data[cid] = {
                    "aci_total": float(row.aci_total or 0),
                    "carrier_total": float(row.carrier_total or 0),
                    "supplement_total": float(row.supplement_total or 0),
                    "project_id": str(row.project_id),
                    "project_name": row.project_name or "",
                }
    except Exception as e:
        logger.warning("claim-recovery/dashboard: comparison query failed: %s", e)

    # ── 3. Get carrier estimate names ───────────────────────────
    carrier_names: dict[UUID, str] = {}
    if comparison_data:
        try:
            project_ids = []
            for v in comparison_data.values():
                try:
                    project_ids.append(UUID(v["project_id"]))
                except (ValueError, TypeError):
                    pass

            if project_ids:
                ce_rows = (
                    db_session.query(
                        CarrierEstimate.project_id,
                        CarrierEstimate.carrier_name,
                    )
                    .filter(CarrierEstimate.project_id.in_(project_ids))
                    .order_by(CarrierEstimate.created_at.desc())
                    .all()
                )
                for row in ce_rows:
                    if row.project_id and row.project_id not in carrier_names:
                        carrier_names[row.project_id] = row.carrier_name or ""
        except Exception as e:
            logger.warning("claim-recovery/dashboard: carrier names query failed: %s", e)

    # ── 4. Get claim payment totals ─────────────────────────────
    claim_payment_totals: dict[UUID, float] = {}
    try:
        payment_rows = (
            db_session.query(
                ClaimPayment.claim_id,
                func.coalesce(func.sum(ClaimPayment.check_amount), 0.0),
            )
            .filter(ClaimPayment.claim_id.in_(claim_ids))
            .group_by(ClaimPayment.claim_id)
            .all()
        )
        claim_payment_totals = {row[0]: float(row[1]) for row in payment_rows}
    except Exception as e:
        logger.warning("claim-recovery/dashboard: claim payments query failed: %s", e)

    # Also get carrier-side payments (via estimate project)
    carrier_payment_totals: dict[UUID, float] = {}
    if comparison_data:
        try:
            project_ids = []
            for v in comparison_data.values():
                try:
                    project_ids.append(UUID(v["project_id"]))
                except (ValueError, TypeError):
                    pass

            if project_ids:
                cp_rows = (
                    db_session.query(
                        CarrierPayment.project_id,
                        func.coalesce(func.sum(CarrierPayment.payment_amount), 0.0),
                    )
                    .filter(CarrierPayment.project_id.in_(project_ids))
                    .group_by(CarrierPayment.project_id)
                    .all()
                )
                project_to_claim = {}
                for cid, v in comparison_data.items():
                    try:
                        project_to_claim[UUID(v["project_id"])] = cid
                    except (ValueError, TypeError):
                        pass
                for row in cp_rows:
                    mapped_cid = project_to_claim.get(row[0])
                    if mapped_cid:
                        carrier_payment_totals[mapped_cid] = float(row[1])
        except Exception as e:
            logger.warning("claim-recovery/dashboard: carrier payments query failed: %s", e)

    # ── 5. Get supplement email tracking ──────────────────────
    claim_ids_with_supplement: set[UUID] = set()
    try:
        supplement_rows = (
            db_session.query(ClaimActivity.claim_id)
            .filter(
                ClaimActivity.claim_id.in_(claim_ids),
                ClaimActivity.title == ClaimActivityType.SUPPLEMENT_EMAIL_SENT.value,
            )
            .distinct()
            .all()
        )
        claim_ids_with_supplement = {row[0] for row in supplement_rows}
    except Exception as e:
        logger.warning("claim-recovery/dashboard: supplement tracking query failed: %s", e)

    # ── 6. Get last activity date per claim ───────────────────
    last_activity_dates: dict[UUID, str] = {}
    try:
        activity_rows = (
            db_session.query(
                ClaimActivity.claim_id,
                func.max(ClaimActivity.created_at),
            )
            .filter(ClaimActivity.claim_id.in_(claim_ids))
            .group_by(ClaimActivity.claim_id)
            .all()
        )
        for row in activity_rows:
            if row[0] and row[1]:
                last_activity_dates[row[0]] = row[1].isoformat()
    except Exception as e:
        logger.warning("claim-recovery/dashboard: activity dates query failed: %s", e)

    # ── 7. Build response — each claim processed independently ─

    result_claims: list[dict[str, Any]] = []
    total_aci = 0.0
    total_carrier = 0.0
    total_recoverable = 0.0
    total_recovered = 0.0
    status_counts: dict[str, int] = {}
    skipped_claims = 0

    for claim in claims:
        try:
            comp = comparison_data.get(claim.id, {})
            aci_total = comp.get("aci_total", 0.0)
            carrier_total = comp.get("carrier_total", 0.0)
            supplement_total = comp.get("supplement_total", 0.0)
            project_id = comp.get("project_id", "")
            project_name = comp.get("project_name", "")

            # Total payments = claim payments + carrier payments (use whichever is larger)
            claim_paid = claim_payment_totals.get(claim.id, 0.0)
            carrier_paid = carrier_payment_totals.get(claim.id, 0.0)
            total_paid = max(claim_paid, carrier_paid)

            # If no comparison data, use anticipated_amount as ACI estimate fallback
            if aci_total == 0 and claim.anticipated_amount:
                aci_total = float(claim.anticipated_amount)

            # Recovery calculations (nulls → zero)
            recovery_gap = max(aci_total - carrier_total, 0.0)
            remaining_potential = max(aci_total - total_paid, 0.0)
            recovery_pct = (total_paid / aci_total * 100.0) if aci_total > 0 else 0.0
            supplement_requested = max(aci_total - carrier_total, 0.0) if carrier_total > 0 else 0.0

            # Client name — safe access
            client_name = ""
            try:
                if claim.client:
                    client_name = claim.client.full_name or ""
            except Exception:
                pass

            # Carrier name (from carrier estimate or claim field)
            claim_carrier = claim.insurance_company or ""
            if project_id:
                try:
                    pid = UUID(project_id) if isinstance(project_id, str) else project_id
                    claim_carrier = carrier_names.get(pid, claim_carrier)
                except (ValueError, TypeError):
                    pass

            # Assigned adjuster — safe access
            adjuster_id = str(claim.assigned_to) if claim.assigned_to else None
            adjuster_name = None
            try:
                if claim.assigned_user:
                    adjuster_name = (
                        f"{claim.assigned_user.first_name or ''} "
                        f"{claim.assigned_user.last_name or ''}"
                    ).strip() or None
            except Exception:
                pass

            # Recovery status classification
            phase = (claim.current_phase or "").lower()
            recovery_status = _classify_recovery_status(
                phase=phase,
                aci_total=aci_total,
                carrier_total=carrier_total,
                total_paid=total_paid,
                recovery_pct=recovery_pct,
                has_supplement=claim.id in claim_ids_with_supplement,
                recovery_mode=claim.recovery_mode,
            )

            # Aggregates
            total_aci += aci_total
            total_carrier += carrier_total
            total_recoverable += recovery_gap
            total_recovered += total_paid
            status_counts[recovery_status] = status_counts.get(recovery_status, 0) + 1

            # Claim address — safe access
            address = ""
            try:
                if claim.claim_contact:
                    cc = claim.claim_contact
                    parts = [
                        getattr(cc, 'address_loss', None),
                        getattr(cc, 'city_loss', None),
                        getattr(cc, 'state_loss', None),
                    ]
                    address = ", ".join(p for p in parts if p)
            except Exception:
                pass

            result_claims.append(
                {
                    "claim_id": str(claim.id),
                    "project_id": project_id,
                    "project_name": project_name,
                    "claim_number": claim.claim_number or "",
                    "ref_string": str(claim.ref_number) if claim.ref_number else "",
                    "client_name": client_name,
                    "carrier_name": claim_carrier,
                    "property_address": address,
                    "assigned_adjuster_id": adjuster_id,
                    "assigned_adjuster_name": adjuster_name,
                    "claim_phase": claim.current_phase or "",
                    "recovery_mode": claim.recovery_mode or "none",
                    "aci_total": round(aci_total, 2),
                    "carrier_total": round(carrier_total, 2),
                    "supplement_requested_total": round(supplement_requested, 2),
                    "recoverable_amount": round(recovery_gap, 2),
                    "recovered_amount": round(total_paid, 2),
                    "remaining_recoverable": round(remaining_potential, 2),
                    "recovery_pct": round(recovery_pct, 1),
                    "recovery_status": recovery_status,
                    "last_activity_date": last_activity_dates.get(claim.id),
                    "created_at": claim.created_at.isoformat() if claim.created_at else None,
                }
            )
        except Exception as e:
            skipped_claims += 1
            logger.warning(
                "claim-recovery/dashboard: skipped claim %s due to error: %s",
                getattr(claim, 'id', 'unknown'),
                e,
            )

    if skipped_claims > 0:
        logger.warning(
            "claim-recovery/dashboard: %d claim(s) skipped due to data errors", skipped_claims
        )

    total_claims = len(result_claims)
    avg_recovery_pct = (
        (total_recovered / total_aci * 100.0) if total_aci > 0 else 0.0
    )

    return {
        "total_claims": total_claims,
        "total_aci_value": round(total_aci, 2),
        "total_carrier_value": round(total_carrier, 2),
        "total_recoverable": round(total_recoverable, 2),
        "total_recovered": round(total_recovered, 2),
        "avg_recovery_pct": round(avg_recovery_pct, 1),
        "status_counts": status_counts,
        "claims": result_claims,
    }


def _classify_recovery_status(
    *,
    phase: str,
    aci_total: float,
    carrier_total: float,
    total_paid: float,
    recovery_pct: float,
    has_supplement: bool,
    recovery_mode: str | None,
) -> str:
    """Classify the recovery status from claim data."""

    # Terminal
    if "closed" in phase or "cancelled" in phase:
        return "closed"

    # Fully recovered
    if total_paid > 0 and recovery_pct >= 95:
        return "fully_recovered"

    # Partial payment
    if total_paid > 0 and aci_total > 0 and total_paid < aci_total:
        return "partial_payment"

    # Negotiation / appraisal / litigation
    if recovery_mode and recovery_mode not in ("none", "supplement"):
        return "negotiation"
    if "negotiation" in phase or "appraisal" in phase or "umpire" in phase:
        return "negotiation"

    # Supplement sent
    if has_supplement:
        return "supplement_requested"

    # Carrier review
    if carrier_total > 0 and aci_total > carrier_total and not has_supplement:
        return "supplement_requested"
    if "carrier" in phase or "review" in phase or "insurance" in phase:
        return "carrier_review"

    # Estimating
    if aci_total == 0 or "estimate" in phase or "inspection" in phase or "intake" in phase or "scope" in phase:
        return "estimating"

    return "carrier_review"


def _empty_dashboard() -> dict[str, Any]:
    return {
        "total_claims": 0,
        "total_aci_value": 0,
        "total_carrier_value": 0,
        "total_recoverable": 0,
        "total_recovered": 0,
        "avg_recovery_pct": 0,
        "status_counts": {},
        "claims": [],
    }
