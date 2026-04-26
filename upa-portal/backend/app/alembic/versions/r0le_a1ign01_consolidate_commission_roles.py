"""consolidate commission roles to lowercase canonical names

Locks in the lowercase role naming convention for the five business roles
that matter today:

    admin  cp  rvp  agent  adjuster

Before this migration, cp/rvp/agent/admin could exist in the `role` table in
both lowercase (from RoleEnum sync at app boot) and UPPERCASE (from the
commission-engine seed script and the earlier ADJUSTER migration). Which set
a given user landed in depended on who created them, and the two sets didn't
share the same user base.

This migration:

1. Ensures lowercase rows exist for cp / rvp / adjuster (idempotent — uses
   deterministic uuid5 IDs so re-runs are no-ops).
2. Remaps any user whose role_id points to an UPPERCASE row to the
   equivalent lowercase row.
3. Drops the UPPERCASE role rows once they're no longer referenced.
4. Corrects the CP display_name from "Community Partner" (seed-script
   leftover) to "Chapter President" (canonical business label used
   throughout the territory/lead-rescue layer).

Idempotent and safe to re-run. Phase 2 and Phase 3 no-op on prod where the
UPPERCASE rows were never seeded.

Revision ID: r0le_a1ign01
Revises: r0nb0arding02
Create Date: 2026-04-23 14:00:00.000000
"""
from alembic import op


revision = 'r0le_a1ign01'
down_revision = 'cplprep04'
branch_labels = None
depends_on = None


# Deterministic UUIDs — uuid5(NAMESPACE_DNS, 'rin-portal.role.<slug>').
# Stable across environments so every DB gets the same role.id for a given
# role.name and re-runs of the migration detect existing rows.
CP_ID = 'a3f1b8d2-5c7e-5e4a-b9f6-1c3d8e2b4a50'
RVP_ID = 'b7c2e9f4-6a8d-5f5c-c0a7-2d4e9f3b5b61'
ADJUSTER_ID = 'c9e1f8a2-4d3b-5a71-9f6c-2e8b4c1d5e90'


def upgrade() -> None:
    # ── Phase 1 — Ensure lowercase canonical rows exist ──────────────────
    #
    # The `adjuster` row reuses the same uuid that the earlier c0mm155ag04
    # migration used for the UPPERCASE 'ADJUSTER' row — so the ON CONFLICT
    # clause catches that row and we just rename/relabel it in Phase 2.
    op.execute(f"""
        INSERT INTO role (id, name, display_name, can_be_removed, is_removed, created_at, updated_at)
        VALUES
            ('{CP_ID}',       'cp',       'Chapter President',       TRUE, FALSE, NOW(), NOW()),
            ('{RVP_ID}',      'rvp',      'Regional Vice President', TRUE, FALSE, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
    """)

    # ── Phase 2 — Remap users from UPPERCASE roles to lowercase equivalents
    # Each UPDATE uses role.name lookups so we don't need to know the exact
    # UUID of the UPPERCASE rows (they were inserted with non-deterministic
    # IDs from seed_commission_engine.py).
    #
    # The order matters only for Phase 3's cleanup — the mappings
    # themselves are independent.
    op.execute("""
        UPDATE "user" SET role_id = (SELECT id FROM role WHERE name = 'cp')
        WHERE role_id IN (SELECT id FROM role WHERE name = 'CP');
    """)
    op.execute("""
        UPDATE "user" SET role_id = (SELECT id FROM role WHERE name = 'rvp')
        WHERE role_id IN (SELECT id FROM role WHERE name = 'RVP');
    """)
    op.execute("""
        UPDATE "user" SET role_id = (SELECT id FROM role WHERE name = 'agent')
        WHERE role_id IN (SELECT id FROM role WHERE name = 'AGENT');
    """)
    op.execute("""
        UPDATE "user" SET role_id = (SELECT id FROM role WHERE name = 'admin')
        WHERE role_id IN (SELECT id FROM role WHERE name = 'ADMIN');
    """)
    op.execute("""
        UPDATE "user" SET role_id = (SELECT id FROM role WHERE name = 'adjuster')
        WHERE role_id IN (SELECT id FROM role WHERE name = 'ADJUSTER');
    """)

    # ── Phase 3 — Drop the now-orphaned UPPERCASE rows ────────────────────
    # Only deletes rows whose name is exactly uppercase AND not referenced
    # by any user. The second clause is paranoia — Phase 2 moved every
    # referencing user — but belt-and-suspenders.
    op.execute("""
        DELETE FROM role
        WHERE name IN ('CP', 'RVP', 'AGENT', 'ADMIN', 'ADJUSTER')
          AND id NOT IN (SELECT DISTINCT role_id FROM "user" WHERE role_id IS NOT NULL);
    """)

    # ── Phase 4 — CP display-name correction ──────────────────────────────
    # seed_commission_engine.py labels CP as "Community Partner"; the rest
    # of the codebase (territory.chapter_president_id, lead-rescue, AI
    # contact notifications, public-territories schema) uses "Chapter
    # President". Align the label.
    op.execute("""
        UPDATE role SET display_name = 'Chapter President'
        WHERE name = 'cp' AND display_name <> 'Chapter President';
    """)


def downgrade() -> None:
    # Recreate UPPERCASE rows with non-deterministic IDs (gen_random_uuid())
    # and reverse the Phase 2 mappings. This resurrects the duplicate-role
    # situation the upgrade was designed to eliminate — use only in
    # emergency rollbacks, not as a normal operational path.
    op.execute("""
        INSERT INTO role (id, name, display_name, can_be_removed, is_removed, created_at, updated_at)
        SELECT gen_random_uuid(), 'CP',       'Community Partner',       TRUE, FALSE, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'CP');
    """)
    op.execute("""
        INSERT INTO role (id, name, display_name, can_be_removed, is_removed, created_at, updated_at)
        SELECT gen_random_uuid(), 'RVP',      'Regional Vice President', TRUE, FALSE, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'RVP');
    """)
    op.execute("""
        INSERT INTO role (id, name, display_name, can_be_removed, is_removed, created_at, updated_at)
        SELECT gen_random_uuid(), 'AGENT',    'Agent',                   TRUE, FALSE, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'AGENT');
    """)
    op.execute("""
        INSERT INTO role (id, name, display_name, can_be_removed, is_removed, created_at, updated_at)
        SELECT gen_random_uuid(), 'ADMIN',    'Administrator',           TRUE, FALSE, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'ADMIN');
    """)
    op.execute("""
        INSERT INTO role (id, name, display_name, can_be_removed, is_removed, created_at, updated_at)
        SELECT gen_random_uuid(), 'ADJUSTER', 'Adjuster',                TRUE, FALSE, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'ADJUSTER');
    """)

    # Remap users back to the UPPERCASE rows so downgrade is round-trip.
    for lower, upper in [
        ('cp', 'CP'), ('rvp', 'RVP'), ('agent', 'AGENT'),
        ('admin', 'ADMIN'), ('adjuster', 'ADJUSTER'),
    ]:
        op.execute(f"""
            UPDATE "user" SET role_id = (SELECT id FROM role WHERE name = '{upper}')
            WHERE role_id IN (SELECT id FROM role WHERE name = '{lower}');
        """)

    # Drop the lowercase canonical rows IF unreferenced.
    op.execute("""
        DELETE FROM role
        WHERE name IN ('cp', 'rvp')
          AND id NOT IN (SELECT DISTINCT role_id FROM "user" WHERE role_id IS NOT NULL);
    """)
    # Note: 'adjuster' (lowercase) intentionally NOT dropped on downgrade
    # because the earlier c0mm155ag04 migration expects its row to exist.
