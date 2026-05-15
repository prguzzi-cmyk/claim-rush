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
  missionControl:  { to: "/portal/mission",             label: "Mission Control",     icon: "\u{1F6F0}️", accent: "#D4A853", sub: "AI Chief of Operations" },
  dashboard:       { to: "/portal",                     label: "Dashboard",           icon: "\u{1F4CA}", end: true, page: "dashboard" },
  pitchMode:       { to: "/portal/pitch",               label: "Pitch Mode",          icon: "\u{1F3AF}", page: "pitch" },
  managerOversight:{ to: "/portal/oversight",           label: "Oversight Queue",     icon: "\u{1F441}️", page: "oversight" },
  myCases:         { to: "/portal/my-cases",            label: "My Cases",            icon: "\u{1F4C2}" },

  // ── INTELLIGENCE NETWORK ── operational accent color per module
  operationsCommand:  { to: "/portal/operations-command",  label: "Operations Command",  icon: "\u{1F3AF}", accent: "#FF6D00", sub: "AI Deployment Engine" },
  operationsInsights: { to: "/portal/operations-insights", label: "Operations Insights", icon: "\u{1F9E0}", accent: "#00E6A8", sub: "Self-Improving Network" },
  opportunityNetwork: { to: "/portal/opportunity-network", label: "Opportunity Network", icon: "\u{1F6F0}️", accent: "#D4A853", sub: "Cross-Signal Fusion" },
  fireLeads:       { to: "/portal/fire-leads",           label: "Fire Leads",          icon: "\u{1F525}", page: "fire-leads", accent: "#00E6A8", sub: "Active Threat Feed" },
  waterLeads:      { to: "/portal/rin/water-leads",      label: "Water Leads",         icon: "\u{1F4A7}", rinRoute: "/app/fire-leads", rinQuery: "peril=flood", accent: "#3B82F6" },
  stormIntel:      { to: "/portal/storm-intel",          label: "Storm Intel",         icon: "\u26C8\uFE0F", accent: "#E05050", sub: "National Monitoring" },
  roofIntel:       { to: "/portal/roof-intel",           label: "Roof Intel",          icon: "\u{1F6F0}\uFE0F", accent: "#FF6D00", sub: "Satellite Targeting" },
  crimeIntel:      { to: "/portal/crime-intel",          label: "Crime Intel",         icon: "\u{1F6E1}\uFE0F", accent: "#A855F7", sub: "Threat Intelligence" },

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

  // Estimating — iframes the Angular RIN estimating module (/app/estimating).
  // Per the capability-gating rule (memory: estimating-capability-gated),
  // estimating is a 6-month-to-1-year skill and must NOT be exposed to
  // CP/RVP/Agent on role alone. Currently appears ONLY in HOME_OFFICE_NAV
  // — only the two estimating execs (Timothy Clauss + Jason Bruning) and
  // other Home Office users see it. When capability-matrix wiring lands
  // (memory: capability-additive-roles), refactor to a per-item permission
  // check (e.g. permissions["estimating.create"]) and the role-block gating
  // can be removed.
  estimating:      { to: "/portal/rin/estimating",       label: "Estimating",          icon: "\u{1F9EE}", rinRoute: "/app/estimating" },

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

  // \u2500\u2500 ADMIN / HOME OFFICE \u2014 executive operations surface (home_office + super_admin only) \u2500\u2500
  homeOffice:      { to: "/portal/home-office",              label: "Home Office",   icon: "\u{1F3DB}\uFE0F", accent: "#00E6A8", sub: "Executive Command" },
  payoutRules:     { to: "/portal/home-office/payout-rules", label: "Payout Rules",  icon: "\u{1F4B2}",       sub: "Licensing + Overrides" },
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
  { group: null, items: [items.missionControl, items.dashboard] },
  { group: "INTELLIGENCE NETWORK", items: [items.operationsCommand, items.operationsInsights, items.opportunityNetwork, items.fireLeads, items.stormIntel, items.roofIntel, items.crimeIntel] },
  { group: "CLOSE",       items: [items.signClient] },
  { group: "MY CLIENTS",  items: [items.myClients] },
  { group: "PERFORMANCE", items: [items.commission] },
];

// ── RVP ─────────────────────────────────────────────────────────────────────
// Same delivery-clean pass as AGENT — placeholders removed, oversight kept.
export const RVP_NAV = [
  { group: null, items: [items.missionControl, items.dashboard, items.managerOversight] },
  { group: "INTELLIGENCE NETWORK", items: [items.operationsCommand, items.operationsInsights, items.opportunityNetwork, items.fireLeads, items.stormIntel, items.roofIntel, items.crimeIntel] },
  // Communications tooling. Skip Trace pairs with Response Desk in
  // the same group so the find-owner → draft-message flow lives in
  // one nav surface. No send wiring; Response Desk's Send button
  // stays disabled.
  { group: "OUTREACH",    items: [items.skipTrace, items.responseDesk] },
  { group: "CLOSE",       items: [items.signClient] },
  { group: "MY CLIENTS",  items: [items.myClients] },
  { group: "PERFORMANCE", items: [items.commission] },
];

// ── CP ──────────────────────────────────────────────────────────────────────
// Delivery-clean: keeps Pitch Mode + Manager Oversight (both real, fully-
// built native pages). Placeholders + SEMINARS removed.
export const CP_NAV = [
  { group: null, items: [items.missionControl, items.dashboard, items.managerOversight] },
  { group: "INTELLIGENCE NETWORK", items: [items.operationsCommand, items.operationsInsights, items.opportunityNetwork, items.fireLeads, items.stormIntel, items.roofIntel, items.crimeIntel] },
  // Communications tooling. Skip Trace pairs with Response Desk in
  // the same group so the find-owner → draft-message flow lives in
  // one nav surface. No send wiring; Response Desk's Send button
  // stays disabled.
  { group: "OUTREACH",    items: [items.skipTrace, items.responseDesk] },
  { group: "CLOSE",       items: [items.pitchMode, items.signClient] },
  { group: "MY CLIENTS",  items: [items.myClients] },
  { group: "PERFORMANCE", items: [items.commission] },
];

// ── ADJUSTER ────────────────────────────────────────────────────────────────
// Read-only operational view for adjusters: see the leads/claims they're
// assigned, view client info, manage their own profile. Adjusters do NOT
// see oversight, recruiting, commission, RIN admin chrome, or pitch tools.
export const ADJUSTER_NAV = [
  { group: null, items: [items.missionControl, items.dashboard] },
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
  { group: null, items: [items.missionControl, items.dashboard, items.managerOversight] },
  { group: "ADMIN", items: [items.homeOffice, items.payoutRules] },
  { group: "INTELLIGENCE NETWORK", items: [items.operationsCommand, items.operationsInsights, items.opportunityNetwork, items.fireLeads, items.waterLeads, items.stormIntel, items.roofIntel, items.crimeIntel] },
  { group: "THE ACI TEAM", items: [items.marcus, items.victoria, items.sophia, items.aciLegal] },
  { group: "OUTREACH", items: [items.skipTrace, items.responseDesk, items.communityOut, items.campaigns] },
  { group: "CLIENTS", items: [items.myClients, items.estimating, items.signClient] },
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
