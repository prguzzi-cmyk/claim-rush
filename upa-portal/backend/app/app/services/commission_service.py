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

from app.config.advance_schedule import (
    LIFETIME_CAP_PER_MEMBER,
    WEEKLY_CAP_PER_MEMBER,
    compute_tier_amount,
)
from app.models import (
    AgentProfile,
    CommissionAdvance,
    CommissionClaim,
    CommissionLedger,
    CommissionPayout,
    Role,
    User,
)


# ─── Commission math ───────────────────────────────────────────────────────
#
# Master split (unchanged): House 50% / Field 50%.
# Field distribution is scenario-dispatched by the writing agent's role:
#
#   S1  CP writes solo                       CP 100%
#   S2  RVP writes (CP above, no WA)         RVP 80 | CP 20
#   S3  WA writes full chain (RVP + CP)      WA 70 | RVP 10 | CP 20
#   S4  WA writes direct-CP (no RVP)         WA 70 | CP 30
#
# The writing agent always receives their share into the WRITING_AGENT
# bucket regardless of their own role. Override buckets (RVP_OVERRIDE /
# CP_OVERRIDE) are only for people ABOVE the writing agent in the chain.
# Every scenario sums to 100% of field (no Reserve bucket unless explicitly
# allocated).

MASTER_HOUSE_PCT = Decimal("50")
MASTER_FIELD_PCT = Decimal("50")


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
        "ADJUSTER_COMPENSATION": "Adjuster Compensation",
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
            wa_of_gross = self._wa_share_of_gross(db, c) * c.gross_fee / Decimal("100")
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
        bucket_breakdown = [self._two_section_breakdown(c, db) for c in claims]

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

    def list_claims(self, db: Session) -> list[dict[str, Any]]:
        """Return all commission_claim rows with denormalized recipient
        names for the admin claims table. Ordered newest-first."""
        claims = db.execute(
            select(CommissionClaim).order_by(CommissionClaim.created_at.desc())
        ).scalars().all()

        def name_of(user_id: UUID | None) -> str | None:
            if not user_id:
                return None
            u = db.get(User, user_id)
            if not u:
                return None
            return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email

        out = []
        for c in claims:
            out.append({
                "id": str(c.id),
                "claim_number": c.claim_number,
                "client_name": c.client_name,
                "stage": c.stage,
                "stage_label": CLAIM_STAGE_LABELS.get(c.stage, c.stage),
                "gross_fee": _round(c.gross_fee or Decimal("0")),
                "estimate_amount": _round(c.estimate_amount) if c.estimate_amount is not None else None,
                "writing_agent_id": str(c.writing_agent_id),
                "writing_agent_name": name_of(c.writing_agent_id) or "",
                "rvp_id": str(c.rvp_id) if c.rvp_id else None,
                "rvp_name": name_of(c.rvp_id),
                "cp_id": str(c.cp_id) if c.cp_id else None,
                "cp_name": name_of(c.cp_id),
                "direct_cp": c.direct_cp,
                "property_address": c.property_address,
                "street_address": c.street_address,
                "unit": c.unit,
                "city": c.city,
                "state": c.state,
                "zip": c.zip,
                "carrier": c.carrier,
                "loss_date": c.loss_date,
                "loss_type": c.loss_type,
                "notes": c.notes,
                "created_at": c.created_at,
            })
        return out

    def get_settlement_breakdown(
        self, db: Session, claim_id: UUID,
    ) -> dict[str, Any]:
        """Return the two-section (house + field) breakdown for a single
        claim — used to display "House $X / WA $X / RVP $X / CP $X" after
        settlement."""
        claim = db.get(CommissionClaim, claim_id)
        if claim is None:
            raise ValueError(f"Claim {claim_id} not found")
        return self._two_section_breakdown(claim, db)

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
        claim_number: str | None = None,
        stage: str = "INTAKE_SIGNED",
        writing_agent_id: UUID,
        rvp_id: UUID | None = None,
        cp_id: UUID | None = None,
        direct_cp: bool | None = None,
        gross_fee: Decimal = Decimal("0"),
        estimate_amount: Decimal | None = None,
        # Structured address (preferred).
        # Unit / apt / suite is NOT a separate field — operators append
        # to street_address ("123 Maple St, Apt 4B").
        street_address: str | None = None,
        city: str | None = None,
        state: str | None = None,
        zip: str | None = None,
        # Legacy free-form address; only populated for back-compat writes
        property_address: str | None = None,
        carrier: str | None = None,
        loss_date=None,
        loss_type: str | None = None,
        notes: str | None = None,
    ) -> CommissionClaim:
        """Create a commission_claim. If `rvp_id` / `cp_id` are omitted, they
        are auto-resolved by walking `User.manager_id` up from the writing
        agent (first RVP ancestor → rvp_id, first CP ancestor → cp_id).
        If `claim_number` is omitted, generates RIN-YYMM-XXXX from a per-month
        sequence so dev/manual intake doesn't need the operator to invent one.

        Intake does NOT fire commission splits — splits fire at settlement
        via record_gross_fee. `estimate_amount` is captured for advance
        tier eligibility but is financially inert.
        """
        if claim_number is None:
            claim_number = self._next_claim_number(db)

        if rvp_id is None or cp_id is None:
            resolved_rvp, resolved_cp = self._resolve_hierarchy_from(
                db, writing_agent_id,
            )
            if rvp_id is None:
                rvp_id = resolved_rvp
            if cp_id is None:
                cp_id = resolved_cp

        # direct_cp is a display/advisory flag — derive it if the caller
        # didn't override. (Scenario 4 in the comp plan: no RVP, but a CP.)
        if direct_cp is None:
            direct_cp = rvp_id is None and cp_id is not None

        claim = CommissionClaim(
            client_name=client_name,
            claim_number=claim_number,
            stage=stage,
            writing_agent_id=writing_agent_id,
            rvp_id=rvp_id,
            cp_id=cp_id,
            direct_cp=direct_cp,
            gross_fee=gross_fee,
            estimate_amount=estimate_amount,
            street_address=street_address,
            city=city,
            state=state,
            zip=zip,
            property_address=property_address,
            carrier=carrier,
            loss_date=loss_date,
            loss_type=loss_type,
            notes=notes,
        )
        db.add(claim)
        db.flush()
        # If gross_fee was set at creation, emit earned rows now.
        if gross_fee and gross_fee > 0:
            self._emit_earned_rows(db, claim, ts=datetime.now(timezone.utc))
        db.commit()
        db.refresh(claim)
        return claim

    def _resolve_hierarchy_from(
        self, db: Session, writing_agent_id: UUID,
    ) -> tuple[UUID | None, UUID | None]:
        """Walk manager_id up from the writing agent, returning the first
        RVP ancestor's user_id and the first CP ancestor's user_id (either
        may be None). Cycles are guarded by a visited-set — malformed data
        can't spin forever."""
        rvp_id: UUID | None = None
        cp_id: UUID | None = None
        visited: set = set()

        cursor = db.get(User, writing_agent_id)
        while cursor is not None and cursor.id not in visited:
            visited.add(cursor.id)
            role = db.get(Role, cursor.role_id) if cursor.role_id else None
            role_name = (role.name if role else "").upper()
            # The writing agent themselves shouldn't claim their own override
            # slot — skip attribution on the seed node.
            if cursor.id != writing_agent_id:
                if role_name == "RVP" and rvp_id is None:
                    rvp_id = cursor.id
                elif role_name == "CP" and cp_id is None:
                    cp_id = cursor.id
            if cp_id is not None and rvp_id is not None:
                break
            if cursor.manager_id is None:
                break
            cursor = db.get(User, cursor.manager_id)

        return rvp_id, cp_id

    def _next_claim_number(self, db: Session) -> str:
        """Generate a RIN-YYMM-XXXX claim number. The XXXX is a 4-digit
        zero-padded counter scoped to the YYMM prefix; concurrent inserts
        are protected by the unique-index on claim_number — on collision
        the caller should retry at a higher layer, but the race window is
        very small given the intake cadence."""
        now = datetime.now(timezone.utc)
        prefix = f"RIN-{now.strftime('%y%m')}"
        existing = db.execute(
            select(func.count(CommissionClaim.id)).where(
                CommissionClaim.claim_number.like(f"{prefix}-%")
            )
        ).scalar() or 0
        return f"{prefix}-{existing + 1:04d}"

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

    # Schedule caps — sourced from app.config.advance_schedule (shared
    # policy mirror of adjuster-portal-ui/src/app/config/advance-schedule.ts).
    ADVANCE_WEEKLY_CAP = WEEKLY_CAP_PER_MEMBER
    ADVANCE_LIFETIME_CAP = LIFETIME_CAP_PER_MEMBER

    def get_advance_stats(
        self,
        db: Session,
        user_id: UUID,
        claim_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Return the totals used by the Issue Advance dialog's cap tiles
        and pre-submit validation:

          - lifetime_total: sum of all ADVANCE_ISSUED amounts for the user
          - week_total: sum within the current Monday–Sunday calendar week
          - this_claim_has_advance: True if claim_id already has an
            ADVANCE_ISSUED row (one-advance-per-claim rule)
          - lifetime_cap / weekly_cap: mirrored from constants

        Week boundary is Mon 00:00:00 UTC through next Mon 00:00:00 UTC.
        """
        rows = db.execute(
            select(CommissionLedger).where(
                CommissionLedger.user_id == user_id,
                CommissionLedger.txn_type == "ADVANCE_ISSUED",
            )
        ).scalars().all()

        now = datetime.now(timezone.utc)
        week_start = (
            now.replace(hour=0, minute=0, second=0, microsecond=0)
            - timedelta(days=now.weekday())
        )
        week_end = week_start + timedelta(days=7)

        lifetime = sum((abs(r.amount) for r in rows), Decimal("0"))
        week = sum(
            (abs(r.amount) for r in rows if week_start <= r.ts < week_end),
            Decimal("0"),
        )
        has_claim_advance = False
        if claim_id is not None:
            has_claim_advance = any(r.claim_id == claim_id for r in rows)

        return {
            "user_id": str(user_id),
            "claim_id": str(claim_id) if claim_id else None,
            "week_total": _round(week),
            "lifetime_total": _round(lifetime),
            "this_claim_has_advance": has_claim_advance,
            "weekly_cap": float(self.ADVANCE_WEEKLY_CAP),
            "lifetime_cap": float(self.ADVANCE_LIFETIME_CAP),
            "week_start": week_start,
            "week_end": week_end,
        }

    def issue_advance(
        self,
        db: Session,
        *,
        user_id: UUID,
        amount: Decimal,
        issued_at: datetime | None = None,
        notes: str | None = None,
        claim_id: UUID | None = None,
        admin_override: bool = False,
    ) -> CommissionAdvance:
        """Emit an ADVANCE_ISSUED ledger row + a commission_advance record.

        Enforces the advance schedule defined in app.config.advance_schedule:

          1. Tier match — if a linked claim with an estimate_amount is
             present and it maps to a tier, `amount` MUST equal the
             tier's amount unless `admin_override=True`.
          2. Under-minimum policy — if the claim's estimate is below
             the lowest tier's minimum, `admin_override=True` is
             required for any amount.
          3. Discretionary — if no claim_id is supplied, or the claim
             has no estimate_amount, `admin_override=True` is required.
          4. One-advance-per-claim — a claim already bearing an
             ADVANCE_ISSUED row rejects further advances.
          5. Weekly cap — week_total + amount <= $5,000.
          6. Lifetime cap — lifetime_total + amount <= $25,000.

        Raises ValueError on any violation. `admin_override` lifts (1)
        and (2)/(3) but NEVER the caps (4)/(5) or the one-per-claim
        rule — those are hard limits."""
        abs_amount = abs(amount)

        # ── Rule 1–3: tier / under-minimum / discretionary ─────────────
        claim = db.get(CommissionClaim, claim_id) if claim_id else None
        estimate = claim.estimate_amount if claim else None
        tier = compute_tier_amount(estimate)

        if tier is not None:
            # Estimate matched a tier — amount must match or admin_override.
            if abs_amount != tier and not admin_override:
                raise ValueError(
                    f"Advance amount ${float(abs_amount)} does not match the "
                    f"tier amount ${float(tier)} for this claim's estimate "
                    f"(${float(estimate)}). Toggle admin override to issue "
                    f"a discretionary amount."
                )
        else:
            # No tier matched — either no claim, no estimate, or below minimum.
            # All three require admin discretion.
            if not admin_override:
                if claim is None:
                    reason = "no linked claim"
                elif estimate is None or estimate <= 0:
                    reason = "the linked claim has no estimate_amount"
                else:
                    reason = (
                        f"the estimate (${float(estimate)}) is below the lowest "
                        "tier minimum"
                    )
                raise ValueError(
                    f"Advance requires admin override — {reason}. "
                    "Set admin_override=True to proceed."
                )

        # ── Rules 4–6: caps + one-per-claim (re-fetched stats) ─────────
        stats = self.get_advance_stats(db, user_id, claim_id=claim_id)
        if claim_id is not None and stats["this_claim_has_advance"]:
            raise ValueError("An advance has already been issued against this claim.")

        week_after = Decimal(str(stats["week_total"])) + abs_amount
        if week_after > self.ADVANCE_WEEKLY_CAP:
            raise ValueError(
                f"Weekly advance cap exceeded: ${stats['week_total']} already issued "
                f"this week, requested ${float(abs_amount)} would bring total to "
                f"${float(week_after)} (cap ${float(self.ADVANCE_WEEKLY_CAP)})."
            )

        lifetime_after = Decimal(str(stats["lifetime_total"])) + abs_amount
        if lifetime_after > self.ADVANCE_LIFETIME_CAP:
            raise ValueError(
                f"Lifetime advance cap exceeded: ${stats['lifetime_total']} lifetime "
                f"issued, requested ${float(abs_amount)} would bring total to "
                f"${float(lifetime_after)} (cap ${float(self.ADVANCE_LIFETIME_CAP)})."
            )

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
            amount=abs_amount,
            ts=ts,
            notes=notes,
        )
        db.add(ledger)
        db.commit()
        db.refresh(adv)
        return adv

    def issue_adjuster_compensation(
        self,
        db: Session,
        *,
        user_id: UUID,
        claim_id: UUID,
        amount: Decimal | None = None,
        notes: str | None = None,
        ts: datetime | None = None,
    ) -> CommissionLedger:
        """Emit an ADJUSTER_COMPENSATION row that deducts from the HOUSE
        bucket. If `amount` is omitted, computed as
        profile.adjuster_comp_percent × claim.house_share on the supplied
        claim. P&L math: two rows are written — a negative HOUSE row (so the
        firm's take drops by the adjuster's cut) and a positive WRITING_AGENT
        row on the adjuster's user_id (so they can see it in their earnings
        view the same way other recipients do).
        """
        claim = db.get(CommissionClaim, claim_id)
        if claim is None:
            raise ValueError(f"Claim {claim_id} not found")

        profile = db.execute(
            select(AgentProfile).where(AgentProfile.user_id == user_id)
        ).scalar_one_or_none()

        if amount is None:
            if profile is None or profile.adjuster_comp_percent is None:
                raise ValueError(
                    "amount not provided and adjuster profile has no "
                    "adjuster_comp_percent configured"
                )
            if claim.gross_fee is None or claim.gross_fee <= 0:
                raise ValueError("Cannot auto-compute: claim has no gross_fee")
            house_share = claim.gross_fee * MASTER_HOUSE_PCT / Decimal("100")
            amount = house_share * profile.adjuster_comp_percent / Decimal("100")

        amount = abs(amount)
        when = ts or datetime.now(timezone.utc)
        memo = notes or f"Adjuster compensation — {claim.claim_number}"

        # Negative HOUSE row: firm's take drops.
        house_row = CommissionLedger(
            user_id=None,
            claim_id=claim.id,
            bucket="HOUSE",
            txn_type="ADJUSTER_COMPENSATION",
            amount=-amount,
            ts=when,
            notes=memo,
        )
        # Positive recipient row: adjuster sees earnings.
        agent_row = CommissionLedger(
            user_id=user_id,
            claim_id=claim.id,
            bucket="WRITING_AGENT",
            txn_type="ADJUSTER_COMPENSATION",
            amount=amount,
            ts=when,
            notes=memo,
        )
        db.add(house_row)
        db.add(agent_row)
        db.commit()
        db.refresh(agent_row)
        return agent_row

    # ─── Internals ──────────────────────────────────────────────────────

    def _get_writing_agent_role_name(self, db: Session, claim: CommissionClaim) -> str | None:
        wa = db.get(User, claim.writing_agent_id) if claim.writing_agent_id else None
        if wa and wa.role_id:
            role = db.get(Role, wa.role_id)
            return role.name if role else None
        return None

    def _resolve_field_split(
        self, claim: CommissionClaim, writing_agent_role: str | None,
    ) -> tuple[Decimal, Decimal, Decimal]:
        """Return (wa_pct, rvp_pct, cp_pct) — percent of field by bucket
        recipient — per the 4-scenario comp plan. Dispatched from the
        writing agent's ROLE, not the `direct_cp` flag (which is advisory).
        """
        role = (writing_agent_role or "").upper()

        # Scenario 1: CP writes solo. 100% of field goes to the writing
        # agent (into the WRITING_AGENT bucket regardless of their role).
        if role == "CP":
            return Decimal("100"), Decimal("0"), Decimal("0")

        # Scenario 2: RVP writes with a CP above.
        if role == "RVP":
            return Decimal("80"), Decimal("0"), Decimal("20")

        # Scenarios 3 / 4: Agent writes.
        has_rvp = claim.rvp_id is not None
        if has_rvp:
            # Scenario 3: full chain
            return Decimal("70"), Decimal("10"), Decimal("20")
        else:
            # Scenario 4: direct-CP (WA absorbs nothing; CP absorbs the
            # missing RVP's 10% → CP gets 30%)
            return Decimal("70"), Decimal("0"), Decimal("30")

    def _wa_share_of_gross(
        self, db: Session, claim: CommissionClaim,
    ) -> Decimal:
        """Writing agent's take (as percent of gross fee) under the
        current comp plan for this claim's scenario. Used by pipeline
        projection on active claims."""
        role = self._get_writing_agent_role_name(db, claim)
        wa_pct, _, _ = self._resolve_field_split(claim, role)
        return (MASTER_FIELD_PCT * wa_pct) / Decimal("100")

    def _emit_earned_rows(
        self, db: Session, claim: CommissionClaim, ts: datetime
    ) -> None:
        """Write COMMISSION_EARNED ledger entries for a settled claim, using
        the 4-scenario comp plan dispatched from the writing agent's role."""
        gross = claim.gross_fee
        if gross is None or gross <= 0:
            return

        house_amt = gross * MASTER_HOUSE_PCT / Decimal("100")
        field_share = gross * MASTER_FIELD_PCT / Decimal("100")

        role = self._get_writing_agent_role_name(db, claim)
        wa_pct, rvp_pct, cp_pct = self._resolve_field_split(claim, role)

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

        # House always emits (sentinel user_id=None).
        db.add(row(None, "HOUSE", house_amt, f"Commission earned — HOUSE — {claim.claim_number}"))

        # Writing agent always receives their share via WRITING_AGENT bucket,
        # regardless of their own role (CP-solo included).
        if wa_amt > 0:
            db.add(row(
                claim.writing_agent_id, "WRITING_AGENT", wa_amt,
                f"Commission earned — WRITING_AGENT — {claim.claim_number}",
            ))

        # RVP override (only if the scenario allocates to RVP and a recipient
        # is actually designated).
        if rvp_amt > 0 and claim.rvp_id:
            db.add(row(
                claim.rvp_id, "RVP_OVERRIDE", rvp_amt,
                f"Commission earned — RVP_OVERRIDE — {claim.claim_number}",
            ))

        # CP override — only emitted when the writing agent is NOT themselves
        # the CP. (In Scenario 1, the writing agent already received 100% as
        # WRITING_AGENT; emitting a CP_OVERRIDE to the same user would
        # double-count.)
        role_upper = (role or "").upper()
        if cp_amt > 0 and claim.cp_id and role_upper != "CP":
            db.add(row(
                claim.cp_id, "CP_OVERRIDE", cp_amt,
                f"Commission earned — CP_OVERRIDE — {claim.claim_number}",
            ))

    def _two_section_breakdown(self, claim: CommissionClaim, db: Session) -> dict[str, Any]:
        gross = claim.gross_fee
        house_amt = gross * MASTER_HOUSE_PCT / Decimal("100")
        field_amt = gross * MASTER_FIELD_PCT / Decimal("100")

        role = self._get_writing_agent_role_name(db, claim)
        wa_pct, rvp_pct, cp_pct = self._resolve_field_split(claim, role)

        def pct_of_gross(p_field: Decimal) -> Decimal:
            return MASTER_FIELD_PCT * p_field / Decimal("100")

        # In scenario 1 (CP solo), the writing agent recipient IS the CP; no
        # separate CP_OVERRIDE bucket is emitted. Only display the buckets
        # that actually carry money in this claim's scenario.
        role_upper = (role or "").upper()
        suppress_cp_override = role_upper == "CP"

        field_buckets = []
        for bucket, p_field, recipient in (
            ("WRITING_AGENT", wa_pct, claim.writing_agent_id),
            ("RVP_OVERRIDE", rvp_pct, claim.rvp_id),
            ("CP_OVERRIDE", cp_pct, claim.cp_id),
        ):
            if p_field <= 0:
                continue
            if bucket == "CP_OVERRIDE" and suppress_cp_override:
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
