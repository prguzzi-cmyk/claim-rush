/**
 * Role definitions and hierarchy for RIN / ClaimRush.
 *
 * Hierarchy (top → bottom):
 *   super_admin → home_office → cp → rvp → agent
 *
 * Agency is lateral — not in the chain of command but has its own permission set.
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  HOME_OFFICE: 'home_office',
  CP: 'cp',
  RVP: 'rvp',
  AGENT: 'agent',
  AGENCY: 'agency',
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.HOME_OFFICE]: 'Home Office',
  [ROLES.CP]: 'Chapter President',
  [ROLES.RVP]: 'Regional Vice President',
  [ROLES.AGENT]: 'Agent',
  [ROLES.AGENCY]: 'Agency',
};

/**
 * Hierarchy level — higher number = more authority.
 * Used for: "can this user manage that user?"
 */
export const ROLE_LEVEL = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.HOME_OFFICE]: 90,
  [ROLES.CP]: 70,
  [ROLES.RVP]: 50,
  [ROLES.AGENT]: 30,
  [ROLES.AGENCY]: 40, // lateral — between agent and rvp for data access
};

/**
 * Who can manage whom — a role can manage any role with a lower level.
 */
export function canManage(managerRole, targetRole) {
  return (ROLE_LEVEL[managerRole] || 0) > (ROLE_LEVEL[targetRole] || 0);
}

/**
 * Upline chain — who does each role report to?
 */
export const REPORTS_TO = {
  [ROLES.AGENT]: ROLES.RVP,
  [ROLES.RVP]: ROLES.CP,
  [ROLES.CP]: ROLES.HOME_OFFICE,
  [ROLES.HOME_OFFICE]: ROLES.SUPER_ADMIN,
  [ROLES.SUPER_ADMIN]: null,
  [ROLES.AGENCY]: ROLES.HOME_OFFICE,
};

export default ROLES;
