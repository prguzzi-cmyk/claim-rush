#!/usr/bin/env python

"""Commission engine API routes.

All routes mount under `/v1/commission` (prefix applied in api.py). Response
shapes are 1:1 with the Angular engine view-models so the frontend data
service can pass responses straight through to the selector consumers.

Auth: gated by `commission_auth` — returns the user or None in DEV_BYPASS=1.
See docs in app/api/deps/dev_bypass.py.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps.app import get_db_session
from app.api.deps.dev_bypass import commission_auth
from app.schemas.commission import (
    ActiveClaimContributionDTO,
    AdminOverviewDTO,
    AdvanceDTO,
    AgentSimpleEarningsDTO,
    ClaimDTO,
    ClaimEarningsRowDTO,
    CreateAdvanceRequest,
    CreateClaimRequest,
    CreatePayoutRequest,
    EarningsTrendDTO,
    FinancialDetailDTO,
    IssueAdjusterCompensationRequest,
    NextExpectedPayoutDTO,
    PayoutDTO,
    RecentActivityItemDTO,
    RecordGrossFeeRequest,
    StatementDTO,
    Taxable1099DTO,
)
from app.services.commission_service import commission_service


router = APIRouter()


# ─── Per-agent selectors ────────────────────────────────────────────────────


@router.get("/agent/{user_id}/earnings", response_model=AgentSimpleEarningsDTO)
def get_agent_earnings(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    return commission_service.get_agent_simple_earnings(db_session, user_id)


@router.get("/agent/{user_id}/trend", response_model=EarningsTrendDTO)
def get_agent_trend(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    return commission_service.get_earnings_trend(db_session, user_id)


@router.get("/agent/{user_id}/activity", response_model=list[RecentActivityItemDTO])
def get_agent_activity(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
    limit: int = Query(6, ge=1, le=50),
):
    return commission_service.get_recent_activity(db_session, user_id, limit=limit)


@router.get("/agent/{user_id}/active-claims", response_model=list[ActiveClaimContributionDTO])
def get_agent_active_claims(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    return commission_service.get_active_claim_contributions(db_session, user_id)


@router.get("/agent/{user_id}/ledger", response_model=list[ClaimEarningsRowDTO])
def get_agent_ledger(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    return commission_service.get_claim_earnings_table(db_session, user_id)


@router.get("/agent/{user_id}/next-payout", response_model=NextExpectedPayoutDTO)
def get_agent_next_payout(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    return commission_service.get_next_expected_payout(db_session, user_id)


@router.get("/agent/{user_id}/1099-ytd", response_model=Taxable1099DTO)
def get_agent_1099_ytd(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
    year: int | None = Query(None),
):
    return commission_service.get_taxable_1099_ytd(db_session, user_id, year=year)


@router.get("/agent/{user_id}/statement", response_model=StatementDTO)
def get_agent_statement(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
    type: str = Query(..., description="week | month | year | custom"),
    start: datetime = Query(...),
    end: datetime = Query(...),
    label: str = Query(...),
):
    return commission_service.get_statement(
        db_session,
        user_id=user_id,
        period_start=start,
        period_end=end,
        period_label=label,
        period_type=type,
    )


@router.get("/agent/{user_id}/financial-detail", response_model=FinancialDetailDTO)
def get_agent_financial_detail(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    return commission_service.get_financial_detail(db_session, user_id)


# ─── Admin ──────────────────────────────────────────────────────────────────


@router.get("/admin/overview", response_model=AdminOverviewDTO)
def get_admin_overview(
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    return commission_service.get_admin_overview(db_session)


# ─── Writes ─────────────────────────────────────────────────────────────────


@router.post("/claims", response_model=ClaimDTO, status_code=status.HTTP_201_CREATED)
def create_claim(
    payload: CreateClaimRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    claim = commission_service.create_claim(
        db_session,
        client_name=payload.client_name,
        claim_number=payload.claim_number,
        stage=payload.stage,
        writing_agent_id=payload.writing_agent_id,
        rvp_id=payload.rvp_id,
        cp_id=payload.cp_id,
        direct_cp=payload.direct_cp,
        gross_fee=payload.gross_fee,
    )
    return _claim_to_dto(claim)


@router.post("/claims/{claim_id}/gross-fee", response_model=ClaimDTO)
def record_gross_fee(
    claim_id: UUID,
    payload: RecordGrossFeeRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    try:
        claim = commission_service.record_gross_fee(
            db_session, claim_id, payload.gross_fee, ts=payload.ts,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _claim_to_dto(claim)


@router.post("/payouts", response_model=PayoutDTO, status_code=status.HTTP_201_CREATED)
def create_payout(
    payload: CreatePayoutRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    p = commission_service.issue_payout(
        db_session,
        user_id=payload.user_id,
        amount=payload.amount,
        issued_at=payload.issued_at,
        method=payload.method,
        reference=payload.reference,
        claim_id=payload.claim_id,
    )
    return {
        "id": str(p.id),
        "user_id": str(p.user_id),
        "amount": float(p.amount),
        "issued_at": p.issued_at,
        "method": p.method,
        "reference": p.reference,
        "claim_id": str(p.claim_id) if p.claim_id else None,
    }


@router.post("/advances", response_model=AdvanceDTO, status_code=status.HTTP_201_CREATED)
def create_advance(
    payload: CreateAdvanceRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    a = commission_service.issue_advance(
        db_session,
        user_id=payload.user_id,
        amount=payload.amount,
        issued_at=payload.issued_at,
        notes=payload.notes,
        claim_id=payload.claim_id,
    )
    return {
        "id": str(a.id),
        "user_id": str(a.user_id),
        "amount": float(a.amount),
        "issued_at": a.issued_at,
        "repaid_amount": float(a.repaid_amount),
        "notes": a.notes,
        "claim_id": str(a.claim_id) if a.claim_id else None,
    }


@router.post("/adjuster-comp", status_code=status.HTTP_201_CREATED)
def issue_adjuster_compensation(
    payload: IssueAdjusterCompensationRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Manually emit an ADJUSTER_COMPENSATION ledger pair for a claim.
    If `amount` is omitted, it's computed as profile.adjuster_comp_percent
    × the claim's HOUSE share."""
    try:
        row = commission_service.issue_adjuster_compensation(
            db_session,
            user_id=payload.user_id,
            claim_id=payload.claim_id,
            amount=payload.amount,
            notes=payload.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "claim_id": str(row.claim_id) if row.claim_id else None,
        "bucket": row.bucket,
        "txn_type": row.txn_type,
        "amount": float(row.amount),
        "ts": row.ts,
        "notes": row.notes,
    }


# ─── Helpers ────────────────────────────────────────────────────────────────


def _claim_to_dto(claim) -> dict:
    return {
        "id": str(claim.id),
        "client_name": claim.client_name,
        "claim_number": claim.claim_number,
        "stage": claim.stage,
        "gross_fee": float(claim.gross_fee),
        "writing_agent_id": str(claim.writing_agent_id),
        "rvp_id": str(claim.rvp_id) if claim.rvp_id else None,
        "cp_id": str(claim.cp_id) if claim.cp_id else None,
        "direct_cp": claim.direct_cp,
        "created_at": claim.created_at,
    }
