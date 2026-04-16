-- RIN / ClaimRush Foundation Schema
-- Run against the UPA portal Postgres (upa-portal-db-1)
-- Chained after the existing alembic migrations

-- ══════════════════════════════════════════════════════════
-- AGENCIES
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rin_agency (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    license_number  VARCHAR(100),
    primary_contact_id UUID,
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

-- ══════════════════════════════════════════════════════════
-- TERRITORIES (extends existing territory table or standalone)
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rin_territory (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    territory_type      VARCHAR(20) NOT NULL CHECK (territory_type IN ('state','county','zip','custom')),
    state               VARCHAR(2),
    county              VARCHAR(100),
    zip_code            VARCHAR(10),
    parent_territory_id UUID REFERENCES rin_territory(id),
    is_active           BOOLEAN DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_rin_territory_type_state ON rin_territory(territory_type, state);

-- ══════════════════════════════════════════════════════════
-- RIN USERS (extends existing user table via FK or standalone)
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rin_user (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upa_user_id     UUID REFERENCES "user"(id) ON DELETE SET NULL,  -- link to existing UPA user
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20),
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    role            VARCHAR(20) NOT NULL CHECK (role IN ('super_admin','home_office','cp','rvp','agent','agency')),
    agency_id       UUID REFERENCES rin_agency(id) ON DELETE SET NULL,
    parent_user_id  UUID REFERENCES rin_user(id) ON DELETE SET NULL,
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','suspended','pending')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_rin_user_role ON rin_user(role);
CREATE INDEX IF NOT EXISTS ix_rin_user_parent ON rin_user(parent_user_id);

-- ══════════════════════════════════════════════════════════
-- USER ↔ TERRITORY ASSIGNMENTS
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rin_user_territory (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES rin_user(id) ON DELETE CASCADE,
    territory_id        UUID NOT NULL REFERENCES rin_territory(id) ON DELETE CASCADE,
    role_in_territory   VARCHAR(20) DEFAULT 'assigned',
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, territory_id)
);

-- ══════════════════════════════════════════════════════════
-- USER PERMISSIONS (per-user overrides of role defaults)
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rin_user_permission (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES rin_user(id) ON DELETE CASCADE,
    permission  VARCHAR(60) NOT NULL,
    granted     BOOLEAN DEFAULT true,
    granted_by  UUID REFERENCES rin_user(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, permission)
);
CREATE INDEX IF NOT EXISTS ix_rin_user_permission_user ON rin_user_permission(user_id);

-- ══════════════════════════════════════════════════════════
-- FEATURE FLAGS
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rin_feature_flag (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key        VARCHAR(60) UNIQUE NOT NULL,
    flag_name       VARCHAR(200),
    description     TEXT,
    enabled_global  BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════
-- USER ↔ FEATURE FLAG OVERRIDES
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rin_user_feature_flag (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES rin_user(id) ON DELETE CASCADE,
    flag_id     UUID NOT NULL REFERENCES rin_feature_flag(id) ON DELETE CASCADE,
    enabled     BOOLEAN NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, flag_id)
);

-- ══════════════════════════════════════════════════════════
-- ADD FK back to agency
-- ══════════════════════════════════════════════════════════
ALTER TABLE rin_agency
    ADD CONSTRAINT fk_rin_agency_primary_contact
    FOREIGN KEY (primary_contact_id) REFERENCES rin_user(id) ON DELETE SET NULL;
