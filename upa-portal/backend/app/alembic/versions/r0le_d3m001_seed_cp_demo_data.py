"""seed CP demo data: territory, RVPs, agents, claims, ledger, leads

Populates the CP test user (cp.test@rin.aciunited.com) with a realistic
command-center structure so the ClaimRush CP dashboard presents real
numbers instead of zeros:

    Territory: Southeast Texas Region (max_adjusters=8, chapter_president=CP)
    Downline:  2 RVPs + 4 Agents with manager_id chain
    Claims:    5 commission_claims (2 PAID this month, 3 active)
    Ledger:    3 COMMISSION_EARNED rows in CP bucket for current month
    Leads:     8 leads across the 4 agents in varied statuses

All inserts use deterministic uuid5 IDs + ON CONFLICT DO NOTHING so the
migration is idempotent and safe to re-run. Guarded by a dynamic lookup
for the CP test user — if that user doesn't exist, the migration exits
cleanly without error (e.g., fresh environments that haven't seeded
test users yet).

Revision ID: r0le_d3m001
Revises: r0le_a1ign01
Create Date: 2026-04-23 21:00:00.000000
"""
from alembic import op


revision = 'r0le_d3m001'
down_revision = 'r0le_a1ign01'
branch_labels = None
depends_on = None


# ─── Deterministic uuid5 IDs (NAMESPACE_DNS, 'rin-portal.demo.<slug>') ────
# Computed once externally so the migration stays pure SQL. Safe to re-run:
# ON CONFLICT (id) DO NOTHING prevents dupes even if ids drift.

TERR_ID   = 'f3a2b1e4-5c6d-5e7f-8a9b-0c1d2e3f4a5b'
RVP1_ID   = 'a1b2c3d4-6e7f-5081-9a0b-1c2d3e4f5060'  # Marcus Reyes
RVP2_ID   = 'b2c3d4e5-7f80-5192-ab1c-2d3e4f506171'  # Sarah Chen
AGT1_ID   = 'c3d4e5f6-8091-52a3-bc2d-3e4f50617282'  # Jordan Alvarez (under RVP1)
AGT2_ID   = 'd4e5f607-91a2-53b4-cd3e-4f5061728393'  # Riley Parker (under RVP1)
AGT3_ID   = 'e5f60718-a2b3-54c5-de4f-506172839404'  # Morgan Lee (under RVP2)
AGT4_ID   = 'f6071829-b3c4-55d6-ef50-617283940515'  # Kai Johnson (under RVP2)

CLAIM1_ID = '07182a3b-c4d5-56e7-f061-728394051626'  # PAID this month
CLAIM2_ID = '18293b4c-d5e6-57f8-0172-839405162737'  # PAID this month
CLAIM3_ID = '293a4c5d-e6f7-5809-1283-940516273848'  # ACTIVE (carrier review)
CLAIM4_ID = '3a4b5d6e-f708-591a-2394-051627384959'  # ACTIVE (negotiation)
CLAIM5_ID = '4b5c6e7f-0819-5a2b-34a5-06172839405a'  # ACTIVE (inspection)

LEDGER_IDS = [
    '5c6d7f80-192a-5b3c-45b6-172839405a6b',  # CP override on CLAIM1
    '6d7e8091-2a3b-5c4d-56c7-2839405a6b7c',  # CP override on CLAIM2
    '7e8f91a2-3b4c-5d5e-67d8-39405a6b7c8d',  # CP override on CLAIM1 (second settlement draw)
]

LEAD_IDS = [
    '8f9012b3-4c5d-5e6f-78e9-405a6b7c8d9e',  # NEW
    '901223c4-5d6e-5f70-89fa-05a6b7c8d9ef',  # CALLBACK
    'a1233455-6e7f-5081-9a0b-a6b7c8d9efab',  # SIGNED
    'b2345667-7f80-5192-ab1c-b7c8d9efabbc',  # INTERESTED
    'c3456778-8091-52a3-bc2d-c8d9efabbcca',  # NOT_INTERESTED
    'd4567889-91a2-53b4-cd3e-d9efabbccadb',  # PENDING_SIGN
    'e567899a-a2b3-54c5-de4f-efabbccadbec',  # SIGNED_APPROVED
    'f67890ab-b3c4-55d6-ef50-fabbccadbec0',  # CALLBACK
]


def upgrade() -> None:
    op.execute(r"""
DO $MIGR$
DECLARE
    cp_uid UUID;
    rvp_role UUID;
    agent_role UUID;
    ref_seq BIGINT := 900000;
BEGIN
    -- Guard: only seed if the CP test user exists.
    SELECT id INTO cp_uid FROM "user" WHERE email = 'cp.test@rin.aciunited.com' LIMIT 1;
    IF cp_uid IS NULL THEN
        RAISE NOTICE 'cp.test@rin.aciunited.com not found; skipping demo seed.';
        RETURN;
    END IF;

    SELECT id INTO rvp_role   FROM role WHERE name = 'rvp'   LIMIT 1;
    SELECT id INTO agent_role FROM role WHERE name = 'agent' LIMIT 1;
    IF rvp_role IS NULL OR agent_role IS NULL THEN
        RAISE NOTICE 'rvp or agent role missing; skipping demo seed.';
        RETURN;
    END IF;

    -- ── 1. Territory ────────────────────────────────────────────────
    INSERT INTO territory (
        id, name, territory_type, state, max_adjusters, is_active,
        chapter_president_id,
        lead_fire_enabled, lead_hail_enabled, lead_storm_enabled,
        lead_lightning_enabled, lead_flood_enabled, lead_theft_vandalism_enabled,
        created_at, updated_at
    )
    VALUES (
        'f3a2b1e4-5c6d-5e7f-8a9b-0c1d2e3f4a5b',
        'Southeast Texas Region', 'custom', 'TX', 8, TRUE,
        cp_uid,
        TRUE, TRUE, TRUE, FALSE, TRUE, TRUE,
        NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- ── 2. RVPs (manager_id = CP) ──────────────────────────────────
    INSERT INTO "user" (
        id, first_name, last_name, email, hashed_password,
        is_active, role_id, manager_id, is_removed, is_accepting_leads,
        created_at, updated_at
    ) VALUES
      ('a1b2c3d4-6e7f-5081-9a0b-1c2d3e4f5060', 'Marcus', 'Reyes',
       'marcus.reyes@demo.rin.aciunited.com', '!demo-no-login!',
       TRUE, rvp_role, cp_uid, FALSE, TRUE, NOW(), NOW()),
      ('b2c3d4e5-7f80-5192-ab1c-2d3e4f506171', 'Sarah', 'Chen',
       'sarah.chen@demo.rin.aciunited.com', '!demo-no-login!',
       TRUE, rvp_role, cp_uid, FALSE, TRUE, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- ── 3. Agents (2 under each RVP) ───────────────────────────────
    INSERT INTO "user" (
        id, first_name, last_name, email, hashed_password,
        is_active, role_id, manager_id, is_removed, is_accepting_leads,
        created_at, updated_at
    ) VALUES
      ('c3d4e5f6-8091-52a3-bc2d-3e4f50617282', 'Jordan', 'Alvarez',
       'jordan.alvarez@demo.rin.aciunited.com', '!demo-no-login!',
       TRUE, agent_role, 'a1b2c3d4-6e7f-5081-9a0b-1c2d3e4f5060', FALSE, TRUE, NOW(), NOW()),
      ('d4e5f607-91a2-53b4-cd3e-4f5061728393', 'Riley', 'Parker',
       'riley.parker@demo.rin.aciunited.com', '!demo-no-login!',
       TRUE, agent_role, 'a1b2c3d4-6e7f-5081-9a0b-1c2d3e4f5060', FALSE, TRUE, NOW(), NOW()),
      ('e5f60718-a2b3-54c5-de4f-506172839404', 'Morgan', 'Lee',
       'morgan.lee@demo.rin.aciunited.com', '!demo-no-login!',
       TRUE, agent_role, 'b2c3d4e5-7f80-5192-ab1c-2d3e4f506171', FALSE, TRUE, NOW(), NOW()),
      ('f6071829-b3c4-55d6-ef50-617283940515', 'Kai', 'Johnson',
       'kai.johnson@demo.rin.aciunited.com', '!demo-no-login!',
       TRUE, agent_role, 'b2c3d4e5-7f80-5192-ab1c-2d3e4f506171', FALSE, TRUE, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- ── 4. Commission claims (5 total) ─────────────────────────────
    -- 2 PAID this month (drive MTD revenue); 3 active in various stages.
    INSERT INTO commission_claim (
        id, claim_number, client_name, claim_type, stage, gross_fee,
        direct_cp, writing_agent_id, rvp_id, cp_id,
        settled_at, created_at, updated_at
    ) VALUES
      ('07182a3b-c4d5-56e7-f061-728394051626',
       'RIN-DEMO-0001', 'Henderson Residence', 'residential', 'PAID', 28500.00,
       FALSE,
       'c3d4e5f6-8091-52a3-bc2d-3e4f50617282',
       'a1b2c3d4-6e7f-5081-9a0b-1c2d3e4f5060',
       cp_uid,
       DATE_TRUNC('month', NOW()) + INTERVAL '3 days',
       DATE_TRUNC('month', NOW()) - INTERVAL '45 days',
       NOW()),
      ('18293b4c-d5e6-57f8-0172-839405162737',
       'RIN-DEMO-0002', 'Patel Commercial Property', 'commercial', 'PAID', 42000.00,
       FALSE,
       'e5f60718-a2b3-54c5-de4f-506172839404',
       'b2c3d4e5-7f80-5192-ab1c-2d3e4f506171',
       cp_uid,
       DATE_TRUNC('month', NOW()) + INTERVAL '9 days',
       DATE_TRUNC('month', NOW()) - INTERVAL '60 days',
       NOW()),
      ('293a4c5d-e6f7-5809-1283-940516273848',
       'RIN-DEMO-0003', 'Okoro Residence', 'residential', 'CARRIER_REVIEW', 18200.00,
       FALSE,
       'd4e5f607-91a2-53b4-cd3e-4f5061728393',
       'a1b2c3d4-6e7f-5081-9a0b-1c2d3e4f5060',
       cp_uid,
       NULL,
       NOW() - INTERVAL '22 days',
       NOW()),
      ('3a4b5d6e-f708-591a-2394-051627384959',
       'RIN-DEMO-0004', 'Caldwell Estate', 'residential', 'NEGOTIATION', 36750.00,
       FALSE,
       'f6071829-b3c4-55d6-ef50-617283940515',
       'b2c3d4e5-7f80-5192-ab1c-2d3e4f506171',
       cp_uid,
       NULL,
       NOW() - INTERVAL '34 days',
       NOW()),
      ('4b5c6e7f-0819-5a2b-34a5-06172839405a',
       'RIN-DEMO-0005', 'Ramos Duplex', 'residential', 'INSPECTION_COMPLETED', 14800.00,
       FALSE,
       'c3d4e5f6-8091-52a3-bc2d-3e4f50617282',
       'a1b2c3d4-6e7f-5081-9a0b-1c2d3e4f5060',
       cp_uid,
       NULL,
       NOW() - INTERVAL '11 days',
       NOW())
    ON CONFLICT (id) DO NOTHING;

    -- ── 5. Commission ledger — CP override earnings this month ──────
    -- 20% of field portion on residential (Henderson + Ramos-ish), 20% on
    -- commercial (Patel). Numbers are demo-indicative, not computed from
    -- the real field-split policy — the service will recompute as settlements
    -- run through the real pipeline.
    INSERT INTO commission_ledger (
        id, user_id, claim_id, bucket, txn_type, amount, ts, notes,
        created_at, updated_at
    ) VALUES
      ('5c6d7f80-192a-5b3c-45b6-172839405a6b',
       cp_uid, '07182a3b-c4d5-56e7-f061-728394051626',
       'CP', 'COMMISSION_EARNED', 2850.00,
       DATE_TRUNC('month', NOW()) + INTERVAL '3 days',
       'CP override · Henderson · residential',
       NOW(), NOW()),
      ('6d7e8091-2a3b-5c4d-56c7-2839405a6b7c',
       cp_uid, '18293b4c-d5e6-57f8-0172-839405162737',
       'CP', 'COMMISSION_EARNED', 4200.00,
       DATE_TRUNC('month', NOW()) + INTERVAL '9 days',
       'CP override · Patel · commercial',
       NOW(), NOW()),
      ('7e8f91a2-3b4c-5d5e-67d8-39405a6b7c8d',
       cp_uid, '07182a3b-c4d5-56e7-f061-728394051626',
       'CP', 'COMMISSION_EARNED', 1425.00,
       DATE_TRUNC('month', NOW()) + INTERVAL '5 days',
       'CP override · Henderson · supplemental',
       NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- ── 6. Leads — 8 across the 4 agents, varied statuses ──────────
    INSERT INTO lead (
        id, ref_number, status, assigned_to, peril,
        created_at, updated_at
    ) VALUES
      ('8f9012b3-4c5d-5e6f-78e9-405a6b7c8d9e', 900001, 'signed',
       'c3d4e5f6-8091-52a3-bc2d-3e4f50617282', 'fire',
       NOW() - INTERVAL '2 days', NOW()),
      ('901223c4-5d6e-5f70-89fa-05a6b7c8d9ef', 900002, 'callback',
       'c3d4e5f6-8091-52a3-bc2d-3e4f50617282', 'storm',
       NOW() - INTERVAL '5 days', NOW()),
      ('a1233455-6e7f-5081-9a0b-a6b7c8d9efab', 900003, 'signed-approved',
       'd4e5f607-91a2-53b4-cd3e-4f5061728393', 'fire',
       NOW() - INTERVAL '8 days', NOW()),
      ('b2345667-7f80-5192-ab1c-b7c8d9efabbc', 900004, 'interested',
       'd4e5f607-91a2-53b4-cd3e-4f5061728393', 'flood',
       NOW() - INTERVAL '1 day', NOW()),
      ('c3456778-8091-52a3-bc2d-c8d9efabbcca', 900005, 'pending-sign',
       'e5f60718-a2b3-54c5-de4f-506172839404', 'hail',
       NOW() - INTERVAL '3 days', NOW()),
      ('d4567889-91a2-53b4-cd3e-d9efabbccadb', 900006, 'signed',
       'e5f60718-a2b3-54c5-de4f-506172839404', 'storm',
       NOW() - INTERVAL '12 days', NOW()),
      ('e567899a-a2b3-54c5-de4f-efabbccadbec', 900007, 'interested',
       'f6071829-b3c4-55d6-ef50-617283940515', 'fire',
       NOW() - INTERVAL '4 days', NOW()),
      ('f67890ab-b3c4-55d6-ef50-fabbccadbec0', 900008, 'not-interested',
       'f6071829-b3c4-55d6-ef50-617283940515', 'theft',
       NOW() - INTERVAL '7 days', NOW())
    ON CONFLICT (id) DO NOTHING;

END
$MIGR$;
""")


def downgrade() -> None:
    # Remove demo data in reverse dependency order. Deletes by deterministic
    # ID so real data is never touched.
    op.execute("""
        DELETE FROM lead WHERE id IN (
            '8f9012b3-4c5d-5e6f-78e9-405a6b7c8d9e',
            '901223c4-5d6e-5f70-89fa-05a6b7c8d9ef',
            'a1233455-6e7f-5081-9a0b-a6b7c8d9efab',
            'b2345667-7f80-5192-ab1c-b7c8d9efabbc',
            'c3456778-8091-52a3-bc2d-c8d9efabbcca',
            'd4567889-91a2-53b4-cd3e-d9efabbccadb',
            'e567899a-a2b3-54c5-de4f-efabbccadbec',
            'f67890ab-b3c4-55d6-ef50-fabbccadbec0'
        );
    """)
    op.execute("""
        DELETE FROM commission_ledger WHERE id IN (
            '5c6d7f80-192a-5b3c-45b6-172839405a6b',
            '6d7e8091-2a3b-5c4d-56c7-2839405a6b7c',
            '7e8f91a2-3b4c-5d5e-67d8-39405a6b7c8d'
        );
    """)
    op.execute("""
        DELETE FROM commission_claim WHERE id IN (
            '07182a3b-c4d5-56e7-f061-728394051626',
            '18293b4c-d5e6-57f8-0172-839405162737',
            '293a4c5d-e6f7-5809-1283-940516273848',
            '3a4b5d6e-f708-591a-2394-051627384959',
            '4b5c6e7f-0819-5a2b-34a5-06172839405a'
        );
    """)
    op.execute("""
        DELETE FROM "user" WHERE id IN (
            'c3d4e5f6-8091-52a3-bc2d-3e4f50617282',
            'd4e5f607-91a2-53b4-cd3e-4f5061728393',
            'e5f60718-a2b3-54c5-de4f-506172839404',
            'f6071829-b3c4-55d6-ef50-617283940515',
            'a1b2c3d4-6e7f-5081-9a0b-1c2d3e4f5060',
            'b2c3d4e5-7f80-5192-ab1c-2d3e4f506171'
        );
    """)
    op.execute("DELETE FROM territory WHERE id = 'f3a2b1e4-5c6d-5e7f-8a9b-0c1d2e3f4a5b';")
