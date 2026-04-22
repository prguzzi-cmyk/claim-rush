#!/usr/bin/env python

"""Seed script for the commission engine.

Inserts roles (AGENT, RVP, CP, ADMIN), 5 users (Alice, Brian, Carla, Diego,
Admin), 8 claims, and the ledger + payout + advance rows needed to reproduce
the Angular mock data EXACTLY under the 50/50 + 60/20/20 split.

Verification target after running this script:
    Alice Nguyen / April 2026 statement and dashboard:
        Total Earned        $1,920.00
        Paid to Date        $1,600.00
        Remaining Balance     $320.00
        1099 YTD (2026)     $1,600.00

Idempotent: safe to re-run. Existing users / claims / ledger rows are
detected by deterministic UUID or natural key (claim_number). If anything
for a given key exists, the script leaves it alone and exits with a note.

Usage (once Docker + Poetry are up):
    cd upa-portal/backend/app
    DEV_BYPASS=1 poetry run python scripts/seed_commission_engine.py

Env vars consulted (same resolution as the main backend):
    DATABASE_URL        — Railway/Render-style full connection string
    POSTGRES_SERVER/USER/PASSWORD/DB — fallback individual vars
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

# Make sure the `app` package is importable when the script is run from
# `upa-portal/backend/app/` — that dir is the package root.
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_APP_ROOT = SCRIPT_DIR.parent
if str(BACKEND_APP_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_APP_ROOT))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings  # type: ignore  # noqa: E402
from app.db.base import Base  # noqa: F401  # ensure all models registered
from app.models import (  # noqa: E402
    AgentLicense,
    AgentProfile,
    CommissionAdvance,
    CommissionClaim,
    CommissionLedger,
    CommissionPayout,
    Role,
    User,
)
from app.services.agent_service import agent_service  # noqa: E402


# ─── Deterministic UUIDs (so re-runs are idempotent) ─────────────────────────

def _uid(seed: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"rin-portal.commission.{seed}")


U_AGENT_ALICE = _uid("user.alice_nguyen")
U_AGENT_BRIAN = _uid("user.brian_ortiz")
U_RVP_CARLA = _uid("user.carla_mendes")
U_CP_DIEGO = _uid("user.diego_park")
U_ADMIN = _uid("user.rin_admin")

ROLE_AGENT = _uid("role.agent")
ROLE_RVP = _uid("role.rvp")
ROLE_CP = _uid("role.cp")
ROLE_ADMIN = _uid("role.admin")

C_001 = _uid("claim.rin-2604-0001")
C_002 = _uid("claim.rin-2604-0002")
C_003 = _uid("claim.rin-2604-0003")
C_004 = _uid("claim.rin-2604-0004")
C_005 = _uid("claim.rin-2604-0005")
C_006 = _uid("claim.rin-2604-0006")
C_007 = _uid("claim.rin-2604-0007")
C_008 = _uid("claim.rin-2604-0008")


# ─── Data definitions (mirrors Angular commission-engine-mock.service.ts) ────

ROLES = [
    (ROLE_AGENT, "AGENT", "Agent"),
    (ROLE_RVP, "RVP", "Regional Vice President"),
    (ROLE_CP, "CP", "Community Partner"),
    (ROLE_ADMIN, "ADMIN", "Administrator"),
]

USERS = [
    (U_AGENT_ALICE, "Alice", "Nguyen", "alice@aciadjustmentgroup.com", ROLE_AGENT),
    (U_AGENT_BRIAN, "Brian", "Ortiz", "brian@aciadjustmentgroup.com", ROLE_AGENT),
    (U_RVP_CARLA, "Carla", "Mendes", "carla@aciadjustmentgroup.com", ROLE_RVP),
    (U_CP_DIEGO, "Diego", "Park", "diego@aciadjustmentgroup.com", ROLE_CP),
    (U_ADMIN, "RIN", "Admin", "admin@aciadjustmentgroup.com", ROLE_ADMIN),
]

# (id, claim_number, client_name, stage, gross_fee, writing_agent, rvp, cp, direct_cp)
CLAIMS = [
    (C_001, "RIN-2604-0001", "Harper Residence", "ESTIMATE_SUBMITTED", "12000", U_AGENT_ALICE, U_RVP_CARLA, U_CP_DIEGO, False),
    (C_002, "RIN-2604-0002", "Delacruz Property", "CARRIER_REVIEW", "8600", U_AGENT_ALICE, U_RVP_CARLA, U_CP_DIEGO, False),
    (C_003, "RIN-2604-0003", "Kincaid Estates", "NEGOTIATION", "24500", U_AGENT_ALICE, U_RVP_CARLA, U_CP_DIEGO, False),
    # c_004 is the settled claim that produces Alice's $1,920 earned.
    (C_004, "RIN-2604-0004", "Rosario Duplex", "PAID", "6400", U_AGENT_ALICE, U_RVP_CARLA, U_CP_DIEGO, False),
    (C_005, "RIN-2604-0005", "Whitfield Complex", "INSPECTION_COMPLETED", "15200", U_AGENT_BRIAN, U_RVP_CARLA, U_CP_DIEGO, False),
    (C_006, "RIN-2604-0006", "Emerald Ranch", "LITIGATION", "42000", U_AGENT_BRIAN, U_RVP_CARLA, U_CP_DIEGO, False),
    # c_007: Carla (RVP) is herself the writing agent → direct_cp path (no RVP override), CP is Diego.
    (C_007, "RIN-2604-0007", "Beltran Grove", "SETTLEMENT_REACHED", "18000", U_RVP_CARLA, None, U_CP_DIEGO, True),
    # c_008: Diego (CP) self-writes. Use direct_cp=True with cp_id=Diego so both WA and CP portions
    # route to him, giving him 100% of field (80% WA + 20% CP = 100%).
    (C_008, "RIN-2604-0008", "Northgate Tower", "SUPPLEMENT_SUBMITTED", "31000", U_CP_DIEGO, None, U_CP_DIEGO, True),
]


# Ledger rows for c_004 settlement (emits on 2026-02-10 at 10:00 UTC).
# gross=$6400 × master 50/50 × field 60/20/20:
#   House            $3,200.00
#   Writing Agent    $1,920.00 (Alice)
#   RVP Override       $640.00 (Carla)
#   CP Override        $640.00 (Diego)
#   ── total ──────  $6,400.00 ✓ reconciles with gross
EARNED_ROWS_C004 = [
    (None, C_004, "HOUSE", "COMMISSION_EARNED", "3200.00", datetime(2026, 2, 10, 10, 0, tzinfo=timezone.utc), "Commission earned — HOUSE — RIN-2604-0004"),
    (U_AGENT_ALICE, C_004, "WRITING_AGENT", "COMMISSION_EARNED", "1920.00", datetime(2026, 2, 10, 10, 0, tzinfo=timezone.utc), "Commission earned — WRITING_AGENT — RIN-2604-0004"),
    (U_RVP_CARLA, C_004, "RVP_OVERRIDE", "COMMISSION_EARNED", "640.00", datetime(2026, 2, 10, 10, 0, tzinfo=timezone.utc), "Commission earned — RVP_OVERRIDE — RIN-2604-0004"),
    (U_CP_DIEGO, C_004, "CP_OVERRIDE", "COMMISSION_EARNED", "640.00", datetime(2026, 2, 10, 10, 0, tzinfo=timezone.utc), "Commission earned — CP_OVERRIDE — RIN-2604-0004"),
]

# Alice's advances, interest, offset, payout, adjustment rows (match mock t_a1..t_adj1)
ALICE_ADVANCE_ROWS = [
    (U_AGENT_ALICE, C_001, "WRITING_AGENT", "ADVANCE_ISSUED", "1500.00", datetime(2026, 3, 15, 12, 0, tzinfo=timezone.utc), "Advance support: field expenses"),
    (U_AGENT_ALICE, C_003, "WRITING_AGENT", "ADVANCE_ISSUED", "2200.00", datetime(2026, 2, 20, 12, 0, tzinfo=timezone.utc), "Advance support: travel"),
    (U_AGENT_ALICE, C_001, "WRITING_AGENT", "INTEREST_APPLIED", "38.50", datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc), "Carrying cost: March"),
    (U_AGENT_ALICE, C_003, "WRITING_AGENT", "INTEREST_APPLIED", "52.10", datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc), "Carrying cost: March"),
    (U_AGENT_ALICE, C_004, "WRITING_AGENT", "REPAYMENT_OFFSET", "-800.00", datetime(2026, 2, 10, 10, 30, tzinfo=timezone.utc), "Offset against c_004 payout"),
    (U_AGENT_ALICE, C_004, "WRITING_AGENT", "PAYOUT_ISSUED", "-1600.00", datetime(2026, 2, 15, 14, 0, tzinfo=timezone.utc), "Payout disbursed (partial) — c_004"),
    (U_AGENT_ALICE, C_001, "WRITING_AGENT", "ADJUSTMENT", "-100.00", datetime(2026, 4, 5, 18, 0, tzinfo=timezone.utc), "Correction: duplicate advance reversed"),
]

BRIAN_ADVANCE_ROWS = [
    (U_AGENT_BRIAN, C_005, "WRITING_AGENT", "ADVANCE_ISSUED", "1800.00", datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc), "Advance support: inspection travel"),
    (U_AGENT_BRIAN, C_006, "WRITING_AGENT", "ADVANCE_ISSUED", "3500.00", datetime(2025, 11, 15, 12, 0, tzinfo=timezone.utc), "Advance support: litigation filing"),
    (U_AGENT_BRIAN, C_006, "WRITING_AGENT", "INTEREST_APPLIED", "210.75", datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc), "Carrying cost: accrued"),
]

CARLA_ADVANCE_ROWS = [
    (U_RVP_CARLA, C_007, "WRITING_AGENT", "ADVANCE_ISSUED", "2400.00", datetime(2026, 4, 2, 12, 0, tzinfo=timezone.utc), "Advance support"),
    (U_RVP_CARLA, C_007, "WRITING_AGENT", "INTEREST_APPLIED", "18.00", datetime(2026, 4, 15, 0, 0, tzinfo=timezone.utc), "Carrying cost"),
]

DIEGO_ADVANCE_ROWS = [
    (U_CP_DIEGO, C_008, "WRITING_AGENT", "ADVANCE_ISSUED", "4000.00", datetime(2026, 3, 5, 12, 0, tzinfo=timezone.utc), "Advance support: supplement prep"),
    (U_CP_DIEGO, C_008, "WRITING_AGENT", "INTEREST_APPLIED", "64.00", datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc), "Carrying cost: March"),
]


# ─── Seeding logic ───────────────────────────────────────────────────────────


def _get_database_url() -> str:
    # Re-use the same resolution order as app/core/config.py
    url = os.getenv("DATABASE_URL", "")
    if url:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url
    # Build from POSTGRES_* vars (same defaults as config.py)
    server = os.getenv("POSTGRES_SERVER", "localhost")
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "")
    db = os.getenv("POSTGRES_DB", "app")
    auth = f"{user}:{password}" if password else user
    return f"postgresql+psycopg2://{auth}@{server}/{db}"


def seed_roles(db: Session) -> None:
    print("→ ensuring roles exist…")
    for role_id, name, display_name in ROLES:
        existing = db.get(Role, role_id)
        if existing:
            print(f"  - {name} already present")
            continue
        # Role model attributes may vary; set what's commonly required.
        role = Role(id=role_id)
        role.name = name
        # Some Role models use display_name; some don't. Guard attribute-level.
        if hasattr(Role, "display_name"):
            role.display_name = display_name
        if hasattr(Role, "can_be_removed"):
            role.can_be_removed = False
        db.add(role)
        print(f"  + {name} ({role_id})")
    db.commit()


def seed_users(db: Session) -> None:
    print("→ ensuring users exist…")
    for user_id, first, last, email, role_id in USERS:
        existing = db.get(User, user_id)
        if existing:
            print(f"  - {first} {last} already present")
            continue
        u = User(
            id=user_id,
            first_name=first,
            last_name=last,
            email=email,
            hashed_password="!dev-seed-no-login!",  # seeds cannot log in directly
            is_active=True,
            role_id=role_id,
        )
        db.add(u)
        print(f"  + {first} {last} [{user_id}]")
    db.commit()


def seed_claims(db: Session) -> None:
    print("→ ensuring commission_claim rows…")
    for cid, num, client, stage, gross, wa, rvp, cp, direct in CLAIMS:
        existing = db.get(CommissionClaim, cid)
        if existing:
            print(f"  - {num} already present")
            continue
        c = CommissionClaim(
            id=cid,
            claim_number=num,
            client_name=client,
            stage=stage,
            gross_fee=Decimal(gross),
            writing_agent_id=wa,
            rvp_id=rvp,
            cp_id=cp,
            direct_cp=direct,
        )
        db.add(c)
        print(f"  + {num} ({client}) — gross ${gross}")
    db.commit()


def _seed_ledger_rows(db: Session, rows: list[tuple]) -> None:
    for user_id, claim_id, bucket, txn_type, amount, ts, notes in rows:
        # Idempotency via (user_id, claim_id, txn_type, ts, amount) composite check.
        existing = db.execute(
            select(CommissionLedger).where(
                CommissionLedger.user_id == user_id,
                CommissionLedger.claim_id == claim_id,
                CommissionLedger.txn_type == txn_type,
                CommissionLedger.ts == ts,
                CommissionLedger.amount == Decimal(amount),
                CommissionLedger.bucket == bucket,
            )
        ).first()
        if existing:
            continue
        db.add(CommissionLedger(
            user_id=user_id,
            claim_id=claim_id,
            bucket=bucket,
            txn_type=txn_type,
            amount=Decimal(amount),
            ts=ts,
            notes=notes,
        ))


def seed_ledger(db: Session) -> None:
    print("→ ensuring commission_ledger rows…")
    _seed_ledger_rows(db, EARNED_ROWS_C004)
    _seed_ledger_rows(db, ALICE_ADVANCE_ROWS)
    _seed_ledger_rows(db, BRIAN_ADVANCE_ROWS)
    _seed_ledger_rows(db, CARLA_ADVANCE_ROWS)
    _seed_ledger_rows(db, DIEGO_ADVANCE_ROWS)
    db.commit()
    count = db.execute(select(CommissionLedger)).scalars().all()
    print(f"  ledger row count after seed: {len(count)}")


def seed_payouts_and_advances(db: Session) -> None:
    """Also populate the aggregate tables (commission_payout / commission_advance)
    so API writes through service methods remain consistent. These are
    derived from the ledger rows we just inserted.
    """
    print("→ ensuring commission_payout rows…")
    # Alice's partial payout for c_004
    alice_payout_key = (U_AGENT_ALICE, Decimal("1600.00"), datetime(2026, 2, 15, 14, 0, tzinfo=timezone.utc))
    existing = db.execute(
        select(CommissionPayout).where(
            CommissionPayout.user_id == alice_payout_key[0],
            CommissionPayout.amount == alice_payout_key[1],
            CommissionPayout.issued_at == alice_payout_key[2],
        )
    ).first()
    if not existing:
        db.add(CommissionPayout(
            user_id=U_AGENT_ALICE,
            amount=Decimal("1600.00"),
            issued_at=datetime(2026, 2, 15, 14, 0, tzinfo=timezone.utc),
            method="ACH",
            reference="PAY-2026-02-15-ALICE-c004",
            claim_id=C_004,
        ))
    db.commit()

    print("→ ensuring commission_advance rows…")
    advance_defs = [
        (U_AGENT_ALICE, C_001, "1500.00", datetime(2026, 3, 15, 12, 0, tzinfo=timezone.utc), "Advance support: field expenses"),
        (U_AGENT_ALICE, C_003, "2200.00", datetime(2026, 2, 20, 12, 0, tzinfo=timezone.utc), "Advance support: travel"),
        (U_AGENT_BRIAN, C_005, "1800.00", datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc), "Advance support: inspection travel"),
        (U_AGENT_BRIAN, C_006, "3500.00", datetime(2025, 11, 15, 12, 0, tzinfo=timezone.utc), "Advance support: litigation filing"),
        (U_RVP_CARLA, C_007, "2400.00", datetime(2026, 4, 2, 12, 0, tzinfo=timezone.utc), "Advance support"),
        (U_CP_DIEGO, C_008, "4000.00", datetime(2026, 3, 5, 12, 0, tzinfo=timezone.utc), "Advance support: supplement prep"),
    ]
    for uid_, cid, amt, ts, note in advance_defs:
        existing = db.execute(
            select(CommissionAdvance).where(
                CommissionAdvance.user_id == uid_,
                CommissionAdvance.claim_id == cid,
                CommissionAdvance.amount == Decimal(amt),
                CommissionAdvance.issued_at == ts,
            )
        ).first()
        if existing:
            continue
        db.add(CommissionAdvance(
            user_id=uid_,
            claim_id=cid,
            amount=Decimal(amt),
            issued_at=ts,
            notes=note,
        ))
    db.commit()


def seed_agent_profiles(db: Session) -> None:
    """Create agent_profile rows for the 5 seeded users.

    agent_number is auto-generated via the service layer (per-prefix sequences):
      Alice Nguyen  (AGENT) → WA-0001
      Brian Ortiz   (AGENT) → WA-0002
      Carla Mendes  (RVP)   → RVP-0001
      Diego Park    (CP)    → CP-0001
      RIN Admin     (ADMIN) → ADM-0001

    Idempotent: skips a user if an agent_profile already exists.
    """
    print("→ ensuring agent_profile rows…")

    # Seed in a deterministic order so agent numbers are stable across re-runs.
    users_in_order = [
        (U_AGENT_ALICE, "Alice Nguyen", {
            "tax_classification": "1099",
            "employment_start_date": date(2025, 6, 1),
            "background_check_status": "PASSED",
            "background_check_completed_at": date(2025, 5, 20),
            "emergency_contact_name": "Jordan Nguyen",
            "emergency_contact_phone": "555-0101",
        }),
        (U_AGENT_BRIAN, "Brian Ortiz", {
            "tax_classification": "1099",
            "employment_start_date": date(2025, 8, 15),
            "background_check_status": "PASSED",
            "background_check_completed_at": date(2025, 8, 1),
        }),
        (U_RVP_CARLA, "Carla Mendes", {
            "tax_classification": "W2",
            "employment_start_date": date(2024, 3, 10),
            "background_check_status": "PASSED",
            "background_check_completed_at": date(2024, 3, 1),
        }),
        (U_CP_DIEGO, "Diego Park", {
            "tax_classification": "1099",
            "employment_start_date": date(2025, 1, 20),
            "background_check_status": "PASSED",
            "background_check_completed_at": date(2025, 1, 10),
        }),
        (U_ADMIN, "RIN Admin", {
            "tax_classification": "W2",
            "employment_start_date": date(2024, 1, 1),
            "background_check_status": "EXEMPT",
        }),
    ]

    for user_id, display_name, fields in users_in_order:
        existing = db.execute(
            select(AgentProfile).where(AgentProfile.user_id == user_id)
        ).scalar_one_or_none()
        if existing:
            print(f"  - {display_name} [{existing.agent_number}] already has profile")
            continue
        profile = agent_service.create_profile(db, user_id=user_id, **fields)
        print(f"  + {display_name} [{profile.agent_number}]")


def seed_agent_licenses(db: Session) -> None:
    """Seed one example Public Adjuster license per seeded AGENT user.

    Alice → Pennsylvania  (ACI HQ state)
    Brian → Texas         (mock-data canonical territory)

    Idempotent: the composite UNIQUE on agent_license prevents dupes on re-run.
    """
    print("→ ensuring agent_license rows…")

    licenses = [
        {
            "user_id": U_AGENT_ALICE,
            "state": "PA",
            "license_type": "PUBLIC_ADJUSTER",
            "license_number": "PA-2026-0001",
            "issued_on": date(2025, 6, 1),
            "expires_on": date(2027, 5, 31),
            "verified_at": datetime(2025, 6, 5, 12, 0, tzinfo=timezone.utc),
            "verified_by_id": U_ADMIN,
            "status": "ACTIVE",
            "notes": "Initial PA license — verified via PADOI online portal",
        },
        {
            "user_id": U_AGENT_BRIAN,
            "state": "TX",
            "license_type": "PUBLIC_ADJUSTER",
            "license_number": "PA-2026-0002",
            "issued_on": date(2025, 8, 15),
            "expires_on": date(2027, 8, 14),
            "verified_at": datetime(2025, 8, 20, 14, 0, tzinfo=timezone.utc),
            "verified_by_id": U_ADMIN,
            "status": "ACTIVE",
            "notes": "Initial TX license — verified via TDI agent lookup",
        },
    ]

    for lic in licenses:
        existing = db.execute(
            select(AgentLicense).where(
                AgentLicense.user_id == lic["user_id"],
                AgentLicense.state == lic["state"],
                AgentLicense.license_type == lic["license_type"],
                AgentLicense.license_number == lic["license_number"],
            )
        ).scalar_one_or_none()
        if existing:
            print(f"  - {lic['state']} {lic['license_number']} already present")
            continue
        db.add(AgentLicense(**lic))
        print(f"  + {lic['state']} {lic['license_number']} (user {lic['user_id']})")
    db.commit()


def verify(db: Session) -> None:
    print()
    print("→ verification (Alice / 2026):")
    from app.services.commission_service import commission_service
    earnings = commission_service.get_agent_simple_earnings(db, U_AGENT_ALICE)
    y1099 = commission_service.get_taxable_1099_ytd(db, U_AGENT_ALICE, year=2026)
    print(f"  Total Earned:      ${earnings['total_earned']:,.2f}   (expected $1,920.00)")
    print(f"  Paid to Date:      ${earnings['paid_to_date']:,.2f}   (expected $1,600.00)")
    print(f"  Remaining Balance: ${earnings['remaining_balance']:,.2f}   (expected   $320.00)")
    print(f"  1099 YTD (2026):   ${y1099['ytd_total']:,.2f}   (expected $1,600.00)")
    ok = (
        earnings["total_earned"] == 1920.0
        and earnings["paid_to_date"] == 1600.0
        and earnings["remaining_balance"] == 320.0
        and y1099["ytd_total"] == 1600.0
    )
    print()
    print("  ✅ RECONCILED" if ok else "  ❌ MISMATCH — data does not match mock")

    # Agent-profile verification
    print()
    print("→ verification (agent profiles + licenses):")
    profiles = db.execute(
        select(AgentProfile).order_by(AgentProfile.agent_number)
    ).scalars().all()
    print(f"  agent_profile rows: {len(profiles)}  (expected 5)")
    for p in profiles:
        user = db.get(User, p.user_id)
        name = f"{user.first_name} {user.last_name}" if user else "?"
        print(f"    {p.agent_number:<10}  {name}")
    licenses = db.execute(select(AgentLicense)).scalars().all()
    print(f"  agent_license rows: {len(licenses)}  (expected 2)")
    for lic in licenses:
        user = db.get(User, lic.user_id)
        name = f"{user.first_name} {user.last_name}" if user else "?"
        print(f"    {lic.state} {lic.license_number:<16}  {name}  [{lic.status}]")


def main() -> None:
    url = _get_database_url()
    print(f"Connecting to: {url.replace(os.getenv('POSTGRES_PASSWORD', ''), '***') if os.getenv('POSTGRES_PASSWORD') else url}")
    engine = create_engine(url, future=True)
    with Session(engine) as db:
        seed_roles(db)
        seed_users(db)
        seed_claims(db)
        seed_ledger(db)
        seed_payouts_and_advances(db)
        seed_agent_profiles(db)
        seed_agent_licenses(db)
        verify(db)
    print()
    print("Seed complete.")


if __name__ == "__main__":
    main()
