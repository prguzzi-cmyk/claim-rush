#!/usr/bin/env python3

"""Seed the four role test users via direct SQL.

Standalone — depends only on `bcrypt` and `psycopg2-binary`. Does NOT
import from the app package, so it runs against system Python with just
those two pip packages installed.

Creates (if missing):
    cp.test@rin.aciunited.com       role=cp        manager_id=NULL
    rvp.test@rin.aciunited.com      role=rvp       manager_id=cp.test
    agent.test@rin.aciunited.com    role=agent     manager_id=rvp.test
    adjuster.test@rin.aciunited.com role=adjuster  manager_id=NULL

Reads passwords from env vars (CP_PW / RVP_PW / AGENT_PW / ADJ_PW). Any
missing env var causes that user to be SKIPPED rather than defaulted.

Usage:
    pip3 install --user bcrypt psycopg2-binary
    CP_PW=... RVP_PW=... AGENT_PW=... ADJ_PW=... \
        railway run python3 scripts/seed_role_test_users.py

Idempotent: if the user's email already exists, row is left alone.
Passwords are NOT rotated by re-run — use a separate script for that.

Bcrypt hash format ($2b$…) is compatible with the app's passlib-based
password verifier (CryptContext(schemes=['bcrypt'])).
"""

from __future__ import annotations

import os
import sys
import uuid

try:
    import bcrypt
    import psycopg2
except ImportError as e:
    sys.exit(
        f"ERROR: missing dependency — {e.name}. Install with:\n"
        "  pip3 install --user bcrypt psycopg2-binary"
    )


def _uid(seed: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"rin-portal.seed.role-test.{seed}"))


U_CP = _uid("cp")
U_RVP = _uid("rvp")
U_AGENT = _uid("agent")
U_ADJUSTER = _uid("adjuster")


SEED_DEFS = [
    # (user_id, email, first_name, last_name, role_slug, manager_id_or_None, pw_env_var)
    (U_CP,       "cp.test@rin.aciunited.com",       "CP",       "Test", "cp",       None,  "CP_PW"),
    (U_RVP,      "rvp.test@rin.aciunited.com",      "RVP",      "Test", "rvp",      U_CP,  "RVP_PW"),
    (U_AGENT,    "agent.test@rin.aciunited.com",    "Agent",    "Test", "agent",    U_RVP, "AGENT_PW"),
    (U_ADJUSTER, "adjuster.test@rin.aciunited.com", "Adjuster", "Test", "adjuster", None,  "ADJ_PW"),
]


def _database_url() -> str:
    # Railway injects DATABASE_URL when `railway run` is invoked with a
    # service linked that exposes a Postgres connection.
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        sys.exit(
            "ERROR: DATABASE_URL not set. Run via `railway run` with a "
            "service linked, e.g. `railway link` → pick upa-portal-backend "
            "or the Postgres service."
        )
    # SQLAlchemy would want 'postgresql://' but psycopg2 accepts both;
    # normalize anyway so logs look consistent.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def main() -> None:
    conn = psycopg2.connect(_database_url())
    cur = conn.cursor()

    created: list[str] = []
    skipped_existing: list[str] = []
    skipped_no_password: list[str] = []

    try:
        for uid_, email, first, last, role_slug, manager_id, pw_var in SEED_DEFS:
            # Already exists? Leave it alone.
            cur.execute('SELECT 1 FROM "user" WHERE email = %s LIMIT 1', (email,))
            if cur.fetchone():
                skipped_existing.append(email)
                continue

            # Password supplied?
            pw = os.environ.get(pw_var, "").strip()
            if not pw:
                skipped_no_password.append(f"{email} (set {pw_var}= in env)")
                continue

            # Role row exists?
            cur.execute("SELECT id FROM role WHERE name = %s LIMIT 1", (role_slug,))
            role_row = cur.fetchone()
            if not role_row:
                sys.exit(
                    f"ERROR: role {role_slug!r} missing from DB. "
                    "Did migration r0le_a1ign01 apply and role_permission_sync run?"
                )
            role_id = role_row[0]

            # Hash + INSERT.
            pw_hash = bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            cur.execute(
                '''
                INSERT INTO "user" (
                    id, first_name, last_name, email, hashed_password,
                    is_active, role_id, manager_id,
                    created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, TRUE, %s, %s, NOW(), NOW())
                ''',
                (uid_, first, last, email, pw_hash, role_id, manager_id),
            )
            created.append(email)

        conn.commit()
    except Exception as exc:
        conn.rollback()
        sys.exit(f"FAILED: {type(exc).__name__}: {exc}")
    finally:
        cur.close()
        conn.close()

    print()
    print("=== Seed results ===")
    for email in created:
        print(f"  CREATED : {email}")
    for email in skipped_existing:
        print(f"  EXISTS  : {email} (left alone)")
    for note in skipped_no_password:
        print(f"  SKIPPED : {note}")
    print()


if __name__ == "__main__":
    main()
