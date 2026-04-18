import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { C } from "./theme";
import AxisCoach from "./AxisCoach";
import AxisLiveOverlay from "./AxisLiveOverlay";
import { AxisProvider, useAxisContext } from "./AxisContext";
import logoIcon from "../assets/logo/claimrush-icon.svg";
import { getNavForRole } from "./roleNav";

const PURPLE = "#A855F7";

// ── Live Ticker ─────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  { icon: "🔥", text: "Structure Fire — Dallas TX", time: "2m ago", color: "#E05050" },
  { icon: "⛈️", text: "Severe Storm Warning — Tarrant County", time: "5m ago", color: "#C9A84C" },
  { icon: "📋", text: "New Lead Assigned — Maria Gonzalez → Agent Torres", time: "8m ago", color: "#00E6A8" },
  { icon: "✅", text: "Client Signed — Park Residence WTP Platinum", time: "12m ago", color: "#00E6A8" },
  { icon: "📞", text: "Marcus completed 3 outbound calls — FL region", time: "15m ago", color: "#3B82F6" },
  { icon: "💧", text: "Flood Advisory — Harris County TX", time: "18m ago", color: "#3B82F6" },
  { icon: "🏠", text: "Roof Damage Detected — Satellite Analysis — Bucks County PA", time: "22m ago", color: "#C9A84C" },
  { icon: "📄", text: "Claim Filed — Johnson Residence — Fire Damage", time: "25m ago", color: "#00E6A8" },
];

function LiveTicker() {
  return (
    <div style={{
      background: "linear-gradient(90deg, #0D1526 0%, #111B30 50%, #0D1526 100%)",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      padding: "12px 0",
      overflow: "hidden",
      whiteSpace: "nowrap",
      position: "relative",
    }}>
      {/* Left fade */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 40, background: "linear-gradient(90deg, #0D1526 0%, transparent 100%)", zIndex: 2 }} />
      {/* Right fade */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 40, background: "linear-gradient(270deg, #0D1526 0%, transparent 100%)", zIndex: 2 }} />

      <div style={{
        display: "inline-flex",
        gap: 12,
        animation: "ticker-scroll 50s linear infinite",
        paddingLeft: "100%",
      }}>
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} style={{
            fontSize: 13,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 4,
            transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            <span style={{ color: item.color, fontWeight: 600 }}>{item.text}</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{item.time}</span>
            <span style={{ color: "rgba(255,255,255,0.08)", fontSize: 16, margin: "0 4px", fontWeight: 300 }}>|</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

const ROLE_COLORS = { super_admin: "#FF6B6B", home_office: "#E05050", CP: "#00E6A8", RVP: C.gold, agent: C.blue, agency: "#A78BFA" };
const GROUP_LABELS = { core: null, operations: "OPERATIONS", reports: "REPORTS", admin: "ADMIN" };

function PortalInner() {
  const [axisOpen, setAxisOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isIframePage = location.pathname.includes('/portal/rin/');
  const { liveContext, addSession, userRole, setUserRole, permissions, rinIdentity } = useAxisContext();

  // User display info from localStorage
  const crUserRaw = localStorage.getItem("cr_user");
  let displayName = "";
  try { const u = JSON.parse(crUserRaw || "{}"); displayName = u.display_name || u.email || ""; } catch {}

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("cr_role");
    localStorage.removeItem("cr_user");
    localStorage.removeItem("rin-readonly-mode");
    navigate("/login", { replace: true });
  }

  // Phase 5: role-based nav from roleNav.js
  const navGroups = getNavForRole(userRole);

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

        {/* Nav Items — Phase 5 role-based */}
        <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", flex: 1 }}>
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.group && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 2, fontWeight: 700, padding: "12px 16px 4px", fontFamily: "'Courier New', monospace" }}>
                  {group.group}
                </div>
              )}
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  style={({ isActive }) => ({
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 16px",
                    borderRadius: "0 8px 8px 0",
                    textDecoration: "none",
                    fontSize: isActive ? 15 : 14,
                    fontWeight: isActive ? 700 : 500,
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
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                    <span>{item.label}</span>
                    {item.sub && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 0.5, fontWeight: 500 }}>{item.sub}</span>}
                  </span>
                  {item.readonly && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginLeft: "auto", letterSpacing: 1, fontWeight: 700 }}>VIEW</span>}
                  {item.comingSoon && <span style={{ fontSize: 8, color: "#A855F7", marginLeft: "auto", letterSpacing: 1, fontWeight: 700 }}>SOON</span>}
                </NavLink>
              ))}
            </div>
          ))}

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
              C
            </span>
            Coach
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
          {/* User badge + logout */}
          {displayName && (
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "'Courier New', monospace", fontWeight: 500, marginBottom: 2 }}>
                {displayName}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Courier New', monospace", letterSpacing: 1, textTransform: "uppercase" }}>
                {userRole}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 16px",
              background: "transparent", border: "none", borderTop: `1px solid ${C.border}`,
              color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 500,
              cursor: "pointer", fontFamily: "'Courier New', monospace",
              transition: "color 0.15s",
              textAlign: "left",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
          >
            <span style={{ fontSize: 15 }}>{"\u{1F6AA}"}</span>
            Log out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{
        flex: 1,
        marginLeft: 240,
        minHeight: "100vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Live ticker bar */}
        <LiveTicker />
        <div style={{ padding: "36px 48px", flex: 1 }}>
          <Outlet />
        </div>
      </main>

      {/* Coach Live Overlay — hidden on iframe pages to avoid duplication */}
      {!axisOpen && !isIframePage && <AxisLiveOverlay context={liveContext} onSessionEnd={addSession} />}

      {/* Floating Coach Button — hidden on iframe pages */}
      {!axisOpen && !isIframePage && (
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
