/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CLAIM RUSH — CENTRALIZED RBAC PERMISSION MAP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This file is the SINGLE SOURCE OF TRUTH for role-based access control.
 *
 * It MUST be used by:
 *   1. Frontend: sidebar rendering, route guards, component-level guards
 *   2. Backend: API middleware, data filtering, action authorization
 *
 * SECURITY RULES:
 *   - NEVER rely on frontend hiding alone
 *   - ALL API endpoints MUST validate role before returning data
 *   - ALL write operations MUST validate role + specific permission
 *   - Unknown or missing roles → DENY ALL (fall through to agent)
 *   - Log ALL unauthorized access attempts
 *   - Data queries MUST be scoped by role (see DATA_SCOPE below)
 */

// ── ROLES ───────────────────────────────────────────────────────────────────

export const ROLES = ["home_office", "CP", "RVP", "agent"];

// ── ROUTE MAP ───────────────────────────────────────────────────────────────
// Maps every portal route to which roles can access it.

export const ROUTE_MAP = {
  // All roles
  "dashboard":         ["home_office", "CP", "RVP", "agent"],
  "fire-leads":        ["home_office", "RVP", "agent"],
  "storm-intel":       ["home_office", "RVP", "agent"],
  "protection-plans":  ["home_office", "RVP", "agent"],
  "earnings":          ["home_office", "CP", "RVP", "agent"],
  "my-payouts":        ["CP", "RVP", "agent"],
  "simulator":         ["home_office", "CP", "RVP", "agent"],

  // CP + home_office
  "territory-revenue": ["home_office", "CP"],
  "comp-plan":         ["home_office"],
  "pitch":             ["home_office", "CP"],

  // home_office ONLY
  "payout-rules":      ["home_office"],
  "payout-runs":       ["home_office"],
  "billing":           ["home_office"],
  "forecast":          ["home_office"],
  "audit":             ["home_office"],
  "ops":               ["home_office"],
};

// ── ACTION PERMISSIONS ──────────────────────────────────────────────────────
// Granular action-level permissions per role.

export const ACTION_PERMISSIONS = {
  home_office: {
    // Payout actions
    publishPayoutRules: true,
    approvePayoutRuns: true,
    holdPayoutItems: true,
    adjustPayoutItems: true,
    generatePayoutRuns: true,
    exportFinancials: true,
    // Billing actions
    suspendAccounts: true,
    reinstateAccounts: true,
    retryPayments: true,
    applyWalletCredits: true,
    waiveFees: true,
    // Data access
    viewCompanyRetained: true,
    viewFullHierarchy: true,
    viewAllTerritories: true,
    viewAllPayouts: true,
    // Admin
    editPayoutRules: true,
    editTerritoryConfig: true,
    viewAuditLogs: true,
    manageCompliance: true,
  },
  CP: {
    publishPayoutRules: false,
    approvePayoutRuns: false,
    holdPayoutItems: false,
    adjustPayoutItems: false,
    generatePayoutRuns: false,
    exportFinancials: false,
    suspendAccounts: false,
    reinstateAccounts: false,
    retryPayments: false,
    applyWalletCredits: false,
    waiveFees: false,
    viewCompanyRetained: false,
    viewFullHierarchy: false,
    viewAllTerritories: true,  // own territories only
    viewAllPayouts: false,     // own payouts only
    editPayoutRules: false,
    editTerritoryConfig: false,
    viewAuditLogs: false,
    manageCompliance: false,
  },
  RVP: {
    publishPayoutRules: false, approvePayoutRuns: false, holdPayoutItems: false,
    adjustPayoutItems: false, generatePayoutRuns: false, exportFinancials: false,
    suspendAccounts: false, reinstateAccounts: false, retryPayments: false,
    applyWalletCredits: false, waiveFees: false,
    viewCompanyRetained: false, viewFullHierarchy: false,
    viewAllTerritories: false, viewAllPayouts: false,
    editPayoutRules: false, editTerritoryConfig: false,
    viewAuditLogs: false, manageCompliance: false,
  },
  agent: {
    publishPayoutRules: false, approvePayoutRuns: false, holdPayoutItems: false,
    adjustPayoutItems: false, generatePayoutRuns: false, exportFinancials: false,
    suspendAccounts: false, reinstateAccounts: false, retryPayments: false,
    applyWalletCredits: false, waiveFees: false,
    viewCompanyRetained: false, viewFullHierarchy: false,
    viewAllTerritories: false, viewAllPayouts: false,
    editPayoutRules: false, editTerritoryConfig: false,
    viewAuditLogs: false, manageCompliance: false,
  },
};

// ── DATA SCOPE ──────────────────────────────────────────────────────────────
// Defines what data each role can see in API queries.

export const DATA_SCOPE = {
  home_office: "global",    // No filter — sees everything
  CP:          "territory", // Filter by: territory_id IN user.territory_ids
  RVP:         "team",      // Filter by: user_id = self OR agent.rvp_id = self
  agent:       "self",      // Filter by: user_id = self ONLY
};

// ── FRONTEND ENFORCEMENT ────────────────────────────────────────────────────
// These are applied in the React app. They are DEFENSE-IN-DEPTH only.
// The real security is server-side.

// 1. Sidebar: ALL_NAV_ITEMS filtered by ROLE_PERMISSIONS[role].pages
// 2. Routes: RequireRole component wraps every route in App.jsx
// 3. Components: canApprovePayouts, canExportFinancials, canSeeBilling etc.
//    used to conditionally render buttons in PayoutRules, PayoutRuns, BillingCenter

// ── SERVER-SIDE ENFORCEMENT (REQUIRED) ──────────────────────────────────────

/**
 * Express middleware templates:
 *
 * // Route-level guard
 * function requireRole(...allowedRoles) {
 *   return (req, res, next) => {
 *     const role = req.user?.role;
 *     if (!role || !allowedRoles.includes(role)) {
 *       auditLog("unauthorized_access", req.user?.id, role, req.path);
 *       return res.status(403).json({ error: "Forbidden" });
 *     }
 *     next();
 *   };
 * }
 *
 * // Action-level guard
 * function requireAction(action) {
 *   return (req, res, next) => {
 *     const perms = ACTION_PERMISSIONS[req.user?.role];
 *     if (!perms?.[action]) {
 *       auditLog("unauthorized_action", req.user?.id, req.user?.role, action);
 *       return res.status(403).json({ error: "Action not permitted" });
 *     }
 *     next();
 *   };
 * }
 *
 * // Data scope filter
 * function scopeQuery(req) {
 *   const scope = DATA_SCOPE[req.user?.role];
 *   switch (scope) {
 *     case "global":    return {};
 *     case "territory": return { territory_id: { $in: req.user.territory_ids } };
 *     case "team":      return { $or: [{ user_id: req.user.id }, { rvp_id: req.user.id }] };
 *     default:          return { user_id: req.user.id };
 *   }
 * }
 *
 * // Audit logger
 * function auditLog(event, userId, role, resource, details) {
 *   db.audit_events.insert({
 *     event, userId, role, resource, details,
 *     timestamp: new Date(), ip: req.ip,
 *   });
 * }
 *
 * // Route examples:
 * app.get("/api/payout-rules",    requireRole("home_office"), ...)
 * app.post("/api/payout-rules",   requireRole("home_office"), requireAction("editPayoutRules"), ...)
 * app.post("/api/payout-publish", requireRole("home_office"), requireAction("publishPayoutRules"), ...)
 * app.get("/api/payout-runs",     requireRole("home_office"), ...)
 * app.post("/api/payout-approve", requireRole("home_office"), requireAction("approvePayoutRuns"), ...)
 * app.get("/api/billing",         requireRole("home_office"), ...)
 * app.post("/api/billing/suspend",requireRole("home_office"), requireAction("suspendAccounts"), ...)
 * app.get("/api/forecast",        requireRole("home_office"), ...)
 * app.get("/api/audit",           requireRole("home_office"), requireAction("viewAuditLogs"), ...)
 * app.get("/api/my-payouts",      (req, res) => query WHERE user_id = req.user.id)
 * app.get("/api/leads",           (req, res) => query WITH scopeQuery(req))
 * app.get("/api/territories",     requireRole("home_office", "CP"), (req, res) => {
 *   if (req.user.role === "CP") filter by req.user.territory_ids
 * })
 */

// ── AUDIT EVENT TYPES ───────────────────────────────────────────────────────

export const AUDIT_EVENTS = [
  "unauthorized_route_access",
  "unauthorized_api_access",
  "unauthorized_action_attempt",
  "payout_run_created",
  "payout_run_approved",
  "payout_run_paid",
  "payout_item_held",
  "payout_item_adjusted",
  "payout_exported",
  "rule_changed",
  "rule_published",
  "billing_override_applied",
  "wallet_credit_added",
  "suspension_applied",
  "suspension_removed",
  "account_reinstated",
  "payment_retried",
  "fee_waived",
  "territory_assigned",
  "territory_released",
  "user_role_changed",
  "compliance_item_created",
  "compliance_item_reviewed",
  "export_generated",
];

// ── DATABASE TABLES ─────────────────────────────────────────────────────────

export const SUGGESTED_TABLES = [
  "audit_events",           // All security + financial events
  "compliance_cases",       // Open compliance review items
  "rule_change_logs",       // Payout/billing rule version history
  "payout_audit_logs",      // Payout-specific audit trail
  "export_logs",            // Financial export tracking
  "session_logs",           // User login/logout tracking
];
