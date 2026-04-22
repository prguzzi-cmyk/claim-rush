"""add ADJUSTER role + backfill seed manager_id chain

Two pieces bundled together because they're both prereqs for the Add-Agent
UI flow:

1. Insert ADJUSTER into the role table. Commission/profile infra already
   references it (Compensation tab gates on user.role == 'ADJUSTER') but
   the row itself was never seeded.

2. Backfill manager_id on the seeded commission-engine users so the new
   hierarchy walker (claim_service auto-resolves rvp_id/cp_id by walking
   manager_id up from the writing agent) has a chain to walk:

       Alice Nguyen (WA-0001)   → manager = Carla Mendes (RVP-0001)
       Brian Ortiz  (WA-0002)   → manager = Carla Mendes (RVP-0001)
       Carla Mendes (RVP-0001)  → manager = Diego Park  (CP-0001)

   Diego and RIN Admin are left with NULL manager — they're top of tree.

Both inserts/updates use `ON CONFLICT DO NOTHING` / guarded UPDATE so the
migration is safe to re-run and safe on environments where the seed names
don't match (update simply no-ops).

Revision ID: c0mm155ag04
Revises: c0mm155ag03
Create Date: 2026-04-22 12:30:00.000000
"""
from alembic import op


revision = 'c0mm155ag04'
down_revision = 'c0mm155ag03'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ADJUSTER role — id is uuid5(NAMESPACE_DNS, 'rin-portal.role.adjuster')
    # so it's stable across environments.
    op.execute("""
        INSERT INTO role (id, name, display_name, can_be_removed, is_removed, created_at, updated_at)
        VALUES (
            'c9e1f8a2-4d3b-5a71-9f6c-2e8b4c1d5e90',
            'ADJUSTER',
            'Adjuster',
            TRUE,
            FALSE,
            NOW(),
            NOW()
        )
        ON CONFLICT DO NOTHING;
    """)

    # Backfill manager_id for the commission-engine seed users. The WHERE
    # clause on manager_id IS NULL means we never overwrite an existing
    # assignment (upgrade is idempotent).
    op.execute("""
        UPDATE "user" u
        SET manager_id = (
            SELECT id FROM "user"
            WHERE email = 'carla@aciadjustmentgroup.com'
            LIMIT 1
        )
        WHERE u.email IN ('alice@aciadjustmentgroup.com', 'brian@aciadjustmentgroup.com')
          AND u.manager_id IS NULL;
    """)

    op.execute("""
        UPDATE "user" u
        SET manager_id = (
            SELECT id FROM "user"
            WHERE email = 'diego@aciadjustmentgroup.com'
            LIMIT 1
        )
        WHERE u.email = 'carla@aciadjustmentgroup.com'
          AND u.manager_id IS NULL;
    """)


def downgrade() -> None:
    # Wipe the manager chain we set. Only null rows whose manager is one
    # of our seeded links (defensive — don't clobber unrelated edits).
    op.execute("""
        UPDATE "user"
        SET manager_id = NULL
        WHERE email IN (
            'alice@aciadjustmentgroup.com',
            'brian@aciadjustmentgroup.com',
            'carla@aciadjustmentgroup.com'
        );
    """)
    op.execute("DELETE FROM role WHERE name = 'ADJUSTER';")
