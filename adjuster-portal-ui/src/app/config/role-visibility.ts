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

  // CP: leadership + growth. Sees claims section (Claims / Clients /
  // Estimating / ACI Adjuster / Policy Vault — all consistent with the
  // launch matrix). Admin section dropped — RIN admin is HOME_OFFICE-only.
  // CP recruiting/territory controls are surfaced through ClaimRush
  // (Manager Oversight, Agent Performance, My Recruits) instead of the
  // RIN admin section. Lead Deployment + Territory Assignments remain
  // RIN-admin-only — ClaimRush CP dashboards consume the data via the
  // read APIs but do not mutate routing config. Intel section is included
  // so CP can navigate back to the Global Command Center (see
  // ROLE_LANDING.cp).
  'cp':          ['intel', 'leads', 'claims', 'perf', 'resources'],

  // RVP: their agents + pipeline + performance. No admin / ops sections in
  // this iteration — RVP read-only access to assignment pages is deferred.
  // Estimating is hidden via ROLE_HIDDEN_ROUTES below (Estimating Engine
  // is restricted to Admin / CP / Adjuster).
  'rvp':         ['leads', 'claims', 'perf', 'resources'],

  // Agent: narrow — leads, own claims (status only), resources. Within the
  // claims section, agent retains Claims Search + Clients Search (which
  // permission-gate via getUserPermissions); Estimating, ACI Adjuster,
  // Policy Vault, Claim File Manager are blacklisted below.
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

  // System-level intelligence routes — admin-only. Every non-admin role
  // gets these in its blacklist as defense-in-depth so an accidental
  // section-list change can never re-leak Incident Intel / Crime Claims /
  // Global Intelligence / Storm Impact Targeting / Potential Claims /
  // Opportunity Scoring / Lead Intelligence to field roles.
  // (Storm Intel + Roof Intel are NOT in this list — they remain visible
  // because they're field-facing intel surfaces.)

  // RVP: Estimating Engine is Admin / CP / Adjuster only. RVP keeps the
  // rest of the claims section. System intel admin-only.
  // Demo-hardening (Portal 1): hide mock-data trust-breakers from CP/RVP/Agent
  // sidebars — My Recruits, My Commission, Assistant render hardcoded demo
  // data and would mislead during a live demo. Admin keeps them for debug.
  'rvp': [
    '/app/estimating',
    '/app/incident-intelligence',
    '/app/crime-claims-intelligence',
    '/app/dashboard/intelligence',
    '/app/dashboard/storm-impact',
    '/app/potential-claims',
    '/app/claim-opportunity-dashboard',
    '/app/lead-intelligence',
    '/app/users/my-recruits',
    '/app/commission/me',
    '/app/resources/assistant',
  ],

  // Agent: claim status only. Keep Claims Search + Clients Search (those
  // permission-gate independently via getUserPermissions); hide the deep
  // adjuster tools. System intel admin-only.
  // Demo-hardening (Portal 1): same mock-data blacklist as RVP.
  'agent': [
    '/app/estimating',
    '/app/adjuster-assistant',
    '/app/policy-vault',
    '/app/claim-file-manager',
    '/app/incident-intelligence',
    '/app/crime-claims-intelligence',
    '/app/dashboard/intelligence',
    '/app/dashboard/storm-impact',
    '/app/potential-claims',
    '/app/claim-opportunity-dashboard',
    '/app/lead-intelligence',
    '/app/users/my-recruits',
    '/app/commission/me',
    '/app/resources/assistant',
  ],

  'adjuster': [
    '/app/incident-intelligence',
    '/app/crime-claims-intelligence',
    '/app/dashboard/intelligence',
    '/app/dashboard/storm-impact',
    '/app/potential-claims',
    '/app/claim-opportunity-dashboard',
    '/app/lead-intelligence',
  ],
  'sales-rep':   [],
  'client':      [],
  'customer':    [],

  'cp': [
    // System-level intelligence — admin-only. CP keeps Storm Intel + Roof
    // Intel within the intel section, but the system-intel pages below
    // are blacklisted so they don't leak into the field-leadership UI.
    '/app/incident-intelligence',
    '/app/crime-claims-intelligence',
    '/app/dashboard/intelligence',
    '/app/dashboard/storm-impact',
    '/app/potential-claims',
    '/app/claim-opportunity-dashboard',
    '/app/lead-intelligence',
    // Demo-hardening (Portal 1): hide mock-data trust-breakers — these
    // render hardcoded demo content that would mislead during a live
    // demo. Admin keeps them for debug; ecosystem ecosystem links are
    // re-routed to Coming Soon (sidebar template) so visibility is
    // preserved without showing fake metrics.
    '/app/users/my-recruits',
    '/app/commission/me',
    '/app/resources/assistant',
    // System / user management — hide from CP
    '/app/administration/users',
    '/app/administration/agents',
    '/app/administration/roles',
    '/app/administration/permissions',
    // Launch Control is the admin-org-readiness dashboard — admin-only.
    '/app/administration/launch-control',
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
    // Lead Deployment + Territory Assignments are RIN-admin-only controls.
    // CP role consumes the resulting territory/lead data via ClaimRush
    // dashboards; the RIN-admin pages below are blacklisted so the CP
    // sidebar does not surface the mutate-side tools.
    '/app/operations/lead-deployment',
    '/app/administration/territory-assignments',
  ],
};

/**
 * Post-login landing route per role.
 *
 * Login flow in `login.component.ts` short-circuits CP / RVP / Agent to
 * `/app/portal/<id>` (their personal portal) before consulting this
 * table — that's the temporary destination until role-specific
 * dashboards exist. The entries below are the fallbacks any *other*
 * caller (or future role) reads, and they match the spec:
 *
 *   CP    → /app/cp-dashboard   (route TBD; falls back to portal in login)
 *   RVP   → /app/rvp-dashboard  (route TBD; falls back to portal in login)
 *   Agent → /app/agent-dashboard
 *
 * If a future code path reads ROLE_LANDING directly and a TBD route
 * isn't built yet, Angular will navigate to the missing path; gate
 * those callers with the same `isPortalRole` short-circuit used in
 * login.component.ts.
 */
/**
 * CP / RVP / Agent are routed to their personal portal at
 * /app/portal/<user_id> by the `isPortalRole` short-circuit in
 * login.component.ts; the table entries here are fallbacks for any
 * other caller. Admin / super-admin keep the RIN agent-dashboard
 * (the existing command-center landing).
 */
export const ROLE_LANDING: Record<AppRole, string> = {
  'super-admin': '/app/agent-dashboard',
  'admin':       '/app/agent-dashboard',
  'cp':          '/app/agent-dashboard',
  'rvp':         '/app/agent-dashboard',
  'agent':       '/app/agent-dashboard',
  'adjuster':    '/app/agent-dashboard',
  'sales-rep':   '/app/sales-dashboard',
  'client':      '/app/customer-dashboard',
  'customer':    '/app/customer-dashboard',
};

/** Default fallback when role.name doesn't match any known AppRole. */
export const DEFAULT_LANDING = '/app/agent-dashboard';
