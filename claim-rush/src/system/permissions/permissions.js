/**
 * Permission definitions for RIN / ClaimRush.
 *
 * Two layers:
 *   1. MODULE access — which dashboard sections can the role see?
 *   2. ACTION permissions — what can the role do within those modules?
 *
 * Default permissions are defined per-role below.
 * Per-user overrides live in user_permissions table.
 */

import { ROLES } from '../roles/roles.js';

// ── Module keys (sidebar / dashboard sections) ─────────
export const MODULES = {
  COMMAND_CENTER: 'command_center',
  LEADS: 'leads',
  CLAIMS: 'claims',
  ESTIMATING: 'estimating',
  COMMUNICATIONS: 'communications',
  REPORTS: 'reports',
  ADMIN_PANEL: 'admin_panel',
};

// ── Action keys ─────────────────────────────────────────
export const ACTIONS = {
  ACCEPT_LEADS: 'accept_leads',
  REASSIGN_LEADS: 'reassign_leads',
  EXPORT_DATA: 'export_data',
  SEND_TEXTS: 'send_texts',
  MAKE_CALLS: 'make_calls',
  CREATE_USERS: 'create_users',
  MANAGE_PRICING: 'manage_pricing',
  MANAGE_FEATURE_FLAGS: 'manage_feature_flags',
  VIEW_ALL_TERRITORIES: 'view_all_territories',
  MANAGE_TERRITORIES: 'manage_territories',
  VIEW_FINANCIAL: 'view_financial',
  MANAGE_AGENCIES: 'manage_agencies',
  RUN_SKIP_TRACE: 'run_skip_trace',
  TRIGGER_BACKFILL: 'trigger_backfill',
};

// ── Default module access per role ──────────────────────
export const ROLE_MODULES = {
  [ROLES.SUPER_ADMIN]: Object.values(MODULES),
  [ROLES.HOME_OFFICE]: Object.values(MODULES),
  [ROLES.CP]: [
    MODULES.COMMAND_CENTER,
    MODULES.LEADS,
    MODULES.CLAIMS,
    MODULES.ESTIMATING,
    MODULES.COMMUNICATIONS,
    MODULES.REPORTS,
  ],
  [ROLES.RVP]: [
    MODULES.COMMAND_CENTER,
    MODULES.LEADS,
    MODULES.CLAIMS,
    MODULES.COMMUNICATIONS,
    MODULES.REPORTS,
  ],
  [ROLES.AGENT]: [
    MODULES.COMMAND_CENTER,
    MODULES.LEADS,
    MODULES.CLAIMS,
    MODULES.COMMUNICATIONS,
  ],
  [ROLES.AGENCY]: [
    MODULES.LEADS,
    MODULES.CLAIMS,
    MODULES.ESTIMATING,
    MODULES.REPORTS,
  ],
};

// ── Default action permissions per role ──────────────────
export const ROLE_ACTIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(ACTIONS),
  [ROLES.HOME_OFFICE]: Object.values(ACTIONS),
  [ROLES.CP]: [
    ACTIONS.ACCEPT_LEADS,
    ACTIONS.REASSIGN_LEADS,
    ACTIONS.EXPORT_DATA,
    ACTIONS.SEND_TEXTS,
    ACTIONS.MAKE_CALLS,
    ACTIONS.CREATE_USERS,
    ACTIONS.VIEW_ALL_TERRITORIES,
    ACTIONS.MANAGE_TERRITORIES,
    ACTIONS.VIEW_FINANCIAL,
    ACTIONS.RUN_SKIP_TRACE,
    ACTIONS.TRIGGER_BACKFILL,
  ],
  [ROLES.RVP]: [
    ACTIONS.ACCEPT_LEADS,
    ACTIONS.REASSIGN_LEADS,
    ACTIONS.EXPORT_DATA,
    ACTIONS.SEND_TEXTS,
    ACTIONS.MAKE_CALLS,
    ACTIONS.CREATE_USERS,
    ACTIONS.RUN_SKIP_TRACE,
  ],
  [ROLES.AGENT]: [
    ACTIONS.ACCEPT_LEADS,
    ACTIONS.SEND_TEXTS,
    ACTIONS.MAKE_CALLS,
    ACTIONS.EXPORT_DATA,
  ],
  [ROLES.AGENCY]: [
    ACTIONS.ACCEPT_LEADS,
    ACTIONS.EXPORT_DATA,
    ACTIONS.MAKE_CALLS,
    ACTIONS.MANAGE_AGENCIES,
  ],
};

/**
 * Check if a role has access to a module.
 */
export function hasModule(role, module) {
  return (ROLE_MODULES[role] || []).includes(module);
}

/**
 * Check if a role has a specific action permission.
 * Checks role defaults — per-user overrides should be checked separately.
 */
export function hasAction(role, action) {
  return (ROLE_ACTIONS[role] || []).includes(action);
}

/**
 * Get the full permission set for a role (modules + actions).
 * Used by the frontend to render sidebar and enable/disable features.
 */
export function getPermissionsForRole(role) {
  return {
    role,
    modules: ROLE_MODULES[role] || [],
    actions: ROLE_ACTIONS[role] || [],
  };
}

/**
 * Merge role defaults with per-user overrides from user_permissions table.
 * overrides = [{ permission: 'export_data', granted: false }, ...]
 */
export function resolvePermissions(role, overrides = []) {
  const actions = new Set(ROLE_ACTIONS[role] || []);

  for (const ov of overrides) {
    if (ov.granted) {
      actions.add(ov.permission);
    } else {
      actions.delete(ov.permission);
    }
  }

  return {
    role,
    modules: ROLE_MODULES[role] || [],
    actions: [...actions],
  };
}
