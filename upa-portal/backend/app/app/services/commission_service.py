#!/usr/bin/env python

"""Commission engine service — pure computation over the append-only ledger.

Mirrors the Angular `CommissionEngineService` selector semantics exactly, so
API responses reconcile with dashboard numbers on every selector. All read
methods query `commission_ledger` / `commission_claim` and aggregate in Python.
Write methods (create_claim / record_gross_fee / issue_payout / issue_advance)
emit the corresponding ledger rows atomically.

The 50/50 master split + 60/20/20 field split (80/20 for direct_cp) is the
authoritative commission math. DO NOT change without a ledger migration.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models import (
    CommissionAdvance,
    CommissionClaim,
    CommissionLedger,
    CommissionPayout,
    Role,
    User,
)


# ─── Commission math constants ──────────────────────────────────────────────

MASTER_HOUSE_PCT = Decimal("50")   # House share (of gross)
MASTER_FIELD_PCT = Decimal("50")   # Field share (of gross)
# Field allocation, normalized to 100% within the field pool:
FIELD_WA_PCT = Decimal("60")       # Writing Agent's portion of field
FIELD_RVP_PCT = Decimal("20")      # RVP Override
FIELD_CP_PCT = Decimal("20")       # CP Override
# Direct-CP (no RVP in chain):
DIRECT_FIELD_WA_PCT = Decimal("80")
DIRECT_FIELD_CP_PCT = Decimal("20")


CLAIM_STAGE_LABELS: dict[str, str] = {
    "INTAKE_SIGNED": "Intake (Signed)",
    "INSPECTION_SCHEDULED": "Inspection Scheduled",
    "INSPECTION_COMPLETED": "Inspection Completed",
    "ESTIMATE_IN_PROGRESS": "Estimate in Progress",
    "ESTIMATE_SUBMITTED": "Estimate Submitted",
    "CARRIER_REVIEW": "Carrier Review",
    "NEGOTIATION": "Negotiation",
    "SUPPLEMENT_SUBMITTED": "Supplement Submitted",
    "APPRAISAL": "Appraisal",
    "LITIGATION": "Litigation",
    "SETTLEMENT_REACHED": "Settlement Reached",
    "PAID": "Paid",
}
TERMINAL_STAGES = {"PAID"}


def _round(value: Decimal | float | int) -> float:
    """Match Angular `round()` semantics: 2-decimal, returned as float."""
    if isinstance(value, (int, float)):
        value = Decimal(str(value))
    return float(value.quantize(Decimal("0.01")))


def _txn_type_label(t: str) -> str:
    return {
        "COMMISSION_EARNED": "Commission Earned",
        "PAYOUT_ISSUED": "Payout Issued",
        "ADVANCE_ISSUED": "Advance Issued",
        "INTEREST_APPLIED": "Interest Applied",
        "REPAYMENT_OFFSET": "Repayment Offset",
        "ADJUSTMENT": "Adjustment",
    }.get(t, t)


# ─── Service ────────────────────────────────────────────────────────────────


class CommissionService:
    """Thin service — no state. All methods take (db, …) and return DTO dicts."""

    # ─── Read: per-agent selectors ──────────────────────────────────────

    def get_agent_simple_earnings(self, db: Session, user_id: UUID) -> dict[str, Any]:
        rows = db.execute(
            select(CommissionLedger).where(
                CommissionLedger.user_id == user_id,
                CommissionLedger.bucket == "WRITING_AGENT",
            )
        ).scalars().all()

        earned = sum(
            (r.amount for r in rows if r.txn_type == "COMMISSION_EARNED"),
            Decimal("0"),
        )
        paid = abs(sum(
            (r.amount for r in rows if r.txn_type == "PAYOUT_ISSUED"),
            Decimal("0"),
        ))
        remaining = max(Decimal("0"), earned - paid)

        return {
            "user_id": str(user_id),
            "total_earned": _round(earned),
            "paid_to_date": _round(paid),
            "remaining_balance": _round(remaining),
        }

    def get_earnings_trend(self, db: Session, user_id: UUID) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        points = []
        for i in range(5, -1, -1):
            year = now.year + ((now.month - 1 - i) // 12)
            month = ((now.month - 1 - i) % 12) + 1
            # Query month range
            start = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
            total = db.execute(
                select(func.coalesce(func.sum(CommissionLedger.amount), 0)).where(
                    CommissionLedger.user_id == user_id,
                    CommissionLedger.bucket == "WRITING_AGENT",
                    CommissionLedger.txn_type == "COMMISSION_EARNED",
                    CommissionLedger.ts >= start,
                    CommissionLedger.ts < end,
                )
            ).scalar() or Decimal("0")
            label = start.strftime("%b")
            key = f"{year}-{month:02d}"
            points.append({
                "month_label": label,
                "month_key": key,
                "earned": _round(total),
                "is_current": i == 0,
            })

        current = points[-1]["earned"]
        prior = points[-2]["earned"]
        delta = _round(((current - prior) / prior) * 100) if prior > 0 else 0.0

        return {
            "user_id": str(user_id),
            "points": points,
            "current_month": current,
            "prior_month": prior,
            "delta_percent": delta,
        }

    def get_recent_activity(
        self, db: Session, user_id: UUID, limit: int = 6
    ) -> list[dict[str, Any]]:
        rows = db.execute(
            select(CommissionLedger)
            .where(
                CommissionLedger.user_id == user_id,
                CommissionLedger.bucket == "WRITING_AGENT",
            )
            .order_by(CommissionLedger.ts.desc())
            .limit(limit)
        ).scalars().all()

        out = []
        for r in rows:
            claim_ref = None
            if r.claim_id:
                claim = db.get(CommissionClaim, r.claim_id)
                claim_ref = claim.claim_number if claim else None
            out.append({
                "id": str(r.id),
                "type": r.txn_type,
                "bucket": r.bucket,
                "claim_ref": claim_ref,
                "amount": _round(r.amount),
                "timestamp": r.ts,
                "memo": r.notes,
            })
        return out

    def get_active_claim_contributions(
        self, db: Session, user_id: UUID
    ) -> list[dict[str, Any]]:
        claims = db.execute(
            select(CommissionClaim).where(
                CommissionClaim.writing_agent_id == user_id,
                CommissionClaim.stage.notin_(TERMINAL_STAGES),
            )
        ).scalars().all()
        out = []
        for c in claims:
            wa_of_gross = self._wa_share_of_gross(c.direct_cp) * c.gross_fee / Decimal("100")
            out.append({
                "claim_id": str(c.id),
                "claim_ref": c.claim_number,
                "client_name": c.client_name,
                "stage": c.stage,
                "stage_label": CLAIM_STAGE_LABELS.get(c.stage, c.stage),
                "projected_agent_share": _round(wa_of_gross),
            })
        return out

    def get_claim_earnings_table(
        self, db: Session, user_id: UUID
    ) -> list[dict[str, Any]]:
        claims = db.execute(
            select(CommissionClaim).where(
                CommissionClaim.writing_agent_id == user_id,
            )
        ).scalars().all()
        out = []
        for c in claims:
            rows = db.execute(
                select(CommissionLedger).where(
                    CommissionLedger.claim_id == c.id,
                    CommissionLedger.user_id == user_id,
                    CommissionLedger.bucket == "WRITING_AGENT",
                )
            ).scalars().all()
            earned = sum(
                (r.amount for r in rows if r.txn_type == "COMMISSION_EARNED"),
                Decimal("0"),
            )
            paid = abs(sum(
                (r.amount for r in rows if r.txn_type == "PAYOUT_ISSUED"),
                Decimal("0"),
            ))
            remaining = max(Decimal("0"), earned - paid)
            out.append({
                "claim_id": str(c.id),
                "claim_ref": c.claim_number,
                "client_name": c.client_name,
                "stage": c.stage,
                "stage_label": CLAIM_STAGE_LABELS.get(c.stage, c.stage),
                "earned": _round(earned),
                "paid": _round(paid),
                "remaining": _round(remaining),
            })
        return out

    def get_next_expected_payout(
        self, db: Session, user_id: UUID
    ) -> dict[str, Any]:
        earnings = self.get_agent_simple_earnings(db, user_id)
        remaining = Decimal(str(earnings["remaining_balance"]))
        if remaining <= 0:
            return {
                "estimated_date": "",
                "estimated_amount": 0.0,
                "status_label": "No payout pending",
                "has_pending": False,
            }
        now = datetime.now(timezone.utc)
        # Last day of current month
        if now.month == 12:
            end_of_month = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            end_of_month = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        return {
            "estimated_date": end_of_month.isoformat(),
            "estimated_amount": _round(remaining),
            "status_label": "Processing",
            "has_pending": True,
        }

    def get_taxable_1099_ytd(
        self, db: Session, user_id: UUID, year: int | None = None
    ) -> dict[str, Any]:
        y = year or datetime.now(timezone.utc).year
        year_start = datetime(y, 1, 1, tzinfo=timezone.utc)
        year_end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)

        rows = db.execute(
            select(CommissionLedger).where(
                CommissionLedger.user_id == user_id,
                CommissionLedger.bucket == "WRITING_AGENT",
                CommissionLedger.ts >= year_start,
                CommissionLedger.ts < year_end,
            )
        ).scalars().all()

        payout_rows = [r for r in rows if r.txn_type == "PAYOUT_ISSUED"]
        advance_rows = [r for r in rows if r.txn_type == "ADVANCE_ISSUED"]

        payout_total = abs(sum((r.amount for r in payout_rows), Decimal("0")))
        advance_total = abs(sum((r.amount for r in advance_rows), Decimal("0")))

        return {
            "user_id": str(user_id),
            "year": y,
            "ytd_total": _round(payout_total),           # PAYOUT_ISSUED only
            "payout_total": _round(payout_total),
            "advance_total": _round(advance_total),      # informational
            "transaction_count": len(payout_rows),
        }

    def get_statement(
        self,
        db: Session,
        user_id: UUID,
        period_start: datetime,
        period_end: datetime,
        period_label: str,
        period_type: str,
    ) -> dict[str, Any]:
        user = db.get(User, user_id)
        user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() if user else str(user_id)
        role_name = ""
        if user and user.role_id:
            role = db.get(Role, user.role_id)
            role_name = role.name if role else ""

        mine = db.execute(
            select(CommissionLedger).where(
                CommissionLedger.user_id == user_id,
                CommissionLedger.bucket == "WRITING_AGENT",
            )
        ).scalars().all()

        before = [r for r in mine if r.ts < period_start]
        through_end = [r for r in mine if r.ts <= period_end]
        in_period = sorted(
            [r for r in mine if period_start <= r.ts <= period_end],
            key=lambda r: r.ts,
        )

        # Opening balance (pre-period cumulative)
        opening_earned = sum((r.amount for r in before if r.txn_type == "COMMISSION_EARNED"), Decimal("0"))
        opening_paid = abs(sum((r.amount for r in before if r.txn_type == "PAYOUT_ISSUED"), Decimal("0")))
        opening_adjust = sum((r.amount for r in before if r.txn_type == "ADJUSTMENT"), Decimal("0"))
        opening_balance = _round(opening_earned - opening_paid + opening_adjust)

        # Cumulative-through-period-end totals (match dashboard)
        total_earned = _round(sum((r.amount for r in through_end if r.txn_type == "COMMISSION_EARNED"), Decimal("0")))
        total_paid = _round(abs(sum((r.amount for r in through_end if r.txn_type == "PAYOUT_ISSUED"), Decimal("0"))))
        total_advances = _round(abs(sum((r.amount for r in through_end if r.txn_type == "ADVANCE_ISSUED"), Decimal("0"))))
        closing = max(0.0, _round(Decimal(str(total_earned)) - Decimal(str(total_paid))))

        # 1099 YTD as of period end
        period_year = period_end.year
        year_rows = [r for r in through_end if r.ts.year == period_year]
        y1099 = _round(abs(sum((r.amount for r in year_rows if r.txn_type == "PAYOUT_ISSUED"), Decimal("0"))))

        # Per-claim detail in period
        period_claim_ids = sorted({r.claim_id for r in in_period if r.claim_id})
        claim_details = []
        for cid in period_claim_ids:
            c = db.get(CommissionClaim, cid)
            if not c:
                continue
            rows_c = [r for r in in_period if r.claim_id == cid]
            claim_details.append({
                "claim_id": str(cid),
                "claim_ref": c.claim_number,
                "client_name": c.client_name,
                "stage_label": CLAIM_STAGE_LABELS.get(c.stage, c.stage),
                "earned_in_period": _round(sum((r.amount for r in rows_c if r.txn_type == "COMMISSION_EARNED"), Decimal("0"))),
                "paid_in_period": _round(abs(sum((r.amount for r in rows_c if r.txn_type == "PAYOUT_ISSUED"), Decimal("0")))),
                "advances_in_period": _round(abs(sum((r.amount for r in rows_c if r.txn_type == "ADVANCE_ISSUED"), Decimal("0")))),
            })

        transactions = []
        for r in in_period:
            claim_ref = None
            if r.claim_id:
                c = db.get(CommissionClaim, r.claim_id)
                claim_ref = c.claim_number if c else None
            transactions.append({
                "id": str(r.id),
                "date": r.ts,
                "claim_ref": claim_ref,
                "type": r.txn_type,
                "type_label": _txn_type_label(r.txn_type),
                "amount": _round(r.amount),
                "memo": r.notes,
            })

        return {
            "user_id": str(user_id),
            "user_name": user_name,
            "user_role": role_name,
            "period": {
                "type": period_type,
                "start": period_start,
                "end": period_end,
                "label": period_label,
            },
            "generated_at": datetime.now(timezone.utc),
            "opening_balance": opening_balance,
            "total_earned": total_earned,
            "total_paid": total_paid,
            "advances_issued": total_advances,
            "closing_balance": closing,
            "taxable_1099_ytd": y1099,
            "claim_details": claim_details,
            "transactions": transactions,
        }

    def get_financial_detail(self, db: Session, user_id: UUID) -> dict[str, Any]:
        mine = db.execute(
            select(CommissionLedger)
            .where(
                CommissionLedger.user_id == user_id,
                CommissionLedger.bucket == "WRITING_AGENT",
            )
            .order_by(CommissionLedger.ts)
        ).scalars().all()

        advances = sum((r.amount for r in mine if r.txn_type == "ADVANCE_ISSUED"), Decimal("0"))
        offsets = abs(sum((r.amount for r in mine if r.txn_type == "REPAYMENT_OFFSET"), Decimal("0")))
        interest = sum((r.amount for r in mine if r.txn_type == "INTEREST_APPLIED"), Decimal("0"))
        adjustments = sum((r.amount for r in mine if r.txn_type == "ADJUSTMENT"), Decimal("0"))
        remaining = max(Decimal("0"), advances + interest + adjustments - offsets)

        running = Decimal("0")
        rows = []
        for r in mine:
            if r.txn_type in ("ADVANCE_ISSUED", "INTEREST_APPLIED", "ADJUSTMENT", "REPAYMENT_OFFSET"):
                running += r.amount
            claim = db.get(CommissionClaim, r.claim_id) if r.claim_id else None
            rows.append({
                "date": r.ts,
                "claim_ref": claim.claim_number if claim else "",
                "type": r.txn_type,
                "bucket": r.bucket,
                "amount": _round(r.amount),
                "memo": r.notes,
                "running_balance": _round(max(Decimal("0"), running)),
            })

        # Two-section breakdown per writing-agent claim
        claims = db.execute(
            select(CommissionClaim).where(CommissionClaim.writing_agent_id == user_id)
        ).scalars().all()
        bucket_breakdown = [self._two_section_breakdown(c) for c in claims]

        return {
            "writing_agent_id": str(user_id),
            "advances_total": _round(advances),
            "offsets_total": _round(offsets),
            "interest_total": _round(interest),
            "adjustments_total": _round(adjustments),
            "remaining_balance": _round(remaining),
            "rows": rows,
            "bucket_breakdown_by_claim": bucket_breakdown,
        }

    # ─── Admin ──────────────────────────────────────────────────────────

    def get_admin_overview(self, db: Session) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        if now.month == 12:
            month_end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            month_end = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)

        mtd_earned = db.execute(
            select(CommissionLedger).where(
                CommissionLedger.txn_type == "COMMISSION_EARNED",
                CommissionLedger.ts >= month_start,
                CommissionLedger.ts < month_end,
            )
        ).scalars().all()

        def by_bucket(b: str) -> Decimal:
            return sum((r.amount for r in mtd_earned if r.bucket == b), Decimal("0"))

        # Gross fee MTD: sum the gross on claims whose ledger earned rows are in MTD
        paid_claim_ids = {r.claim_id for r in mtd_earned if r.claim_id}
        total_gross = Decimal("0")
        for cid in paid_claim_ids:
            c = db.get(CommissionClaim, cid)
            if c:
                total_gross += c.gross_fee

        # All non-admin users
        users = db.execute(select(User).where(User.is_active == True)).scalars().all()
        rows = []
        for u in users:
            role = db.get(Role, u.role_id) if u.role_id else None
            role_name = (role.name if role else "").upper()
            if role_name not in ("AGENT", "RVP", "CP"):
                continue

            my_earned = db.execute(
                select(func.coalesce(func.sum(CommissionLedger.amount), 0)).where(
                    CommissionLedger.user_id == u.id,
                    CommissionLedger.txn_type == "COMMISSION_EARNED",
                    CommissionLedger.ts >= month_start,
                    CommissionLedger.ts < month_end,
                )
            ).scalar() or Decimal("0")

            earnings = self.get_agent_simple_earnings(db, u.id)
            remaining = earnings["remaining_balance"]
            y1099 = self.get_taxable_1099_ytd(db, u.id)

            active_claims = db.execute(
                select(func.count(CommissionClaim.id)).where(
                    CommissionClaim.writing_agent_id == u.id,
                    CommissionClaim.stage.notin_(TERMINAL_STAGES),
                )
            ).scalar() or 0

            rows.append({
                "user_id": str(u.id),
                "user_name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
                "org_role": role_name,
                "commissions_earned_mtd": _round(my_earned),
                "advances_outstanding": remaining,
                "remaining_balance": remaining,
                "active_claims": active_claims,
                "taxable_1099_ytd": y1099["ytd_total"],
            })

        return {
            "total_gross_fee_mtd": _round(total_gross),
            "house_share_mtd": _round(by_bucket("HOUSE")),
            "field_share_mtd": _round(
                by_bucket("WRITING_AGENT")
                + by_bucket("RVP_OVERRIDE")
                + by_bucket("CP_OVERRIDE")
                + by_bucket("RESERVE")
            ),
            "reserve_mtd": _round(by_bucket("RESERVE")),
            "outstanding_advances_total": _round(sum(Decimal(str(r["advances_outstanding"])) for r in rows)),
            "rows": rows,
        }

    # ─── Writes ─────────────────────────────────────────────────────────

    def create_claim(
        self,
        db: Session,
        *,
        client_name: str,
        claim_number: str,
        stage: str,
        writing_agent_id: UUID,
        rvp_id: UUID | None,
        cp_id: UUID | None,
        direct_cp: bool,
        gross_fee: Decimal = Decimal("0"),
    ) -> CommissionClaim:
        claim = CommissionClaim(
            client_name=client_name,
            claim_number=claim_number,
            stage=stage,
            writing_agent_id=writing_agent_id,
            rvp_id=rvp_id,
            cp_id=cp_id,
            direct_cp=direct_cp,
            gross_fee=gross_fee,
        )
        db.add(claim)
        db.flush()
        # If gross_fee was set at creation, emit earned rows now.
        if gross_fee and gross_fee > 0:
            self._emit_earned_rows(db, claim, ts=datetime.now(timezone.utc))
        db.commit()
        db.refresh(claim)
        return claim

    def record_gross_fee(
        self,
        db: Session,
        claim_id: UUID,
        gross_fee: Decimal,
        ts: datetime | None = None,
    ) -> CommissionClaim:
        claim = db.get(CommissionClaim, claim_id)
        if not claim:
            raise ValueError(f"Claim {claim_id} not found")
        claim.gross_fee = gross_fee
        claim.stage = "PAID" if claim.stage != "PAID" else claim.stage
        self._emit_earned_rows(db, claim, ts=ts or datetime.now(timezone.utc))
        db.commit()
        db.refresh(claim)
        return claim

    def issue_payout(
        self,
        db: Session,
        *,
        user_id: UUID,
        amount: Decimal,
        issued_at: datetime | None = None,
        method: str | None = None,
        reference: str | None = None,
        claim_id: UUID | None = None,
    ) -> CommissionPayout:
        ts = issued_at or datetime.now(timezone.utc)
        payout = CommissionPayout(
            user_id=user_id,
            amount=amount,
            issued_at=ts,
            method=method,
            reference=reference,
            claim_id=claim_id,
        )
        db.add(payout)
        # Matching ledger entry (negative amount per Angular convention)
        ledger = CommissionLedger(
            user_id=user_id,
            claim_id=claim_id,
            bucket="WRITING_AGENT",
            txn_type="PAYOUT_ISSUED",
            amount=-abs(amount),
            ts=ts,
            notes=f"Payout {reference or ''}".strip(),
        )
        db.add(ledger)
        db.commit()
        db.refresh(payout)
        return payout

    def issue_advance(
        self,
        db: Session,
        *,
        user_id: UUID,
        amount: Decimal,
        issued_at: datetime | None = None,
        notes: str | None = None,
        claim_id: UUID | None = None,
    ) -> CommissionAdvance:
        ts = issued_at or datetime.now(timezone.utc)
        adv = CommissionAdvance(
            user_id=user_id,
            amount=amount,
            issued_at=ts,
            notes=notes,
            claim_id=claim_id,
        )
        db.add(adv)
        ledger = CommissionLedger(
            user_id=user_id,
            claim_id=claim_id,
            bucket="WRITING_AGENT",
            txn_type="ADVANCE_ISSUED",
            amount=abs(amount),
            ts=ts,
            notes=notes,
        )
        db.add(ledger)
        db.commit()
        db.refresh(adv)
        return adv

    # ─── Internals ──────────────────────────────────────────────────────

    def _wa_share_of_gross(self, direct_cp: bool) -> Decimal:
        wa_field_pct = DIRECT_FIELD_WA_PCT if direct_cp else FIELD_WA_PCT
        return (MASTER_FIELD_PCT * wa_field_pct) / Decimal("100")

    def _emit_earned_rows(
        self, db: Session, claim: CommissionClaim, ts: datetime
    ) -> None:
        """Write the 5-bucket COMMISSION_EARNED ledger entries for a settled claim."""
        gross = claim.gross_fee
        if gross is None or gross <= 0:
            return

        house_amt = gross * MASTER_HOUSE_PCT / Decimal("100")
        field_share = gross * MASTER_FIELD_PCT / Decimal("100")

        if claim.direct_cp:
            wa_pct, rvp_pct, cp_pct = DIRECT_FIELD_WA_PCT, Decimal("0"), DIRECT_FIELD_CP_PCT
        else:
            wa_pct, rvp_pct, cp_pct = FIELD_WA_PCT, FIELD_RVP_PCT, FIELD_CP_PCT

        wa_amt = field_share * wa_pct / Decimal("100")
        rvp_amt = field_share * rvp_pct / Decimal("100")
        cp_amt = field_share * cp_pct / Decimal("100")

        def row(user_id: UUID | None, bucket: str, amount: Decimal, memo: str) -> CommissionLedger:
            return CommissionLedger(
                user_id=user_id,
                claim_id=claim.id,
                bucket=bucket,
                txn_type="COMMISSION_EARNED",
                amount=amount,
                ts=ts,
                notes=memo,
            )

        # House always emits (sentinel user_id=None)
        db.add(row(None, "HOUSE", house_amt, f"Commission earned — HOUSE — {claim.claim_number}"))
        # Writing agent
        db.add(row(
            claim.writing_agent_id, "WRITING_AGENT", wa_amt,
            f"Commission earned — WRITING_AGENT — {claim.claim_number}",
        ))
        # RVP (only if present and non-zero)
        if rvp_amt > 0 and claim.rvp_id:
            db.add(row(
                claim.rvp_id, "RVP_OVERRIDE", rvp_amt,
                f"Commission earned — RVP_OVERRIDE — {claim.claim_number}",
            ))
        # CP (only if present and non-zero)
        if cp_amt > 0 and claim.cp_id:
            db.add(row(
                claim.cp_id, "CP_OVERRIDE", cp_amt,
                f"Commission earned — CP_OVERRIDE — {claim.claim_number}",
            ))

    def _two_section_breakdown(self, claim: CommissionClaim) -> dict[str, Any]:
        gross = claim.gross_fee
        house_amt = gross * MASTER_HOUSE_PCT / Decimal("100")
        field_amt = gross * MASTER_FIELD_PCT / Decimal("100")

        if claim.direct_cp:
            wa_pct, rvp_pct, cp_pct = DIRECT_FIELD_WA_PCT, Decimal("0"), DIRECT_FIELD_CP_PCT
        else:
            wa_pct, rvp_pct, cp_pct = FIELD_WA_PCT, FIELD_RVP_PCT, FIELD_CP_PCT

        def pct_of_gross(p_field: Decimal) -> Decimal:
            return MASTER_FIELD_PCT * p_field / Decimal("100")

        field_buckets = []
        for bucket, p_field, recipient in (
            ("WRITING_AGENT", wa_pct, claim.writing_agent_id),
            ("RVP_OVERRIDE", rvp_pct, claim.rvp_id),
            ("CP_OVERRIDE", cp_pct, claim.cp_id),
        ):
            if p_field <= 0:
                continue
            field_buckets.append({
                "bucket": bucket,
                "label": {
                    "WRITING_AGENT": "Writing Agent",
                    "RVP_OVERRIDE": "RVP Override",
                    "CP_OVERRIDE": "CP Override",
                }[bucket],
                "percent_of_field": float(p_field),
                "percent_of_gross": float(pct_of_gross(p_field)),
                "amount": _round(gross * pct_of_gross(p_field) / Decimal("100")),
                "recipient_user_id": str(recipient) if recipient else None,
            })

        return {
            "claim_id": str(claim.id),
            "claim_ref": claim.claim_number,
            "gross_fee": _round(gross),
            "house": {
                "percent_of_gross": float(MASTER_HOUSE_PCT),
                "amount": _round(house_amt),
            },
            "field_total": {
                "percent_of_gross": float(MASTER_FIELD_PCT),
                "amount": _round(field_amt),
            },
            "field_buckets": field_buckets,
        }


commission_service = CommissionService()
