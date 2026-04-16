import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ClaimRush from "./pages/ClaimRush";
import ClaimRushES from "./pages/ClaimRush_ES";
import GetHelp from "./pages/GetHelp";
import FileClaim from "./pages/FileClaim";
import LeadsViewer from "./pages/LeadsViewer";
import PortalLayout from "./portal/PortalLayout";
import Dashboard from "./portal/Dashboard";
import FireLeads from "./portal/FireLeads";
import StormIntel from "./portal/StormIntel";
import ProtectionPlans from "./portal/ProtectionPlans";
import Earnings from "./portal/Earnings";
import EarningsSimulator from "./portal/EarningsSimulator";
import CompPlan from "./portal/CompPlan";
import PayoutRules from "./portal/PayoutRules";
import PayoutRuns from "./portal/PayoutRuns";
import BillingCenter from "./portal/BillingCenter";
import TerritoryRevenue from "./portal/TerritoryRevenue";
import RevenueForecast from "./portal/RevenueForecast";
import MyPayouts from "./portal/MyPayouts";
import PitchMode from "./portal/PitchMode";
import AuditDashboard from "./portal/AuditDashboard";
import HomeOfficeOps from "./portal/HomeOfficeOps";
import { useAxisContext } from "./portal/AxisContext";

// Route guard — redirects to dashboard if user lacks permission for this page.
// NOTE: This is a frontend guard only. All API endpoints MUST independently validate
// the authenticated user's role before returning data or executing actions.
// Server-side middleware should: 1) Extract role from auth token, 2) Check against
// ROLE_PERMISSIONS[role].pages, 3) Return 403 if unauthorized, 4) Log the attempt.
function RequireRole({ page, children }) {
  const { permissions, userRole } = useAxisContext();
  if (!permissions || !permissions.pages.includes(page)) {
    // Log unauthorized access attempt (in production, send to server)
    console.warn(`[RBAC] Unauthorized access attempt: role="${userRole}" page="${page}" — redirecting`);
    return <Navigate to="/portal" replace />;
  }
  return children;
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
      {/* /dashboard redirects into the portal */}
      <Route path="/dashboard" element={<Navigate to="/portal" replace />} />
      <Route path="/portal" element={<PortalLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Navigate to="/portal" replace />} />
        <Route path="fire-leads" element={<RequireRole page="fire-leads"><FireLeads /></RequireRole>} />
        <Route path="storm-intel" element={<RequireRole page="storm-intel"><StormIntel /></RequireRole>} />
        <Route path="protection-plans" element={<RequireRole page="protection-plans"><ProtectionPlans /></RequireRole>} />
        <Route path="earnings" element={<RequireRole page="earnings"><Earnings /></RequireRole>} />
        <Route path="simulator" element={<RequireRole page="simulator"><EarningsSimulator /></RequireRole>} />
        <Route path="comp-plan" element={<RequireRole page="comp-plan"><CompPlan /></RequireRole>} />
        <Route path="my-payouts" element={<RequireRole page="my-payouts"><MyPayouts /></RequireRole>} />
        <Route path="payout-rules" element={<RequireRole page="payout-rules"><PayoutRules /></RequireRole>} />
        <Route path="payout-runs" element={<RequireRole page="payout-runs"><PayoutRuns /></RequireRole>} />
        <Route path="billing" element={<RequireRole page="billing"><BillingCenter /></RequireRole>} />
        <Route path="territory-revenue" element={<RequireRole page="territory-revenue"><TerritoryRevenue /></RequireRole>} />
        <Route path="forecast" element={<RequireRole page="forecast"><RevenueForecast /></RequireRole>} />
        <Route path="pitch" element={<RequireRole page="pitch"><PitchMode /></RequireRole>} />
        <Route path="audit" element={<RequireRole page="audit"><AuditDashboard /></RequireRole>} />
        <Route path="ops" element={<RequireRole page="ops"><HomeOfficeOps /></RequireRole>} />
        {/* Catch-all: any invalid portal route redirects to dashboard */}
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Route>
    </Routes>
  );
}
