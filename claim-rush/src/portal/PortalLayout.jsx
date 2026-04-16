import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { C } from "./theme";
import AxisCoach from "./AxisCoach";
import AxisLiveOverlay from "./AxisLiveOverlay";
import { AxisProvider, useAxisContext } from "./AxisContext";
import logoDark from "../assets/logo/claimrush-logo-dark.svg";
import logoIcon from "../assets/logo/claimrush-icon.svg";

const PURPLE = "#A855F7";

// Sidebar items — role-aware labels via permissions filtering
// Agent sees:    Dashboard, Leads, Earnings
// RVP sees:      Dashboard, Team, Earnings
// CP sees:       Dashboard, Territory, Earnings
// Home Office:   Dashboard, Payouts, Subscriptions, Territory Performance
// ── NAV ITEMS grouped by module ─────────────────────────────────────
// `module` maps to the new permission system; `page` maps to the old one.
// An item shows if EITHER its module OR its page is in the user's permissions.
const ALL_NAV_ITEMS = [
  // Command Center
  { to: "/portal", label: "Dashboard", icon: "\u{1F4CA}", end: true, page: "dashboard", module: "command_center", group: "core" },

  // Leads
  { to: "/portal/fire-leads", label: "Leads", icon: "\u{1F525}", page: "fire-leads", module: "leads", group: "operations", altLabels: { RVP: "Team" } },
  { to: "/portal/storm-intel", label: "Storm Intel", icon: "\u26C8\uFE0F", page: "storm-intel", module: "leads", group: "operations" },

  // Claims
  { to: "/portal/protection-plans", label: "Claims", icon: "\u{1F6E1}\uFE0F", page: "protection-plans", module: "claims", group: "operations" },

  // Communications
  { to: "/portal/pitch", label: "Pitch Mode", icon: "\u{1F3AF}", page: "pitch", module: "communications", group: "operations" },

  // Reports
  { to: "/portal/earnings", label: "Earnings", icon: "\u{1F4B0}", page: "earnings", module: "reports", group: "reports" },
  { to: "/portal/my-payouts", label: "My Payouts", icon: "\u{1F4B8}", page: "my-payouts", module: "reports", group: "reports" },
  { to: "/portal/territory-revenue", label: "Territory", icon: "\u{1F5FA}\uFE0F", page: "territory-revenue", module: "reports", group: "reports" },
  { to: "/portal/forecast", label: "Forecast", icon: "\u{1F4C8}", page: "forecast", module: "reports", group: "reports" },
  { to: "/portal/simulator", label: "Simulator", icon: "\u{1F9EA}", page: "simulator", module: "reports", group: "reports" },

  // Admin
  { to: "/portal/payout-runs", label: "Payouts", icon: "\u{1F4B3}", page: "payout-runs", module: "admin_panel", group: "admin" },
  { to: "/portal/payout-rules", label: "Payout Rules", icon: "\u2699\uFE0F", page: "payout-rules", module: "admin_panel", group: "admin" },
  { to: "/portal/billing", label: "Subscriptions", icon: "\u{1F4B5}", page: "billing", module: "admin_panel", group: "admin" },
  { to: "/portal/comp-plan", label: "Comp Plan", icon: "\u{1F4CB}", page: "comp-plan", module: "admin_panel", group: "admin" },
  { to: "/portal/audit", label: "Audit Log", icon: "\u{1F50D}", page: "audit", module: "admin_panel", group: "admin" },
  { to: "/portal/ops", label: "Operations", icon: "\u{1F3E2}", page: "ops", module: "admin_panel", group: "admin" },
];

const ROLE_COLORS = { super_admin: "#FF6B6B", home_office: "#E05050", CP: "#00E6A8", RVP: C.gold, agent: C.blue, agency: "#A78BFA" };
const GROUP_LABELS = { core: null, operations: "OPERATIONS", reports: "REPORTS", admin: "ADMIN" };

function PortalInner() {
  const [axisOpen, setAxisOpen] = useState(false);
  const { liveContext, addSession, userRole, setUserRole, permissions, rinIdentity } = useAxisContext();
  // Filter: show item if role has the module OR the legacy page
  const navItems = ALL_NAV_ITEMS.filter(item =>
    (item.module && permissions.modules?.includes(item.module)) ||
    permissions.pages?.includes(item.page)
  ).map(item => ({
    ...item,
    label: item.altLabels?.[userRole] || item.label,
  }));

  return (
    <div className="portal-root" style={{ display: "flex", minHeight: "100vh", background: "#070D18", fontFamily: "'Courier New', monospace" }}>
      {/* Sidebar */}
      <nav style={{
        width: 240,
        minWidth: 240,
        background: "#0A1020",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <img src={logoIcon} alt="" style={{ width: 34, height: 34, flexShrink: 0 }} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{
              fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
              fontSize: 17, color: "#FFFFFF", letterSpacing: 1,
              fontWeight: 700,
            }}>
              CLAIM RUSH<span style={{ fontSize: 11, fontWeight: 500, verticalAlign: "super", marginLeft: 2, color: "rgba(255,255,255,0.85)" }}>TM</span>
            </div>
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.65)", letterSpacing: 2.5, marginTop: 4,
              fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontWeight: 500,
            }}>
              CLAIM INTELLIGENCE ENGINE
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", flex: 1 }}>
          {navItems.map((item, i) => {
            const prevGroup = i > 0 ? navItems[i - 1].group : null;
            const showDivider = item.group !== prevGroup && GROUP_LABELS[item.group];
            return (<div key={item.to}>
              {showDivider && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 2, fontWeight: 700, padding: "12px 16px 4px", fontFamily: "'Courier New', monospace" }}>
                  {GROUP_LABELS[item.group]}
                </div>
              )}
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 16px",
                borderRadius: "0 8px 8px 0",
                textDecoration: "none",
                fontSize: isActive ? 16 : 15,
                fontWeight: isActive ? 700 : 600,
                letterSpacing: 0.5,
                color: isActive ? "#FFFFFF" : C.muted,
                background: isActive ? "rgba(0,230,168,0.08)" : "transparent",
                borderLeft: isActive ? "3px solid #00E6A8" : "3px solid transparent",
                borderTop: "0px solid transparent", borderBottom: "0px solid transparent", borderRight: "0px solid transparent",
                boxShadow: isActive ? "0 0 20px rgba(0,230,168,0.12), inset 0 0 20px rgba(0,230,168,0.04)" : "none",
                transition: "all 0.2s ease",
                cursor: "pointer",
                fontFamily: "'Courier New', monospace",
              })}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </NavLink>
            </div>);
          })}

          {/* Divider */}
          <div style={{ height: 1, background: C.border, margin: "8px 4px" }} />

          {/* AXIS button in sidebar */}
          <button
            onClick={() => setAxisOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderRadius: 8,
              border: `1px solid ${axisOpen ? `${PURPLE}40` : "transparent"}`,
              background: axisOpen ? `${PURPLE}12` : "transparent",
              color: axisOpen ? PURPLE : C.muted,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: 0.5,
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
              transition: "all 0.2s ease",
              textAlign: "left",
              width: "100%",
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 5,
              background: `linear-gradient(135deg, ${PURPLE}, #7C3AED)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 900, color: "#fff",
              fontFamily: "'Courier New', monospace",
              letterSpacing: 0.5, flexShrink: 0,
            }}>
              AX
            </span>
            AXIS Coach
          </button>
        </div>

        {/* Bottom: Role Switcher + Version */}
        <div style={{ marginTop: "auto", borderTop: `1px solid ${C.border}` }}>
          {/* Role Switcher — DEV ONLY. Hidden when embedded by the RIN portal
              (rinIdentity is set when src=rin-portal handoff happened).
              Leaving this visible inside the embedded agent workspace would let
              an agent click ADMIN to escalate — real security hole, not UX. */}
          {!rinIdentity && (
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase", ...{ fontFamily: "'Courier New', monospace" }, fontWeight: 600, marginBottom: 6 }}>
                ROLE
              </div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {["super_admin", "home_office", "CP", "RVP", "agent", "agency"].map(role => (
                  <button
                    key={role}
                    onClick={() => setUserRole(role)}
                    style={{
                      flex: "1 1 30%", padding: "4px 0",
                      background: userRole === role ? `${ROLE_COLORS[role] || C.blue}15` : "transparent",
                      border: `1px solid ${userRole === role ? `${ROLE_COLORS[role] || C.blue}40` : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 4,
                      color: userRole === role ? (ROLE_COLORS[role] || C.blue) : "rgba(255,255,255,0.35)",
                      fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                      cursor: "pointer", fontFamily: "'Courier New', monospace",
                      transition: "all 0.2s",
                    }}
                  >
                    {{ super_admin: "ADMIN", home_office: "HO", CP: "CP", RVP: "RVP", agent: "AGT", agency: "AGNCY" }[role]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ padding: "10px 20px" }}>
            <div style={{ fontSize: 12, color: C.muted, letterSpacing: 0.5, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontWeight: 500 }}>
              v1.0 — CLAIMRUSH
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{
        flex: 1,
        marginLeft: 240,
        padding: "36px 48px",
        minHeight: "100vh",
        overflowY: "auto",
      }}>
        <Outlet />
      </main>

      {/* AXIS Live Overlay — above floating button */}
      {!axisOpen && <AxisLiveOverlay context={liveContext} onSessionEnd={addSession} />}

      {/* Floating AXIS Button */}
      {!axisOpen && (
        <button
          onClick={() => setAxisOpen(true)}
          style={{
            position: "fixed",
            bottom: 24, right: 24,
            width: 56, height: 56,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${PURPLE}, #7C3AED)`,
            border: "none",
            boxShadow: `0 4px 20px ${PURPLE}40, 0 0 40px ${PURPLE}15`,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 900,
            transition: "all 0.2s ease",
            fontFamily: "'Courier New', monospace",
            fontSize: 15, fontWeight: 900, color: "#fff",
            letterSpacing: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = `0 6px 28px ${PURPLE}60, 0 0 50px ${PURPLE}25`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 4px 20px ${PURPLE}40, 0 0 40px ${PURPLE}15`; }}
        >
          AX
        </button>
      )}

      {/* AXIS Coach Panel */}
      <AxisCoach open={axisOpen} onClose={() => setAxisOpen(false)} />
    </div>
  );
}

export default function PortalLayout() {
  return (
    <AxisProvider>
      <PortalInner />
    </AxisProvider>
  );
}
