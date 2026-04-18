import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { buildPermissions, checkAction, checkPage } from "../system/permissions/resolve.js";

// ─── Phase 3 (RIN portal handoff) ──────────────────────────────────────────
// claim-rush is embedded as an iframe inside the RIN portal (:4200). The
// parent portal passes (role, user_id, display_name, jwt) via URL params on
// load and via postMessage at runtime. This is the SINGLE bootstrap touch —
// no auth code, just identity intake.
//
// Map RIN backend role names (lowercase, hyphenated) to claim-rush's
// internal role enum (CamelCase). RIN's `agent` matches; everything else
// maps to home_office for safety until the embedding-context UX is built out.
function _normalizeRinRole(rinRole) {
  if (!rinRole) return null;
  const r = String(rinRole).toLowerCase();
  if (r === "agent" || r === "call-center-agent" || r === "sales-rep") return "agent";
  if (r === "rvp") return "RVP";
  if (r === "cp" || r === "manager") return "CP";
  if (r === "admin" || r === "super-admin" || r === "agency") return "home_office";
  return null;
}

// Strict allow-list — origins permitted to postMessage the iframe.
// Prod: backend lives at api.upaportal.org per environment.prod.ts; the frontend
// convention puts the RIN portal at app.*. Both candidates included so we don't
// have to redeploy claim-rush if the final DNS choice changes; portal.* is the
// alternate naming. No wildcards. When the final prod domain is locked, trim
// the other.
const _RIN_PORTAL_ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:4200",
  "http://localhost:4200",
  "https://app.upaportal.org",      // primary candidate (api.* ↔ app.* convention)
  "https://portal.upaportal.org",   // alternate candidate
]);

/** Pull role/user/jwt from URL params, then strip them from the URL bar
 *  (so JWT doesn't linger in history/referrers/screenshots). */
function _consumeRinPortalUrlParams() {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const src = url.searchParams.get("src");
  if (src !== "rin-portal") return null;

  const role = _normalizeRinRole(url.searchParams.get("role"));
  const user_id = url.searchParams.get("user_id");
  const display_name = url.searchParams.get("display_name");
  const jwt = url.searchParams.get("jwt");

  // Strip the sensitive params from the URL bar.
  ["role", "user_id", "display_name", "jwt", "src"].forEach(k => url.searchParams.delete(k));
  window.history.replaceState({}, document.title, url.toString());

  if (!role) return null;
  return { role, user_id, display_name, jwt };
}

const AxisContext = createContext();

const MOCK_LEADERBOARD = [
  { name: "Sarah Kim", points: 347 },
  { name: "James Obi", points: 312 },
  { name: "Marcus Lee", points: 289 },
];

// ── AGENT TERRITORY CONFIG ──────────────────────────────────────────────────

const AGENT_TERRITORY = {
  agentName: "Sarah Kim",
  primaryState: "FL",
  expansionStates: ["TX", "GA", "LA"],
  allLicensedStates: ["FL", "TX", "GA", "LA", "AZ", "CA", "CO"],
};

// ── TERRITORY SCARCITY ──────────────────────────────────────────────────────

const TERRITORY_REGISTRY = {
  FL: { name: "Florida", maxAgents: 3, agents: ["Sarah Kim", "James Obi"], level: "state" },
  TX: { name: "Texas", maxAgents: 3, agents: ["James Obi", "Marcus Lee", "Sarah Kim"], level: "state" },
  GA: { name: "Georgia", maxAgents: 3, agents: ["Marcus Lee"], level: "state" },
  LA: { name: "Louisiana", maxAgents: 2, agents: ["James Obi"], level: "state" },
  AZ: { name: "Arizona", maxAgents: 3, agents: ["Marcus Lee", "Sarah Kim"], level: "state" },
  CA: { name: "California", maxAgents: 4, agents: ["Sarah Kim", "James Obi", "Marcus Lee", "Alex Chen"], level: "state" },
  CO: { name: "Colorado", maxAgents: 3, agents: ["Marcus Lee"], level: "state" },
  NV: { name: "Nevada", maxAgents: 2, agents: [], level: "state" },
  NC: { name: "North Carolina", maxAgents: 3, agents: ["Alex Chen"], level: "state" },
  SC: { name: "South Carolina", maxAgents: 2, agents: [], level: "state" },
  AL: { name: "Alabama", maxAgents: 2, agents: ["James Obi"], level: "state" },
  MS: { name: "Mississippi", maxAgents: 2, agents: [], level: "state" },
  OK: { name: "Oklahoma", maxAgents: 2, agents: [], level: "state" },
  TN: { name: "Tennessee", maxAgents: 3, agents: ["Alex Chen", "Marcus Lee"], level: "state" },
};

function getTerritoryStatus(terr) {
  const remaining = terr.maxAgents - terr.agents.length;
  if (remaining <= 0) return { label: "FULL", color: "#E05050", remaining: 0 };
  if (remaining === 1) return { label: "LIMITED", color: "#C9A84C", remaining };
  return { label: "OPEN", color: "#00E6A8", remaining };
}

// ── CP COMMISSION TRACKING ──────────────────────────────────────────────────

const CP_MONTHLY_COST = 2000; // $2,000/month CP subscription
const COMMISSION_RATE = 0.20; // 20% of each agent's subscription

const INITIAL_RECRUITED_AGENTS = [
  { id: 1, name: "Marcus Lee", joinDate: "2026-02-10", plan: "Gold", monthly: 149, status: "active" },
  { id: 2, name: "James Obi", joinDate: "2026-02-18", plan: "Platinum", monthly: 249, status: "active" },
  { id: 3, name: "Alex Chen", joinDate: "2026-03-05", plan: "Standard", monthly: 79, status: "active" },
  { id: 4, name: "Priya Sharma", joinDate: "2026-03-12", plan: "Gold", monthly: 149, status: "active" },
  { id: 5, name: "David Kim", joinDate: "2026-03-20", plan: "Standard", monthly: 79, status: "active" },
  { id: 6, name: "Rachel Torres", joinDate: "2026-03-25", plan: "Gold", monthly: 149, status: "trial" },
];

function calcCommission(agents) {
  const active = agents.filter(a => a.status === "active" || a.status === "trial");
  const totalMonthly = active.reduce((sum, a) => sum + a.monthly, 0);
  const earnings = Math.round(totalMonthly * COMMISSION_RATE);
  const breakEvenAgents = Math.ceil(CP_MONTHLY_COST / (COMMISSION_RATE * (totalMonthly / (active.length || 1))));
  const neededMore = Math.max(0, breakEvenAgents - active.length);
  const progress = Math.min(100, Math.round((earnings / CP_MONTHLY_COST) * 100));
  return { totalAgents: active.length, totalMonthly, earnings, cpCost: CP_MONTHLY_COST, neededMore, progress };
}

// Licensed adjusters by state (for servicing in expansion territories)
const LICENSED_ADJUSTERS = {
  FL: { name: "Sarah Kim", license: "FL-PA-2024-1182" },
  TX: { name: "James Obi", license: "TX-PA-2024-0934" },
  GA: { name: "Marcus Lee", license: "GA-PA-2024-0671" },
  LA: { name: "James Obi", license: "LA-PA-2024-0935" },
  AZ: { name: "Marcus Lee", license: "AZ-PA-2024-0672" },
  CA: { name: "Sarah Kim", license: "CA-PA-2024-1183" },
  CO: { name: "Marcus Lee", license: "CO-PA-2024-0673" },
};

// ── ROLE-BASED ACCESS CONTROL ────────────────────────────────────────────────

const ROLE_PERMISSIONS = {
  home_office: {
    // Dashboard + admin tools
    pages: ["dashboard", "payout-runs", "billing", "territory-revenue", "fire-leads", "protection-plans", "payout-rules", "forecast", "audit", "ops", "pitch", "simulator", "comp-plan", "earnings", "my-payouts", "storm-intel"],
    canSeeCompanyRetained: true, canSeeFullHierarchy: true, canSeePayoutRules: true, canSeeBilling: true, canSeeAllTerritories: true, canApprovePayouts: true, canExportFinancials: true,
  },
  CP: {
    // Dashboard + Territory + Earnings
    pages: ["dashboard", "territory-revenue", "earnings", "fire-leads", "protection-plans", "my-payouts"],
    canSeeCompanyRetained: false, canSeeFullHierarchy: false, canSeePayoutRules: false, canSeeBilling: false, canSeeAllTerritories: true, canApprovePayouts: false, canExportFinancials: false,
  },
  RVP: {
    // Dashboard + Team (fire-leads) + Earnings
    pages: ["dashboard", "fire-leads", "earnings", "protection-plans", "my-payouts"],
    canSeeCompanyRetained: false, canSeeFullHierarchy: false, canSeePayoutRules: false, canSeeBilling: false, canSeeAllTerritories: false, canApprovePayouts: false, canExportFinancials: false,
  },
  agent: {
    // Dashboard + Leads + Earnings
    pages: ["dashboard", "fire-leads", "earnings", "protection-plans", "my-payouts"],
    canSeeCompanyRetained: false, canSeeFullHierarchy: false, canSeePayoutRules: false, canSeeBilling: false, canSeeAllTerritories: false, canApprovePayouts: false, canExportFinancials: false,
  },
};

/** Read stored auth from localStorage (set by Login page or RIN iframe). */
function _getStoredAuth() {
  const crRole = localStorage.getItem("cr_role");
  const crUserRaw = localStorage.getItem("cr_user");
  const token = localStorage.getItem("access_token");
  if (!crRole || !token) return null;
  let crUser = {};
  try { crUser = JSON.parse(crUserRaw || "{}"); } catch {}
  return {
    role: crRole,
    user_id: crUser.user_id || null,
    display_name: crUser.display_name || "",
    jwt: typeof token === "string" ? (token.startsWith('"') ? JSON.parse(token) : token) : null,
  };
}

export function AxisProvider({ children }) {
  // Priority: 1) RIN iframe handoff (URL params), 2) localStorage (standalone login), 3) dev mock
  const _rinHandoff = useMemo(() => _consumeRinPortalUrlParams(), []);
  const _storedAuth = useMemo(() => _getStoredAuth(), []);
  const _bootstrap = _rinHandoff || _storedAuth;

  const [userRole, setUserRole] = useState(
    _bootstrap?.role ?? "home_office"
  ); // home_office | CP | RVP | agent
  // RIN-portal-supplied identity (used for display + future API calls).
  const [rinIdentity, setRinIdentity] = useState(
    _bootstrap
      ? {
          user_id: _bootstrap.user_id,
          display_name: _bootstrap.display_name,
          jwt: _bootstrap.jwt,
        }
      : null
  );

  // PostMessage listener for runtime context updates from the RIN portal.
  // Strict origin allow-list — silently drops messages from any other origin.
  useEffect(() => {
    function handleRinMessage(event) {
      if (!_RIN_PORTAL_ALLOWED_ORIGINS.has(event.origin)) return;
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type !== "rin:context") return;
      const role = _normalizeRinRole(msg.role);
      if (role) setUserRole(role);
      setRinIdentity({
        user_id: msg.user_id ?? null,
        display_name: msg.display_name ?? "",
        jwt: msg.jwt ?? null,
      });
    }
    window.addEventListener("message", handleRinMessage);
    return () => window.removeEventListener("message", handleRinMessage);
  }, []);

  // New permission system — builds unified permissions from role
  // Backward compatible: permissions.pages, permissions.canSeeX still work
  const permissions = useMemo(() => buildPermissions(userRole), [userRole]);

  const [liveContext, setLiveContext] = useState({
    activeLead: null,
    confidence: 0,
    outreachActive: false,
    preCallUsed: false,
    triggerUsed: null,
  });

  const [territory, setTerritory] = useState(AGENT_TERRITORY);
  const [territories, setTerritories] = useState(TERRITORY_REGISTRY);
  const [recruitedAgents, setRecruitedAgents] = useState(INITIAL_RECRUITED_AGENTS);
  const [dailyPoints, setDailyPoints] = useState(42);
  const [sessions, setSessions] = useState([]);

  const commission = calcCommission(recruitedAgents);

  const addSession = useCallback((session) => {
    setSessions(prev => [session, ...prev].slice(0, 20));
    setDailyPoints(prev => prev + (session.points || 0));
  }, []);

  const getLeadTerritory = useCallback((leadState) => {
    if (leadState === territory.primaryState) return "primary";
    if (territory.expansionStates.includes(leadState)) return "expansion";
    if (territory.allLicensedStates.includes(leadState)) return "licensed";
    return "outside";
  }, [territory]);

  const getAdjuster = useCallback((state) => {
    return LICENSED_ADJUSTERS[state] || null;
  }, []);

  const claimTerritory = useCallback((stateCode, asExpansion = true) => {
    const terr = territories[stateCode];
    if (!terr) return { success: false, reason: "Territory not found" };
    const status = getTerritoryStatus(terr);
    if (status.remaining <= 0) return { success: false, reason: "Territory is full" };
    if (terr.agents.includes(territory.agentName)) return { success: false, reason: "Already assigned" };

    setTerritories(prev => ({
      ...prev,
      [stateCode]: { ...prev[stateCode], agents: [...prev[stateCode].agents, territory.agentName] },
    }));
    if (asExpansion) {
      setTerritory(prev => ({
        ...prev,
        expansionStates: [...prev.expansionStates, stateCode],
        allLicensedStates: prev.allLicensedStates.includes(stateCode) ? prev.allLicensedStates : [...prev.allLicensedStates, stateCode],
      }));
    }
    return { success: true };
  }, [territories, territory.agentName]);

  const releaseTerritory = useCallback((stateCode) => {
    if (stateCode === territory.primaryState) return { success: false, reason: "Cannot release primary territory" };
    setTerritories(prev => ({
      ...prev,
      [stateCode]: { ...prev[stateCode], agents: prev[stateCode].agents.filter(a => a !== territory.agentName) },
    }));
    setTerritory(prev => ({
      ...prev,
      expansionStates: prev.expansionStates.filter(s => s !== stateCode),
    }));
    return { success: true };
  }, [territory.primaryState, territory.agentName]);

  return (
    <AxisContext.Provider value={{
      userRole, setUserRole, permissions,
      // Phase 3: identity passed in by the RIN portal when embedded.
      // null when running standalone.
      rinIdentity,
      checkAction: (action) => checkAction(permissions, action),
      checkPage: (page) => checkPage(permissions, page),
      liveContext, setLiveContext,
      dailyPoints, sessions, addSession,
      leaderboard: MOCK_LEADERBOARD,
      territory, setTerritory,
      territories, getTerritoryStatus,
      claimTerritory, releaseTerritory,
      getLeadTerritory, getAdjuster,
      recruitedAgents, setRecruitedAgents, commission,
    }}>
      {children}
    </AxisContext.Provider>
  );
}

export function useAxisContext() {
  return useContext(AxisContext);
}

export { getTerritoryStatus };
