/**
 * Role-based lead filtering for RIN / ClaimRush.
 *
 * @param {string} userRole - agent | rvp | cp | home_office | super_admin | agency
 * @param {string} userId - current user's id
 * @param {Array} leads - full lead array
 * @param {object} [context] - optional: { territory, agentIds }
 *   territory: user's territory string (for cp filtering)
 *   agentIds: array of user ids that report to this user (for rvp filtering)
 */
export function getLeadsForUser(userRole, userId, leads, context = {}) {
  if (!leads || !leads.length) return [];

  switch (userRole) {
    case 'super_admin':
    case 'home_office':
      return leads;

    case 'cp':
      return leads.filter(l =>
        l.assigned_user_id === userId ||
        (context.territory && l.territory === context.territory)
      );

    case 'rvp':
      const teamIds = new Set([userId, ...(context.agentIds || [])]);
      return leads.filter(l => teamIds.has(l.assigned_user_id));

    case 'agent':
      return leads.filter(l => l.assigned_user_id === userId);

    case 'agency':
      return leads.filter(l => l.assigned_user_id === userId);

    default:
      return [];
  }
}
