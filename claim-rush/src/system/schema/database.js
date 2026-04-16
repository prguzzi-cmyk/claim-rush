/**
 * RIN / ClaimRush Database Schema Definition
 *
 * This file defines the canonical schema for the platform.
 * Used as reference for migrations (Postgres via UPA backend)
 * and for the local dev mock layer.
 *
 * Hierarchy: home_office > cp > rvp > agent
 * Agency is a lateral account type (not in the chain of command).
 */

export const SCHEMA = {

  // ── Users ──────────────────────────────────────────────
  users: {
    id: 'uuid PRIMARY KEY',
    email: 'varchar(255) UNIQUE NOT NULL',
    phone: 'varchar(20)',
    first_name: 'varchar(100)',
    last_name: 'varchar(100)',
    role: "varchar(20) NOT NULL CHECK (role IN ('super_admin','home_office','cp','rvp','agent','agency'))",
    agency_id: 'uuid REFERENCES agencies(id) ON DELETE SET NULL',
    parent_user_id: 'uuid REFERENCES users(id) ON DELETE SET NULL', // upline: agent→rvp→cp→home_office
    status: "varchar(20) DEFAULT 'active' CHECK (status IN ('active','inactive','suspended','pending'))",
    created_at: 'timestamptz DEFAULT now()',
    updated_at: 'timestamptz',
  },

  // ── Agencies ───────────────────────────────────────────
  agencies: {
    id: 'uuid PRIMARY KEY',
    name: 'varchar(255) NOT NULL',
    license_number: 'varchar(100)',
    primary_contact_id: 'uuid REFERENCES users(id)',
    status: "varchar(20) DEFAULT 'active'",
    created_at: 'timestamptz DEFAULT now()',
    updated_at: 'timestamptz',
  },

  // ── Territories ────────────────────────────────────────
  territories: {
    id: 'uuid PRIMARY KEY',
    name: 'varchar(200) NOT NULL',
    territory_type: "varchar(20) NOT NULL CHECK (territory_type IN ('state','county','zip','custom'))",
    state: 'varchar(2)',
    county: 'varchar(100)',
    zip_code: 'varchar(10)',
    parent_territory_id: 'uuid REFERENCES territories(id)', // county→state nesting
    is_active: 'boolean DEFAULT true',
    created_at: 'timestamptz DEFAULT now()',
  },

  // ── User ↔ Territory assignments ───────────────────────
  user_territories: {
    id: 'uuid PRIMARY KEY',
    user_id: 'uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE',
    territory_id: 'uuid NOT NULL REFERENCES territories(id) ON DELETE CASCADE',
    role_in_territory: "varchar(20) DEFAULT 'assigned'", // 'owner', 'assigned', 'backup'
    created_at: 'timestamptz DEFAULT now()',
    _unique: ['user_id', 'territory_id'],
  },

  // ── Permissions ────────────────────────────────────────
  user_permissions: {
    id: 'uuid PRIMARY KEY',
    user_id: 'uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE',
    permission: 'varchar(60) NOT NULL',
    granted: 'boolean DEFAULT true',
    granted_by: 'uuid REFERENCES users(id)',
    created_at: 'timestamptz DEFAULT now()',
    _unique: ['user_id', 'permission'],
  },

  // ── Feature Flags ──────────────────────────────────────
  feature_flags: {
    id: 'uuid PRIMARY KEY',
    flag_key: 'varchar(60) UNIQUE NOT NULL',
    flag_name: 'varchar(200)',
    description: 'text',
    enabled_global: 'boolean DEFAULT false',
    created_at: 'timestamptz DEFAULT now()',
  },

  // ── User ↔ Feature Flag overrides ─────────────────────
  user_feature_flags: {
    id: 'uuid PRIMARY KEY',
    user_id: 'uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE',
    flag_id: 'uuid NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE',
    enabled: 'boolean NOT NULL',
    created_at: 'timestamptz DEFAULT now()',
    _unique: ['user_id', 'flag_id'],
  },
};

export default SCHEMA;
