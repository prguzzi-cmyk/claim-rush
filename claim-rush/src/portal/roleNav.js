/**
 * Phase 6 — Role-based sidebar navigation for ClaimRush.
 *
 * Core principle: Agents, RVPs, and CPs are SALES SPECIALISTS.
 * They find leads, close clients, own the client relationship.
 * They do NOT adjust claims, estimate, manage claim files, or access policy vaults.
 * All claim execution work is done by ACI Home Office staff in RIN.
 *
 * Items with rinRoute are iframe features loaded from RIN at :4200.
 * Items without rinRoute are native ClaimRush React pages.
 * readonly = true appends ?mode=readonly to the iframe URL.
 */

// Items carry an optional `page` key matching the vocabulary returned by
// /v1/users/me/permissions (e.g. "dashboard", "fire-leads", "earnings").
// PortalLayout consults permissions.pages to hide items whose page key
// is not in the resolved list. Items WITHOUT a `page` key are not
// considered "pages" in the RIN-permission sense — they're native
// ClaimRush features or RIN-iframe wrappers gated separately on the
// RIN side, and stay visible based on the per-role nav list below.
const items = {
  // ── Native ClaimRush ──
  dashboard:       { to: "/portal",                     label: "Dashboard",           icon: "\u{1F4CA}", end: true, page: "dashboard" },
  pitchMode:       { to: "/portal/pitch",               label: "Pitch Mode",          icon: "\u{1F3AF}", page: "pitch" },
  managerOversight:{ to: "/portal/oversight",           label: "Oversight Queue",     icon: "\u{1F441}️", page: "oversight" },
  myCases:         { to: "/portal/my-cases",            label: "My Cases",            icon: "\u{1F4C2}" },

  // ── FIND LEADS ──
  fireLeads:       { to: "/portal/fire-leads",           label: "Fire Leads",          icon: "\u{1F525}", page: "fire-leads" },
  waterLeads:      { to: "/portal/rin/water-leads",      label: "Water Leads",         icon: "\u{1F4A7}", rinRoute: "/app/fire-leads", rinQuery: "peril=flood" },
  stormIntel:      { to: "/portal/rin/storm-intel",      label: "Storm Intel",         icon: "\u26C8\uFE0F", rinRoute: "/app/storm-intelligence", page: "storm-intel" },
  roofIntel:       { to: "/portal/rin/roof-intel",       label: "Roof Intel",          icon: "\u{1F3E0}", rinRoute: "/app/roof-intelligence" },

  // ── WORK LEADS (The ACI Team) ──
  marcus:          { to: "/portal/rin/marcus",           label: "Marcus",              sub: "Outbound Caller",     icon: "\u{1F4DE}", rinRoute: "/app/voice-outreach" },
  victoria:        { to: "/portal/rin/victoria",         label: "Victoria",            sub: "Closer",              icon: "\u{1F4BC}", rinRoute: "/app/sales-ai" },
  sophia:          { to: "/portal/rin/sophia",           label: "Sophia",              sub: "Intake",              icon: "\u{1F4CB}", rinRoute: "/app/ai-intake" },
  aciLegal:        { to: "/portal/rin/aci-legal",        label: "ACI Legal",           sub: "Legal AI",            icon: "\u2696\uFE0F", rinRoute: "/app/coming-soon", comingSoon: true },
  skipTrace:       { to: "/portal/rin/skip-trace",       label: "Skip Trace",          icon: "\u{1F50D}", rinRoute: "/app/skip-trace" },
  msgTemplates:    { to: "/portal/rin/msg-templates",    label: "Message Templates",   icon: "\u{1F4E9}", rinRoute: "/app/outreach/message-templates" },
  responseDesk:    { to: "/portal/rin/response-desk",    label: "Response Desk",       icon: "\u{1F4EC}", rinRoute: "/app/outreach/response-desk" },
  communityOut:    { to: "/portal/rin/community",        label: "Community Outreach",  icon: "\u{1F91D}", rinRoute: "/app/community-outreach" },
  campaigns:       { to: "/portal/rin/campaigns",        label: "Campaigns",           icon: "\u{1F4E2}", rinRoute: "/app/outreach/campaigns" },

  // ── CLOSE ──
  // UPASign \u2014 sidebar entry surfaces the existing iframe wrapper at
  // /portal/rin/sign \u2192 adjuster-portal-ui /app/agreements (Angular). No
  // new component. Label "UPASign" matches the Angular sidebar + AxisCoach
  // documentation. Dashboard's separate "Sign Client" tile button is left
  // unchanged on purpose.
  signClient:      { to: "/portal/rin/sign",             label: "UPASign",             icon: "\u{270D}\uFE0F", rinRoute: "/app/agreements" },

  // ── MY CLIENTS (read-only — scoped by territory/ownership in backend) ──
  myClients:       { to: "/portal/my-clients",           label: "My Clients",          icon: "\u{1F465}", page: "clients" },

  // ── TEAM / TERRITORY (read-only for leadership) ──
  agentPerf:       { to: "/portal/rin/agent-perf",       label: "Agent Performance",   icon: "\u{1F4C8}", rinRoute: "/app/agent-performance", readonly: true },

  // ── RECRUITING ──
  myRecruits:      { to: "/portal/rin/recruits",         label: "My Recruits",         icon: "\u{1F465}", rinRoute: "/app/my-recruits" },

  // ── EARNINGS ──
  commission:      { to: "/portal/commission",           label: "Commission",          icon: "\u{1F4B5}", page: "earnings" },

  // ── SEMINARS ──
  seminarTraining: { to: "/portal/seminar-training",     label: "Training Center",     icon: "\u{1F393}" },
  mySeminars:      { to: "/portal/my-seminars",          label: "My Seminars",         icon: "\u{1F3A4}" },
  stormAlerts:     { to: "/portal/storm-alerts",         label: "Storm Alerts",        icon: "\u26A1" },
};


// ── AGENT ───────────────────────────────────────────────────────────────────
// Delivery-clean: only modules that actually work (real React components +
// real backend data). 13 RIN-iframe placeholder items removed earlier.
// SEMINARS group (Training Center / My Seminars / Storm Alerts) also
// removed — those components exist but their `/v1/seminars/*` backend
// endpoints are not yet implemented (404 on every call). Routes remain
// in App.jsx so direct deep-links still render; no sidebar advertises
// them until the seminar service ships.
export const AGENT_NAV = [
  { group: null, items: [items.dashboard] },
  { group: "FIND LEADS",  items: [items.fireLeads] },
  { group: "CLOSE",       items: [items.signClient] },
  { group: "MY CLIENTS",  items: [items.myClients] },
  { group: "PERFORMANCE", items: [items.commission] },
];

// ── RVP ─────────────────────────────────────────────────────────────────────
// Same delivery-clean pass as AGENT — placeholders removed, oversight kept.
export const RVP_NAV = [
  { group: null, items: [items.dashboard, items.managerOversight] },
  { group: "FIND LEADS",  items: [items.fireLeads] },
  { group: "CLOSE",       items: [items.signClient] },
  { group: "MY CLIENTS",  items: [items.myClients] },
  { group: "PERFORMANCE", items: [items.commission] },
];

// ── CP ──────────────────────────────────────────────────────────────────────
// Delivery-clean: keeps Pitch Mode + Manager Oversight (both real, fully-
// built native pages). Placeholders + SEMINARS removed.
export const CP_NAV = [
  { group: null, items: [items.dashboard, items.managerOversight] },
  { group: "FIND LEADS",  items: [items.fireLeads] },
  { group: "CLOSE",       items: [items.pitchMode, items.signClient] },
  { group: "MY CLIENTS",  items: [items.myClients] },
  { group: "PERFORMANCE", items: [items.commission] },
];

// ── ADJUSTER ────────────────────────────────────────────────────────────────
// Read-only operational view for adjusters: see the leads/claims they're
// assigned, view client info, manage their own profile. Adjusters do NOT
// see oversight, recruiting, commission, RIN admin chrome, or pitch tools.
export const ADJUSTER_NAV = [
  { group: null, items: [items.dashboard] },
  // Adjusters are claim handlers, not lead acquisition users — Fire Leads
  // and My Clients (sales-specialist surfaces) replaced with My Cases,
  // a claim-centric board fed by /v1/reports/claims/advanced-search
  // (filtered by assignment). My Clients is also hidden by the
  // permission filter for the adjuster role anyway.
  { group: "WORK", items: [items.myCases] },
  { group: "CLOSE", items: [items.signClient] },
  // RESOURCES group (Training Center / Storm Alerts) removed — backend
  // /v1/seminars/* endpoints don't exist yet. Re-add when seminar service
  // ships.
];

// ── HOME OFFICE ─────────────────────────────────────────────────────────────
export const HOME_OFFICE_NAV = [
  { group: null, items: [items.dashboard, items.managerOversight] },
  { group: "LEADS", items: [items.fireLeads, items.waterLeads, items.stormIntel, items.roofIntel] },
  { group: "THE ACI TEAM", items: [items.marcus, items.victoria, items.sophia, items.aciLegal] },
  { group: "OUTREACH", items: [items.communityOut, items.campaigns] },
  { group: "CLIENTS", items: [items.myClients, items.signClient] },
  { group: "TEAM", items: [items.agentPerf] },
  { group: "RECRUITING", items: [items.myRecruits] },
  { group: "EARNINGS", items: [items.commission] },
];


export function getNavForRole(role) {
  switch (role) {
    case "agent": return AGENT_NAV;
    case "RVP": return RVP_NAV;
    case "CP": return CP_NAV;
    case "adjuster": return ADJUSTER_NAV;
    case "home_office":
    case "super_admin":
      return HOME_OFFICE_NAV;
    default: return AGENT_NAV;
  }
}
