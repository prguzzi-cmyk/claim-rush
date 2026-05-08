import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { C } from "./theme";
import AxisCoach from "./AxisCoach";
import AxisLiveOverlay from "./AxisLiveOverlay";
import { AxisProvider, useAxisContext } from "./AxisContext";
import logoIcon from "../assets/logo/claimrush-icon.svg";
import { getNavForRole } from "./roleNav";
import UserMenu from "./UserMenu";

// ── Permission gating helpers ───────────────────────────────────────────────
// Items in roleNav carry an optional `page` key that maps to the vocabulary
// returned by /v1/users/me/permissions. If the item has a page key, it must
// be present in `permissions.pages` to render — except `dashboard`, which is
// always allowed (acts as the safe redirect target). Items without a page
// key are not "pages" in the RIN-permission sense and pass through.
const ALWAYS_ALLOWED_PAGES = new Set(["dashboard"]);

function isPageAllowed(pageKey, permissions) {
  if (!pageKey) return true;
  if (ALWAYS_ALLOWED_PAGES.has(pageKey)) return true;
  // Safety: if permissions or pages missing (shouldn't happen — the merge in
  // AxisContext always provides a fallback list — but defend anyway), allow.
  if (!permissions || !Array.isArray(permissions.pages)) return true;
  return permissions.pages.includes(pageKey);
}

// Build a path → page-key reverse map by walking the nav tables. Used by
// the route guard (useEffect) so direct URL entry to a gated path bounces
// to dashboard if the user's pages list excludes it.
function buildPathToPageMap(navGroups) {
  const map = {};
  for (const group of navGroups || []) {
    for (const item of group.items || []) {
      if (item.page && item.to) map[item.to] = item.page;
    }
  }
  return map;
}

const PURPLE = "#A855F7";

// ── Live Ticker ─────────────────────────────────────────────────────────────

// Neutral system-status indicators — describe the platform itself, not
// fabricated business events. Demo-safe: no fake closed claims, no fake
// signed clients, no fake call counts, no fake revenue. Each item's
// "time" field carries a status word ("Active", "Online", etc.) so the
// scroll feels live without making claims about user activity.
const TICKER_ITEMS = [
  { icon: "🟢", text: "System Health",         time: "Operational", color: "#00E6A8" },
  { icon: "🔥", text: "Fire Incident Feed",    time: "Active",      color: "#E05050" },
  { icon: "⛈️", text: "Storm Monitoring",      time: "Enabled",     color: "#C9A84C" },
  { icon: "🛰️", text: "Intelligence Network", time: "Online",      color: "#A855F7" },
  { icon: "📡", text: "Lead Routing",          time: "Operational", color: "#00E6A8" },
  { icon: "🗺️", text: "Territory Sync",        time: "Complete",    color: "#3B82F6" },
  { icon: "🤖", text: "AI Operators",          time: "Standing By", color: "#A855F7" },
  { icon: "🔒", text: "Compliance Layer",      time: "Active",      color: "#3B82F6" },
];

function LiveTicker() {
  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(90deg, #0B1220 0%, #0F1A2E 50%, #0B1220 100%)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: "10px 0",
      overflow: "hidden",
      whiteSpace: "nowrap",
      boxShadow: "inset 0 1px 0 rgba(0,230,168,0.06)",
    }}>
      {/* Top edge accent — subtle green line marks this as live system telemetry */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent 0%, rgba(0,230,168,0.30) 30%, rgba(0,230,168,0.20) 70%, transparent 100%)",
        boxShadow: "0 0 6px rgba(0,230,168,0.20)",
        pointerEvents: "none",
      }} />
      {/* LIVE prefix marker — fixed position on the left */}
      <div style={{
        position: "absolute", left: 14, top: "50%",
        transform: "translateY(-50%)",
        zIndex: 3,
        display: "flex", alignItems: "center", gap: 6,
        padding: "3px 9px",
        background: "linear-gradient(90deg, rgba(11,18,32,1) 0%, rgba(11,18,32,0.95) 100%)",
        border: "1px solid rgba(0,230,168,0.30)",
        borderRadius: 3,
        boxShadow: "0 0 10px rgba(0,230,168,0.18)",
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: 3,
          background: "#00E6A8",
          boxShadow: "0 0 6px rgba(0,230,168,0.85)",
          animation: "liveDotPulse 1.6s ease-in-out infinite",
          display: "inline-block",
        }} />
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
          color: "#00E6A8", textTransform: "uppercase",
          fontFamily: "'Courier New', monospace",
        }}>
          Live · Telemetry
        </span>
      </div>
      {/* Left fade — pushed right to clear the LIVE marker */}
      <div style={{ position: "absolute", left: 130, top: 0, bottom: 0, width: 40, background: "linear-gradient(90deg, #0B1220 0%, transparent 100%)", zIndex: 2 }} />
      {/* Right fade */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 40, background: "linear-gradient(270deg, #0B1220 0%, transparent 100%)", zIndex: 2 }} />

      <div style={{
        display: "inline-flex",
        gap: 14,
        animation: "ticker-scroll 50s linear infinite",
        paddingLeft: "100%",
      }}>
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} style={{
            fontSize: 12,
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
            color: "rgba(255,255,255,0.78)",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            flexShrink: 0,
            cursor: "pointer",
            padding: "3px 8px",
            borderRadius: 4,
            transition: "all 0.18s",
            letterSpacing: 0.5,
          }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${item.color}10`;
              e.currentTarget.style.boxShadow = `0 0 10px ${item.color}25`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: 3,
              background: item.color,
              boxShadow: `0 0 6px ${item.color}aa`,
              display: "inline-block", flexShrink: 0,
            }} />
            <span style={{ color: item.color, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", fontSize: 11 }}>{item.text}</span>
            <span style={{
              color: "rgba(255,255,255,0.55)", fontSize: 10,
              fontWeight: 700, letterSpacing: 0.8,
              padding: "1px 6px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 2,
            }}>{item.time.toUpperCase()}</span>
            <span style={{ color: "rgba(255,255,255,0.10)", fontSize: 14, marginLeft: 4, fontWeight: 300 }}>·</span>
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
  const rawNavGroups = getNavForRole(userRole);

  // Step 4: filter nav items by RIN permissions. Items with a `page` key
  // that's not in permissions.pages disappear; items without a page key
  // pass through (native ClaimRush features / RIN iframe wrappers gated
  // server-side). Empty groups (all items filtered out) are dropped so
  // we don't render an orphaned section header.
  const navGroups = rawNavGroups
    .map((group) => ({
      ...group,
      items: (group.items || []).filter((item) => isPageAllowed(item.page, permissions)),
    }))
    .filter((group) => (group.items || []).length > 0);

  // Step 4: route guard — if the current path corresponds to a gated page
  // the user's permissions don't include, redirect to /portal (dashboard).
  // We walk ALL roles' nav tables to build the path→page map so a
  // role-mismatched direct URL still gets caught (not just the current
  // role's items).
  useEffect(() => {
    if (!permissions || !Array.isArray(permissions.pages)) return;
    const allRolesPathMap = {
      ...buildPathToPageMap(getNavForRole("agent")),
      ...buildPathToPageMap(getNavForRole("RVP")),
      ...buildPathToPageMap(getNavForRole("CP")),
      ...buildPathToPageMap(getNavForRole("home_office")),
    };
    const currentPath = location.pathname.replace(/\/$/, "") || location.pathname;
    const pageKey = allRolesPathMap[currentPath] || allRolesPathMap[location.pathname];
    if (pageKey && !isPageAllowed(pageKey, permissions)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[PortalLayout] route guard: page='${pageKey}' not in permissions.pages — redirecting to dashboard`,
      );
      navigate("/portal", { replace: true });
    }
  }, [location.pathname, permissions, navigate]);

  return (
    <div className="portal-root" style={{ display: "flex", minHeight: "100vh", background: "#070D18", fontFamily: "'Courier New', monospace" }}>
      {/* Sidebar — premium intelligence-platform shell with ambient depth.
          Acts as a real "system rail" rather than a flat menu strip. */}
      <nav style={{
        width: 240,
        minWidth: 240,
        background: "linear-gradient(180deg, #0B1426 0%, #080F1E 55%, #060B16 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "1px 0 0 rgba(0,230,168,0.08), 4px 0 24px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
        overflow: "hidden",
      }}>
        {/* Global keyframes — mounted once at the shell so every portal
            route inherits the pulse/glow language without re-injection. */}
        <style>{`
          @keyframes liveDotPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.82); }
          }
          @keyframes edgeGlow {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.55; }
          }
          /* Sidebar nav-item hover affordance — uses CSS variables so we
             can drive subtle hover states without inline style mutations. */
          .nav-item-hover { --nv-bg: transparent; --nv-edge: transparent; }
          .nav-item-hover:hover { --nv-bg: rgba(255,255,255,0.025); --nv-edge: rgba(0,230,168,0.40); }
        `}</style>
        {/* Ambient depth — radial green wash anchored top, purple at bottom. */}
        <div style={{
          position: "absolute", top: -120, left: -60,
          width: 320, height: 320,
          background: "radial-gradient(circle, rgba(0,230,168,0.07) 0%, transparent 65%)",
          pointerEvents: "none", zIndex: 0,
        }} />
        <div style={{
          position: "absolute", bottom: -120, left: -80,
          width: 320, height: 320,
          background: "radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 65%)",
          pointerEvents: "none", zIndex: 0,
        }} />
        {/* Content layer — sits above the ambient gradients. */}
        <div style={{
          position: "relative", zIndex: 1,
          display: "flex", flexDirection: "column",
          width: "100%", height: "100%",
        }}>
        {/* Logo / system identity strip — elevated bg + green accent edge
            + pulsing online indicator. Reads as the platform's "system
            online" beacon, not a SaaS logo placeholder. */}
        <div style={{
          position: "relative",
          padding: "18px 18px 16px",
          background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          {/* Bottom green accent edge — system identity marker */}
          <div style={{
            position: "absolute", bottom: 0, left: 14, right: 14, height: 1,
            background: "linear-gradient(90deg, rgba(0,230,168,0.40) 0%, rgba(0,230,168,0.15) 50%, transparent 100%)",
            boxShadow: "0 0 8px rgba(0,230,168,0.25)",
            pointerEvents: "none",
          }} />
          <img src={logoIcon} alt="" style={{ width: 34, height: 34, flexShrink: 0 }} />
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
              fontSize: 14, color: "#FFFFFF", letterSpacing: 1.5,
              fontWeight: 800,
              textTransform: "uppercase",
              textShadow: "0 0 14px rgba(0,230,168,0.18)",
            }}>
              Unified Public<br />Advocacy
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 6,
              fontSize: 9, color: "rgba(0,230,168,0.85)", letterSpacing: 1.6,
              fontFamily: "'Courier New', monospace", fontWeight: 800,
              textTransform: "uppercase",
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: 3,
                background: "#00E6A8",
                boxShadow: "0 0 6px rgba(0,230,168,0.85)",
                animation: "liveDotPulse 1.6s ease-in-out infinite",
                display: "inline-block",
              }} />
              System Online
            </div>
          </div>
        </div>

        {/* Nav Items — Phase 5 role-based */}
        <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", flex: 1 }}>
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.group && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "14px 16px 6px",
                }}>
                  <span style={{
                    width: 4, height: 4, borderRadius: 2,
                    background: "#00E6A8",
                    boxShadow: "0 0 5px rgba(0,230,168,0.65)",
                    display: "inline-block", flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 9, color: "rgba(255,255,255,0.50)",
                    letterSpacing: 2, fontWeight: 800,
                    fontFamily: "'Courier New', monospace",
                    textTransform: "uppercase",
                  }}>
                    {group.group}
                  </span>
                  <span style={{
                    flex: 1, height: 1,
                    background: "linear-gradient(90deg, rgba(0,230,168,0.20) 0%, rgba(255,255,255,0.04) 60%, transparent 100%)",
                  }} />
                </div>
              )}
              {group.items.map(item => {
                // Per-item operational accent (intelligence modules carry their
                // own color identity; nav items without an accent fall back to
                // the platform green).
                const accent = item.accent || "#00E6A8";
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className="nav-item-hover"
                    style={({ isActive }) => ({
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 16px",
                      borderRadius: "0 8px 8px 0",
                      textDecoration: "none",
                      fontSize: isActive ? 14 : 13,
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: 0.5,
                      color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.55)",
                      background: isActive
                        ? `linear-gradient(90deg, ${accent}1f 0%, ${accent}05 60%, transparent 100%)`
                        : "var(--nv-bg, transparent)",
                      borderLeft: isActive ? `4px solid ${accent}` : "4px solid transparent",
                      borderTop: "0px solid transparent", borderBottom: "0px solid transparent", borderRight: "0px solid transparent",
                      boxShadow: isActive
                        ? `0 0 24px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.06), inset 4px 0 12px ${accent}1a`
                        : "none",
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                      fontFamily: "'Courier New', monospace",
                      textShadow: isActive ? `0 0 10px ${accent}59` : "none",
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <span style={{
                          fontSize: 16,
                          filter: isActive
                            ? `drop-shadow(0 0 6px ${accent}aa)`
                            : "drop-shadow(0 0 4px rgba(255,255,255,0.10))",
                          transition: "filter 0.2s ease",
                        }}>{item.icon}</span>
                        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0 }}>
                          <span>{item.label}</span>
                          {item.sub && (
                            <span style={{
                              fontSize: 9,
                              color: isActive ? `${accent}cc` : "rgba(255,255,255,0.35)",
                              letterSpacing: 1.2, fontWeight: 700,
                              textTransform: "uppercase",
                              transition: "color 0.2s ease",
                            }}>
                              {item.sub}
                            </span>
                          )}
                        </span>
                        {item.readonly && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", marginLeft: "auto", letterSpacing: 1.2, fontWeight: 800, padding: "2px 6px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3 }}>VIEW</span>}
                        {item.comingSoon && <span style={{ fontSize: 8, color: "#A855F7", marginLeft: "auto", letterSpacing: 1.2, fontWeight: 800, padding: "2px 6px", background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.35)", borderRadius: 3 }}>SOON</span>}
                        {/* Active live-pulse dot — uses the item accent so each
                            intel route shows its own operational color when current. */}
                        {isActive && !item.readonly && !item.comingSoon && (
                          <span style={{
                            marginLeft: "auto",
                            width: 6, height: 6, borderRadius: 3,
                            background: accent,
                            boxShadow: `0 0 8px ${accent}, 0 0 14px ${accent}66`,
                            animation: "liveDotPulse 1.6s ease-in-out infinite",
                            display: "inline-block",
                          }} />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}

          {/* Divider */}
          <div style={{ height: 1, background: C.border, margin: "8px 4px" }} />

          {/* AXIS Coach — embedded intelligence module. Reads as a real AI
              ops companion strip rather than a chat-button toy. Permanent
              purple ambient + pulsing online indicator. */}
          <button
            onClick={() => setAxisOpen(true)}
            onMouseEnter={axisOpen ? undefined : (e) => {
              e.currentTarget.style.boxShadow = `0 0 24px ${PURPLE}30, inset 0 1px 0 rgba(255,255,255,0.05)`;
              e.currentTarget.style.borderColor = `${PURPLE}55`;
            }}
            onMouseLeave={axisOpen ? undefined : (e) => {
              e.currentTarget.style.boxShadow = `0 0 18px ${PURPLE}1a, inset 0 1px 0 rgba(255,255,255,0.04)`;
              e.currentTarget.style.borderColor = `${PURPLE}30`;
            }}
            style={{
              position: "relative",
              display: "flex", flexDirection: "column", alignItems: "stretch",
              gap: 8,
              padding: "13px 12px 11px",
              borderRadius: 10,
              border: `1px solid ${axisOpen ? `${PURPLE}66` : `${PURPLE}30`}`,
              background: axisOpen
                ? `linear-gradient(135deg, ${PURPLE}1a 0%, ${PURPLE}05 100%)`
                : `linear-gradient(135deg, ${PURPLE}0e 0%, ${PURPLE}03 100%)`,
              color: axisOpen ? PURPLE : "rgba(168,85,247,0.85)",
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
              transition: "all 0.2s ease",
              textAlign: "left",
              width: "100%",
              overflow: "hidden",
              boxShadow: axisOpen
                ? `0 0 26px ${PURPLE}38, inset 0 1px 0 rgba(255,255,255,0.05)`
                : `0 0 18px ${PURPLE}1a, inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
          >
            {/* Top accent */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: PURPLE,
              boxShadow: `0 0 8px ${PURPLE}aa`,
              pointerEvents: "none",
            }} />
            {/* Header row: avatar + identity */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 6,
                background: `linear-gradient(135deg, ${PURPLE}, #7C3AED)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 900, color: "#fff",
                fontFamily: "'Courier New', monospace",
                letterSpacing: 0.5, flexShrink: 0,
                boxShadow: `0 0 12px ${PURPLE}50, inset 0 1px 0 rgba(255,255,255,0.20)`,
              }}>
                C
              </span>
              <div style={{ minWidth: 0, lineHeight: 1.2 }}>
                <div style={{
                  fontSize: 12, fontWeight: 800, letterSpacing: 1.2,
                  color: "#fff", textTransform: "uppercase",
                  textShadow: `0 0 12px ${PURPLE}55`,
                }}>
                  AXIS Coach
                </div>
                <div style={{
                  fontSize: 8, fontWeight: 800, letterSpacing: 1.4,
                  color: PURPLE, textTransform: "uppercase", marginTop: 2,
                }}>
                  AI Companion
                </div>
              </div>
            </div>
            {/* Bottom strip: ● ONLINE · MONITORING — pulsing live indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 8px",
              background: "rgba(0,0,0,0.30)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 5,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: 3,
                background: "#00E6A8",
                boxShadow: "0 0 6px rgba(0,230,168,0.85)",
                animation: "liveDotPulse 1.6s ease-in-out infinite",
                display: "inline-block", flexShrink: 0,
              }} />
              <span style={{
                fontSize: 8, fontWeight: 800, letterSpacing: 1.6,
                color: "rgba(0,230,168,0.85)",
                fontFamily: "'Courier New', monospace",
                textTransform: "uppercase",
              }}>
                Online · Monitoring
              </span>
            </div>
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
          {/* Operator badge — role-colored avatar circle + name + role tag.
              Reads as the active operator's identity, not a CRM user-menu line. */}
          {displayName && (() => {
            const roleColor = ROLE_COLORS[userRole] || C.blue;
            const initial = (displayName.match(/\b\w/g) || ["?"]).slice(0, 2).join("").toUpperCase();
            return (
              <div style={{
                padding: "12px 14px",
                borderTop: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.015)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: `linear-gradient(135deg, ${roleColor}40 0%, ${roleColor}15 100%)`,
                  border: `1px solid ${roleColor}66`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: roleColor,
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: 0.5, flexShrink: 0,
                  boxShadow: `0 0 10px ${roleColor}28`,
                }}>
                  {initial}
                </span>
                <div style={{ minWidth: 0, lineHeight: 1.2, overflow: "hidden" }}>
                  <div style={{
                    fontSize: 12, color: "#fff", fontWeight: 700,
                    fontFamily: "'Courier New', monospace",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {displayName}
                  </div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
                    color: roleColor, textTransform: "uppercase",
                    fontFamily: "'Courier New', monospace", marginTop: 3,
                  }}>
                    <span style={{
                      width: 4, height: 4, borderRadius: 2,
                      background: roleColor,
                      boxShadow: `0 0 5px ${roleColor}aa`,
                      display: "inline-block",
                    }} />
                    {userRole}
                  </div>
                </div>
              </div>
            );
          })()}
          <NavLink to="/portal/profile" style={({ isActive }) => ({
            display: "flex", alignItems: "center", gap: 10,
            width: "100%", padding: "8px 16px",
            background: isActive ? "rgba(255,255,255,0.05)" : "transparent",
            color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
            fontSize: 13, fontWeight: 500, textDecoration: "none",
            fontFamily: "'Courier New', monospace", transition: "color 0.15s",
          })}>
            <span style={{ fontSize: 14 }}>&#128100;</span>
            Profile
          </NavLink>
          <NavLink to="/portal/settings" style={({ isActive }) => ({
            display: "flex", alignItems: "center", gap: 10,
            width: "100%", padding: "8px 16px",
            background: isActive ? "rgba(255,255,255,0.05)" : "transparent",
            color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
            fontSize: 13, fontWeight: 500, textDecoration: "none",
            fontFamily: "'Courier New', monospace", transition: "color 0.15s",
          })}>
            <span style={{ fontSize: 14 }}>&#9881;&#65039;</span>
            Settings
          </NavLink>
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
        {/* Top operational bar — cinematic command-bar identity strip.
            Sticky, with sub-pixel green edge accent + system online dot. */}
        <div style={{
          position: "sticky", top: 0, zIndex: 40,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "9px 24px",
          background: "linear-gradient(90deg, rgba(10,16,32,0.92) 0%, rgba(13,21,40,0.94) 50%, rgba(10,16,32,0.92) 100%)",
          borderBottom: "1px solid rgba(0,230,168,0.10)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontFamily: "'Courier New', monospace",
              fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
              textTransform: "uppercase",
              color: "#00E6A8",
              padding: "3px 9px",
              background: "rgba(0,230,168,0.08)",
              border: "1px solid rgba(0,230,168,0.30)",
              borderRadius: 3,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: 3,
                background: "#00E6A8",
                boxShadow: "0 0 6px rgba(0,230,168,0.85)",
                animation: "liveDotPulse 1.6s ease-in-out infinite",
                display: "inline-block",
              }} />
              UPA Network · Online
            </span>
            <span style={{
              fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
              fontSize: 11, fontWeight: 600, letterSpacing: 1.4,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.60)",
            }}>
              Powered by <span style={{ color: "#fff", fontWeight: 800, textShadow: "0 0 12px rgba(0,230,168,0.20)" }}>Unified Public Advocacy</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
              textTransform: "uppercase",
              color: C.gold,
              padding: "3px 9px",
              background: `${C.gold}10`,
              border: `1px solid ${C.gold}38`,
              borderRadius: 3,
              whiteSpace: "nowrap",
              boxShadow: `0 0 10px ${C.gold}18`,
            }}>
              ACI · Licensed Operator
            </span>
            <UserMenu />
          </div>
        </div>
        {/* Live ticker bar */}
        <LiveTicker />
        <div style={{ padding: "36px 48px", flex: 1 }}>
          <Outlet />
        </div>
        {/* Footer */}
        <div style={{
          padding: "12px 24px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
          fontSize: 10,
          color: "rgba(255,255,255,0.3)",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          letterSpacing: 0.5,
        }}>
          Powered by <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>Unified Public Advocacy</span> · ACI Adjustment Group™ Licensed Operator · &copy; {new Date().getFullYear()}
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
