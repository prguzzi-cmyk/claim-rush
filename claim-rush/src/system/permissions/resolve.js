/**
 * Bridge between the new permission system and the existing AxisContext.
 *
 * Maps the old role names (CP, RVP, agent, home_office) to the new system
 * and provides a unified permission object that both old and new code can use.
 */

import { ROLES } from '../roles/roles.js';
import {
  ROLE_MODULES,
  ROLE_ACTIONS,
  resolvePermissions,
  MODULES,
  ACTIONS,
} from './permissions.js';

/**
 * Map legacy role strings to the new canonical role keys.
 * The old system uses mixed case (CP, RVP) — the new system uses lowercase.
 */
const LEGACY_ROLE_MAP = {
  'home_office': ROLES.HOME_OFFICE,
  'CP': ROLES.CP,
  'RVP': ROLES.RVP,
  'agent': ROLES.AGENT,
  'super_admin': ROLES.SUPER_ADMIN,
  'agency': ROLES.AGENCY,
  // Also accept already-canonical keys
  [ROLES.HOME_OFFICE]: ROLES.HOME_OFFICE,
  [ROLES.CP]: ROLES.CP,
  [ROLES.RVP]: ROLES.RVP,
  [ROLES.AGENT]: ROLES.AGENT,
};

export function normalizeRole(role) {
  return LEGACY_ROLE_MAP[role] || ROLES.AGENT;
}

/**
 * Map old page names to new module keys so the existing sidebar/route
 * guard system keeps working during transition.
 */
const PAGE_TO_MODULE = {
  'dashboard': MODULES.COMMAND_CENTER,
  'fire-leads': MODULES.LEADS,
  'storm-intel': MODULES.LEADS,
  'protection-plans': MODULES.CLAIMS,
  'earnings': MODULES.REPORTS,
  'my-payouts': MODULES.REPORTS,
  'simulator': MODULES.REPORTS,
  'territory-revenue': MODULES.REPORTS,
  'comp-plan': MODULES.ADMIN_PANEL,
  'pitch': MODULES.COMMUNICATIONS,
  'payout-rules': MODULES.ADMIN_PANEL,
  'payout-runs': MODULES.ADMIN_PANEL,
  'billing': MODULES.ADMIN_PANEL,
  'forecast': MODULES.REPORTS,
  'audit': MODULES.ADMIN_PANEL,
  'ops': MODULES.ADMIN_PANEL,
};

/**
 * Build a unified permission object that works with BOTH the old
 * AxisContext format AND the new system.
 *
 * Returns: {
 *   role: 'cp',                          // canonical role
 *   legacyRole: 'CP',                    // original role string
 *   modules: ['command_center', ...],     // new module keys
 *   actions: ['accept_leads', ...],       // new action keys
 *   pages: ['dashboard', 'fire-leads', ...],  // old page list (backward compat)
 *   // old boolean flags (backward compat)
 *   canSeeCompanyRetained, canSeeFullHierarchy, ...
 * }
 */
export function buildPermissions(legacyRole, userOverrides = []) {
  const role = normalizeRole(legacyRole);
  const resolved = resolvePermissions(role, userOverrides);

  // Build backward-compatible pages list from new modules
  const pages = [];
  for (const [page, mod] of Object.entries(PAGE_TO_MODULE)) {
    if (resolved.modules.includes(mod)) {
      pages.push(page);
    }
  }

  // Old boolean flags derived from new action permissions
  const hasAction = (a) => resolved.actions.includes(a);

  return {
    // New system
    role,
    legacyRole,
    modules: resolved.modules,
    actions: resolved.actions,

    // Old system backward compat
    pages,
    canSeeCompanyRetained: hasAction(ACTIONS.VIEW_FINANCIAL) && [ROLES.SUPER_ADMIN, ROLES.HOME_OFFICE].includes(role),
    canSeeFullHierarchy: hasAction(ACTIONS.VIEW_ALL_TERRITORIES),
    canSeePayoutRules: hasAction(ACTIONS.MANAGE_PRICING),
    canSeeBilling: hasAction(ACTIONS.MANAGE_PRICING),
    canSeeAllTerritories: hasAction(ACTIONS.VIEW_ALL_TERRITORIES),
    canApprovePayouts: [ROLES.SUPER_ADMIN, ROLES.HOME_OFFICE].includes(role),
    canExportFinancials: hasAction(ACTIONS.VIEW_FINANCIAL) && hasAction(ACTIONS.EXPORT_DATA),
  };
}

/**
 * Check a specific action permission.
 */
export function checkAction(permissions, action) {
  return (permissions?.actions || []).includes(action);
}

/**
 * Check if user can access a specific page (old system compat).
 */
export function checkPage(permissions, page) {
  return (permissions?.pages || []).includes(page);
}
