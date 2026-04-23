/**
 * Single source of truth for role-driven UI visibility.
 *
 * Each role gets:
 *   - a whitelist of top-level sidebar sections
 *   - an optional blacklist of specific route paths to hide even when the
 *     section is visible (used to let CP see the admin section but NOT the
 *     system-management items inside it)
 *   - a post-login landing route
 *
 * Touching these lists is the ONLY place you should need to edit when the
 * product's role-visibility rules change — keep sidebar templates thin
 * (`*ngIf="showSection(key)"` / `*ngIf="canShowRoute(path)"`) and put the
 * policy here.
 */

export type AppRole =
  | 'super-admin'
  | 'admin'
  | 'cp'
  | 'rvp'
  | 'agent'
  | 'adjuster'
  | 'sales-rep'
  | 'client'
  // Legacy alias — sidebar.component.html historically checked `customer`.
  // Keep it in the type union so stale localStorage values resolve cleanly.
  | 'customer';

/**
 * Which sidebar sections each role may see. Section keys match the
 * `sections` object in sidebar.component.ts:
 *   intel  leads  comms  ops  claims  perf  resources  admin
 */
export const ROLE_SIDEBAR_SECTIONS: Record<AppRole, readonly string[]> = {
  'super-admin': ['intel', 'leads', 'comms', 'ops', 'claims', 'perf', 'resources', 'admin'],
  'admin':       ['intel', 'leads', 'comms', 'ops', 'claims', 'perf', 'resources', 'admin'],

  // CP: leadership + growth. Sees admin section for recruiting/territory
  // controls; route-level blacklist below hides the system-admin items
  // within it. Intel section included so CP can navigate back to the
  // Global Command Center (their landing page — see ROLE_LANDING.cp).
  'cp':          ['intel', 'leads', 'perf', 'resources', 'admin'],

  // RVP: their agents + pipeline + performance. No admin section.
  'rvp':         ['leads', 'claims', 'perf', 'resources'],

  // Agent: narrow — leads, own claims, resources.
  'agent':       ['leads', 'claims', 'resources'],

  // Adjuster: claims workspace + resources (policy docs, estimating templates).
  'adjuster':    ['claims', 'resources'],

  // Sales Rep (legacy persona): unchanged behavior.
  'sales-rep':   ['leads', 'comms', 'perf'],

  // Client / customer: served a separate compact nav in the template,
  // no grouped sections.
  'client':      [],
  'customer':    [],
};

/**
 * Route paths hidden inside an otherwise-visible section.
 *
 * Primary use: CP sees the `admin` section but only the Recruiting +
 * Territory + high-level communications items. System-management items
 * (Users, Roles, Permissions, Pricing, Rotation Config, Commission Admin,
 * Policies, etc.) are blacklisted here.
 *
 * Entries are exact-match route strings (the `routerLink` value in the
 * sidebar template).
 */
export const ROLE_HIDDEN_ROUTES: Record<AppRole, readonly string[]> = {
  'super-admin': [],
  'admin':       [],
  'rvp':         [],
  'agent':       [],
  'adjuster':    [],
  'sales-rep':   [],
  'client':      [],
  'customer':    [],

  'cp': [
    // System / user management — hide from CP
    '/app/administration/users',
    '/app/administration/agents',
    '/app/administration/roles',
    '/app/administration/permissions',
    // System operational config — hide from CP
    '/app/administration/pricing-admin',
    '/app/administration/rotation-config',
    '/app/administration/intake-control',
    '/app/administration/outreach-compliance',
    '/app/administration/lead-distribution',
    '/app/administration/lead-intake',
    '/app/administration/escalation-admin',
    // Deep commission + policy config — hide from CP
    '/app/admin/commissions',
    '/app/administration/policies',
    '/app/administration/title-change',
    // Meta / tagging / scheduling — hide from CP
    '/app/tags',
    '/app/administration/tasks/task-list',
    '/app/administration/schedules/schedule-list',
    '/app/administration/release-notes',
  ],
};

/**
 * Post-login landing route per role. All non-role-specific roles fall back
 * to `/app/agent-dashboard` TODAY; update these when role-specific
 * dashboards are built.
 */
export const ROLE_LANDING: Record<AppRole, string> = {
  'super-admin': '/app/agent-dashboard',
  'admin':       '/app/agent-dashboard',
  // CP's primary UI is ClaimRush at aciunited.com. RIN is backend only.
  // Full URL triggers an external navigation in login.component.ts (user
  // will re-auth on the ClaimRush origin since localStorage is per-origin).
  'cp':          'https://aciunited.com/portal',
  'rvp':         '/app/agent-dashboard',   // TODO: /app/rvp-dashboard when built
  'agent':       '/app/agent-dashboard',
  'adjuster':    '/app/agent-dashboard',   // TODO: /app/adjuster-workspace when built
  'sales-rep':   '/app/sales-dashboard',
  'client':      '/app/customer-dashboard',
  'customer':    '/app/customer-dashboard',
};

/** Default fallback when role.name doesn't match any known AppRole. */
export const DEFAULT_LANDING = '/app/agent-dashboard';
