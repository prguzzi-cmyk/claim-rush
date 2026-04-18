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

const items = {
  // ── Native ClaimRush ──
  dashboard:       { to: "/portal",                     label: "Dashboard",           icon: "\u{1F4CA}", end: true },
  pitchMode:       { to: "/portal/pitch",               label: "Pitch Mode",          icon: "\u{1F3AF}" },

  // ── FIND LEADS ──
  fireLeads:       { to: "/portal/rin/fire-leads",       label: "Fire Leads",          icon: "\u{1F525}", rinRoute: "/app/fire-leads" },
  waterLeads:      { to: "/portal/rin/water-leads",      label: "Water Leads",         icon: "\u{1F4A7}", rinRoute: "/app/fire-leads", rinQuery: "peril=flood" },
  stormIntel:      { to: "/portal/rin/storm-intel",      label: "Storm Intel",         icon: "\u26C8\uFE0F", rinRoute: "/app/storm-intelligence" },
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
  signClient:      { to: "/portal/rin/sign",             label: "Sign Client",         icon: "\u{270D}\uFE0F", rinRoute: "/app/agreements" },

  // ── MY CLIENTS (read-only — scoped by territory/ownership in backend) ──
  myClients:       { to: "/portal/rin/clients",          label: "My Clients",          icon: "\u{1F465}", rinRoute: "/app/clients", readonly: true },

  // ── TEAM / TERRITORY (read-only for leadership) ──
  agentPerf:       { to: "/portal/rin/agent-perf",       label: "Agent Performance",   icon: "\u{1F4C8}", rinRoute: "/app/agent-performance", readonly: true },

  // ── RECRUITING ──
  myRecruits:      { to: "/portal/rin/recruits",         label: "My Recruits",         icon: "\u{1F465}", rinRoute: "/app/my-recruits" },

  // ── EARNINGS ──
  commission:      { to: "/portal/rin/commission",       label: "Commission",          icon: "\u{1F4B5}", rinRoute: "/app/basic-commission-calculator" },

  // ── SEMINARS ──
  seminarTraining: { to: "/portal/seminar-training",     label: "Training Center",     icon: "\u{1F393}" },
  mySeminars:      { to: "/portal/my-seminars",          label: "My Seminars",         icon: "\u{1F3A4}" },
  stormAlerts:     { to: "/portal/storm-alerts",         label: "Storm Alerts",        icon: "\u26A1" },
};


// ── AGENT: 13 items ─────────────────────────────────────────────────────────
export const AGENT_NAV = [
  { group: null, items: [items.dashboard] },
  { group: "FIND LEADS", items: [items.fireLeads, items.waterLeads, items.stormIntel, items.roofIntel] },
  { group: "THE ACI TEAM", items: [items.marcus, items.victoria, items.sophia, items.aciLegal] },
  { group: "OUTREACH", items: [items.skipTrace, items.msgTemplates, items.responseDesk, items.communityOut] },
  { group: "CLOSE", items: [items.signClient] },
  { group: "MY CLIENTS", items: [items.myClients] },
  { group: "PERFORMANCE", items: [items.commission] },
  { group: "SEMINARS", items: [items.seminarTraining, items.mySeminars, items.stormAlerts] },
];

// ── RVP ─────────────────────────────────────────────────────────────────────
export const RVP_NAV = [
  { group: null, items: [items.dashboard] },
  { group: "FIND LEADS", items: [items.fireLeads, items.waterLeads, items.stormIntel, items.roofIntel] },
  { group: "THE ACI TEAM", items: [items.marcus, items.victoria] },
  { group: "OUTREACH", items: [items.communityOut, items.campaigns] },
  { group: "CLOSE", items: [items.signClient] },
  { group: "MY CLIENTS", items: [items.myClients] },
  { group: "MY TEAM", items: [items.agentPerf] },
  { group: "RECRUITING", items: [items.myRecruits] },
  { group: "PERFORMANCE", items: [items.commission] },
  { group: "SEMINARS", items: [items.seminarTraining, items.mySeminars, items.stormAlerts] },
];

// ── CP ──────────────────────────────────────────────────────────────────────
export const CP_NAV = [
  { group: null, items: [items.dashboard] },
  { group: "FIND LEADS", items: [items.fireLeads, items.waterLeads, items.stormIntel, items.roofIntel] },
  { group: "THE ACI TEAM", items: [items.marcus, items.victoria] },
  { group: "OUTREACH", items: [items.communityOut, items.campaigns] },
  { group: "CLOSE", items: [items.pitchMode, items.signClient] },
  { group: "MY CLIENTS", items: [items.myClients] },
  { group: "MY TERRITORY", items: [items.agentPerf] },
  { group: "RECRUITING", items: [items.myRecruits] },
  { group: "PERFORMANCE", items: [items.commission] },
  { group: "SEMINARS", items: [items.seminarTraining, items.mySeminars, items.stormAlerts] },
];

// ── HOME OFFICE ─────────────────────────────────────────────────────────────
export const HOME_OFFICE_NAV = [
  { group: null, items: [items.dashboard] },
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
    case "home_office":
    case "super_admin":
      return HOME_OFFICE_NAV;
    default: return AGENT_NAV;
  }
}
