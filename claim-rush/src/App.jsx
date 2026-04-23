import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ClaimRush from "./pages/ClaimRush";
import ClaimRushES from "./pages/ClaimRush_ES";
import GetHelp from "./pages/GetHelp";
import FileClaim from "./pages/FileClaim";
import LeadsViewer from "./pages/LeadsViewer";
import SitePreview from "./pages/SitePreview";
import ChapterPresidentOpportunity from "./pages/ChapterPresidentOpportunity";
import CommunityImpact from "./pages/CommunityImpact";
import CommunityLocal from "./pages/CommunityLocal";
import PortalLayout from "./portal/PortalLayout";
import Dashboard from "./portal/Dashboard";
import IframeFeature from "./portal/IframeFeature";
import LeadsBoard from "./portal/LeadsBoard";
import PitchMode from "./portal/PitchMode";
import SeminarTraining from "./portal/SeminarTraining";
import MySeminars from "./portal/MySeminars";
import StormAlerts from "./portal/StormAlerts";
import ProfilePage from "./portal/ProfilePage";
import SettingsPage from "./portal/SettingsPage";
import { useAxisContext } from "./portal/AxisContext";

// Auth guard — redirects to /login if no JWT in localStorage.
// Allows through if user arrived via RIN iframe (URL params have src=rin-portal).
function RequireAuth({ children }) {
  const hasToken = !!localStorage.getItem("access_token");
  const isRinEmbed = new URLSearchParams(window.location.search).get("src") === "rin-portal";
  if (!hasToken && !isRinEmbed) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Route guard — redirects to dashboard if user lacks permission for this page.
// NOTE: This is a frontend guard only. All API endpoints MUST independently validate
// the authenticated user's role before returning data or executing actions.
function RequireRole({ page, children }) {
  const { permissions, userRole } = useAxisContext();
  if (!permissions || !permissions.pages.includes(page)) {
    console.warn(`[RBAC] Unauthorized access attempt: role="${userRole}" page="${page}" — redirecting`);
    return <Navigate to="/portal" replace />;
  }
  return children;
}

function ComingSoon({ name, sub }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "60vh", color: "rgba(255,255,255,0.5)", fontFamily: "'Courier New', monospace",
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>{"\u2696\uFE0F"}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{name}</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>{sub}</div>
      <div style={{
        marginTop: 20, padding: "6px 16px", borderRadius: 20,
        background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
        fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#A855F7",
      }}>
        PART OF THE ACI TEAM
      </div>
    </div>
  );
}

function getInitialLang() {
  const path = window.location.pathname;
  if (path === "/es" || path === "/claimrush-es") return "es";
  if (path === "/" || path === "/claimrush") return "en";
  return navigator.language?.startsWith("es") ? "es" : "en";
}

function LandingPage() {
  const [lang, setLang] = useState(getInitialLang);

  const switchLang = (newLang) => {
    setLang(newLang);
    window.history.replaceState(null, "", newLang === "es" ? "/es" : "/");
  };

  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/claimrush") window.history.replaceState(null, "", "/");
    if (path === "/claimrush-es") window.history.replaceState(null, "", "/es");
    if (path === "/") {
      const detected = navigator.language?.startsWith("es") ? "es" : "en";
      if (detected === "es") {
        setLang("es");
        window.history.replaceState(null, "", "/es");
      }
    }
  }, []);

  return lang === "es"
    ? <ClaimRushES lang="es" onSetLang={switchLang} />
    : <ClaimRush lang="en" onSetLang={switchLang} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/es" element={<LandingPage />} />
      <Route path="/get-help" element={<GetHelp />} />
      <Route path="/file-a-claim" element={<FileClaim />} />
      <Route path="/leads" element={<LeadsViewer />} />
      <Route path="/login" element={<Login />} />
      <Route path="/preview/:role/:slug" element={<SitePreview />} />
      <Route path="/chapter-president-opportunity" element={<ChapterPresidentOpportunity />} />
      <Route path="/community-impact" element={<CommunityImpact />} />
      <Route path="/community/:slug" element={<CommunityLocal />} />
      {/* /dashboard redirects into the portal */}
      <Route path="/dashboard" element={<Navigate to="/portal" replace />} />
      <Route path="/portal" element={<RequireAuth><PortalLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Navigate to="/portal" replace />} />

        {/* Native ClaimRush pages */}
        <Route path="pitch" element={<PitchMode />} />
        <Route path="seminar-training" element={<SeminarTraining />} />
        <Route path="my-seminars" element={<MySeminars />} />
        <Route path="storm-alerts" element={<StormAlerts />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Phase 5+6: RIN iframe features — FIND/WORK LEADS */}
        {/* Fire Leads — real native component, backed by /v1/dashboard/cp-leads */}
        <Route path="fire-leads"        element={<LeadsBoard />} />
        <Route path="rin/fire-leads"    element={<LeadsBoard />} />
        <Route path="rin/water-leads"   element={<IframeFeature rinRoute="/app/fire-leads" title="Water Damage Leads" rinQuery="peril=flood" />} />
        <Route path="rin/claims"        element={<IframeFeature rinRoute="/app/claims" title="Claims" />} />
        <Route path="rin/claim-files"   element={<IframeFeature rinRoute="/app/claim-file-manager" title="Claim File Manager" />} />
        <Route path="rin/estimating"    element={<IframeFeature rinRoute="/app/estimating" title="Estimating" />} />
        <Route path="rin/policy-vault"  element={<IframeFeature rinRoute="/app/policy-vault" title="Policy Vault" />} />
        <Route path="rin/agreements"    element={<IframeFeature rinRoute="/app/agreements" title="Agreements" />} />

        {/* Phase 5+8: THE ACI TEAM */}
        <Route path="rin/marcus"        element={<IframeFeature rinRoute="/app/voice-outreach" title="Marcus — Outbound Caller" />} />
        <Route path="rin/victoria"      element={<IframeFeature rinRoute="/app/sales-ai" title="Victoria — Sales Closer" />} />
        <Route path="rin/sophia"        element={<IframeFeature rinRoute="/app/ai-intake" title="Sophia — Intake Specialist" />} />
        <Route path="rin/aci-legal"     element={<ComingSoon name="ACI Legal" sub="Legal AI — Coming Soon" />} />
        <Route path="rin/skip-trace"    element={<IframeFeature rinRoute="/app/skip-trace" title="Skip Trace" />} />
        <Route path="rin/msg-templates" element={<IframeFeature rinRoute="/app/outreach/message-templates" title="Message Templates" />} />
        <Route path="rin/response-desk" element={<IframeFeature rinRoute="/app/outreach/response-desk" title="Response Desk" />} />
        <Route path="rin/community"     element={<IframeFeature rinRoute="/app/community-outreach" title="Community Outreach" />} />
        <Route path="rin/campaigns"     element={<IframeFeature rinRoute="/app/outreach/campaigns" title="Campaigns" />} />

        {/* Phase 5: RIN iframe features — INTEL */}
        <Route path="rin/storm-intel"   element={<IframeFeature rinRoute="/app/storm-intelligence" title="Storm Intelligence" />} />
        <Route path="rin/roof-intel"    element={<IframeFeature rinRoute="/app/roof-intelligence" title="Roof Intelligence" />} />
        <Route path="rin/inspections"   element={<IframeFeature rinRoute="/app/inspection-calendar" title="Inspection Calendar" />} />

        {/* Phase 6: CLOSE + MY CLIENTS */}
        <Route path="rin/sign"          element={<IframeFeature rinRoute="/app/agreements" title="Sign Client" />} />

        {/* Legacy routes — redirect to new names */}
        <Route path="rin/ai-voice" element={<Navigate to="/portal/rin/marcus" replace />} />
        <Route path="rin/ai-sales" element={<Navigate to="/portal/rin/victoria" replace />} />
        <Route path="rin/ai-intake" element={<Navigate to="/portal/rin/sophia" replace />} />
        <Route path="rin/clients"       element={<IframeFeature rinRoute="/app/clients" title="My Clients" readonly />} />

        {/* Phase 5: RIN iframe features — TEAM/TERRITORY (read-only) */}
        <Route path="rin/agent-perf"    element={<IframeFeature rinRoute="/app/agent-performance" title="Agent Performance" readonly />} />
        <Route path="rin/territory"     element={<IframeFeature rinRoute="/app/territory-management" title="Territory Management" readonly />} />
        <Route path="rin/revenue-intel" element={<IframeFeature rinRoute="/app/revenue-intelligence" title="Revenue Intelligence" readonly />} />

        {/* Phase 5: RIN iframe features — RECRUITING + EARNINGS */}
        <Route path="rin/recruits"      element={<IframeFeature rinRoute="/app/my-recruits" title="My Recruits" />} />
        <Route path="rin/commission"    element={<IframeFeature rinRoute="/app/basic-commission-calculator" title="Commission" />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Route>
    </Routes>
  );
}
