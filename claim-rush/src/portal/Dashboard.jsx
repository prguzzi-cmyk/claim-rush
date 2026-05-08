import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";
import RetentionWidgets from "./RetentionWidgets";
import { apiJson, apiFetch } from "../lib/api";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── SHARED COMPONENTS ───────────────────────────────────────────────────────

function KPI({ label, value, color, alert, to, loading, notConnected }) {
  const navigate = useNavigate();
  const clickable = !!to && !notConnected && !loading;
  const muted = notConnected || loading;
  const valueText = loading ? "···" : (notConnected ? "--" : value);
  const accent = alert ? "#E05050" : (color || "#00E6A8");
  // Multi-layer base shadow + ring. Hover layers in stronger lift + ambient.
  const baseShadow = `0 6px 18px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.04), 0 0 22px ${accent}14`;
  const hoverShadow = `0 14px 36px rgba(0,0,0,0.55), 0 0 0 1px ${accent}40, 0 0 36px ${accent}28`;
  return (
    <div
      title={notConnected ? "Not Connected Yet" : undefined}
      onClick={clickable ? () => navigate(to) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") navigate(to); } : undefined}
      style={{
        position: "relative",
        background: "linear-gradient(135deg, #1A2844 0%, #131C2F 100%)",
        border: `1px solid ${alert ? "#E0505040" : "rgba(255,255,255,0.10)"}`,
        borderRadius: 10,
        padding: "18px 20px 20px",
        cursor: clickable ? "pointer" : "default",
        transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
        opacity: notConnected ? 0.55 : 1,
        overflow: "hidden",
        boxShadow: baseShadow,
      }}
      onMouseEnter={clickable ? (e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = `${accent}66`;
        e.currentTarget.style.boxShadow = hoverShadow;
      } : undefined}
      onMouseLeave={clickable ? (e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = alert ? "#E0505040" : "rgba(255,255,255,0.10)";
        e.currentTarget.style.boxShadow = baseShadow;
      } : undefined}
    >
      {/* Top accent — color-encoded, glowing. Dimmed on muted KPIs. */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: muted ? "rgba(255,255,255,0.20)" : accent,
        boxShadow: muted ? "none" : `0 0 10px ${accent}88`,
        pointerEvents: "none",
        animation: alert ? "edgeGlow 2.4s ease-in-out infinite" : "none",
      }} />
      {/* Ambient corner glow — radial wash from top-right, color-tinted. */}
      {!muted && (
        <div style={{
          position: "absolute", top: -50, right: -50,
          width: 200, height: 200,
          background: `radial-gradient(circle, ${accent}20 0%, transparent 65%)`,
          pointerEvents: "none",
          opacity: 0.7,
          animation: alert ? "kpiAmbient 3s ease-in-out infinite" : "none",
        }} />
      )}
      <div style={{
        position: "relative", zIndex: 2,
        fontSize: 11, color: alert ? "#E05050" : "rgba(255,255,255,0.55)",
        letterSpacing: 1.2, textTransform: "uppercase", ...mono, fontWeight: 700,
        display: "flex", alignItems: "center", gap: 7,
      }}>
        {alert && (
          <span style={{
            width: 6, height: 6, borderRadius: 3,
            background: "#E05050",
            boxShadow: "0 0 8px rgba(224,80,80,0.85)",
            display: "inline-block",
            animation: "liveDotPulse 1.6s ease-in-out infinite",
          }} />
        )}
        {label}
      </div>
      <div style={{
        position: "relative", zIndex: 2,
        fontSize: 32,
        color: muted ? "rgba(255,255,255,0.35)" : "#FFFFFF",
        fontWeight: 800,
        ...mono,
        marginTop: 8,
        letterSpacing: -0.3,
        textShadow: muted ? "none" : `0 0 18px ${accent}55, 0 0 6px ${accent}30`,
        transition: "opacity 250ms ease, color 250ms ease",
        opacity: loading ? 0.4 : 1,
        lineHeight: 1.1,
      }}>{valueText}</div>
    </div>
  );
}

function Panel({ title, color, children, action, onAction }) {
  const accent = color || "#00E6A8";
  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(180deg, #151D2E 0%, #0F1622 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      boxShadow: `0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 22px ${accent}14`,
      overflow: "hidden",
    }}>
      {/* Top accent — colored glow bar, anchors the panel as a "system module". */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: accent,
        boxShadow: `0 0 8px ${accent}aa`,
        pointerEvents: "none",
      }} />
      {title && (
        <div style={{
          padding: "12px 20px",
          background: "rgba(255,255,255,0.025)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{
              width: 7, height: 7, borderRadius: 4,
              background: accent,
              boxShadow: `0 0 7px ${accent}cc`,
              display: "inline-block",
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 800,
              ...mono, letterSpacing: 1.4, textTransform: "uppercase",
            }}>{title}</span>
          </div>
          {action && (
            <button
              onClick={onAction}
              style={{
                padding: "4px 12px",
                background: "rgba(0,230,168,0.12)",
                border: "1px solid rgba(0,230,168,0.40)",
                borderRadius: 5,
                color: "#00E6A8",
                fontSize: 10, fontWeight: 800, letterSpacing: 0.8,
                cursor: "pointer", ...mono,
                boxShadow: "0 0 10px rgba(0,230,168,0.20)",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(0,230,168,0.18)";
                e.currentTarget.style.boxShadow = "0 0 16px rgba(0,230,168,0.35)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(0,230,168,0.12)";
                e.currentTarget.style.boxShadow = "0 0 10px rgba(0,230,168,0.20)";
              }}
            >
              {action}
            </button>
          )}
        </div>
      )}
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function AttentionItem({ severity, text, sub }) {
  const c = severity === "high" ? "#E05050" : severity === "medium" ? C.gold : "rgba(255,255,255,0.45)";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: c, flexShrink: 0, marginTop: 4, boxShadow: severity === "high" ? `0 0 6px ${c}60` : "none" }} />
      <div>
        <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500 }}>{text}</div>
        {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function EarningsRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", ...mono }}>{label}</span>
      <span style={{ fontSize: 13, color: color || "#FFFFFF", ...mono, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ── EARNINGS PANEL (shared across roles) ────────────────────────────────────

function EarningsPanel({ role }) {
  const [tab, setTab] = useState("overview");
  const tabs = [{ key: "overview", label: "Overview" }, { key: "pending", label: "Pending" }, { key: "paid", label: "Paid" }];

  return (
    <Panel title="EARNINGS" color="#00E6A8">
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "5px 12px", borderRadius: 5,
            background: tab === t.key ? "rgba(0,230,168,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${tab === t.key ? "rgba(0,230,168,0.30)" : "rgba(255,255,255,0.08)"}`,
            color: tab === t.key ? "#00E6A8" : "rgba(255,255,255,0.55)",
            fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {role === "agent" && (
            <>
              <EarningsRow label="This Week" value="$1,420" color="#00E6A8" />
              <EarningsRow label="This Month" value="$2,840" />
              <EarningsRow label="Claims Commission" value="$1,950" />
              <EarningsRow label="Plan Sales" value="$890" />
            </>
          )}
          {role === "RVP" && (
            <>
              <EarningsRow label="Licensing Overrides" value="$400" color={PURPLE} />
              <EarningsRow label="Production Overrides" value="$520" color="#00E6A8" />
              <EarningsRow label="Direct Production" value="$3,400" />
              <EarningsRow label="Total This Month" value="$4,320" color="#FFFFFF" />
            </>
          )}
          {role === "CP" && (
            <>
              <EarningsRow label="Licensing Overrides" value="$625" color={PURPLE} />
              <EarningsRow label="Production Overrides" value="$1,000" color="#00E6A8" />
              <EarningsRow label="Direct Production" value="$3,840" />
              <EarningsRow label="Total This Month" value="$5,465" color="#FFFFFF" />
            </>
          )}
        </>
      )}
      {tab === "pending" && (
        <>
          <EarningsRow label="Available to Pay" value={role === "agent" ? "$948" : role === "RVP" ? "$760" : "$1,465"} color="#00E6A8" />
          <EarningsRow label="Awaiting Approval" value={role === "agent" ? "$478" : "$840"} color={C.gold} />
          <EarningsRow label="Next Payout" value="April 1, 2026" />
          <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.45)", ...mono }}>Payouts process bi-monthly via ACH</div>
        </>
      )}
      {tab === "paid" && (
        <>
          <EarningsRow label="Mar 18 Payout" value={role === "agent" ? "$1,598" : role === "RVP" ? "$1,970" : "$1,800"} />
          <EarningsRow label="Mar 3 Payout" value={role === "agent" ? "$880" : role === "RVP" ? "$780" : "$1,200"} />
          <EarningsRow label="Feb 18 Payout" value={role === "agent" ? "$720" : role === "RVP" ? "$640" : "$920"} />
          <EarningsRow label="Total YTD" value={role === "agent" ? "$3,198" : role === "RVP" ? "$3,390" : "$3,920"} color="#00E6A8" />
        </>
      )}
    </Panel>
  );
}

// ── AGENT DASHBOARD (Phase 4: wired to real backend data) ──────────────────

function AgentDash({ navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiJson("/dashboard/agent-summary")
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e?.status ?? e?.detail ?? e)); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: C.muted, ...mono, padding: 40 }}>Loading dashboard...</div>;
  if (error) return <div style={{ color: "#E05050", ...mono, padding: 40 }}>Failed to load dashboard: {error}</div>;

  const d = data;
  const fmtCurrency = (v) => v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "$0";

  // Build reporting chain string
  const chain = [
    d.reporting_rvp ? `RVP ${d.reporting_rvp.name}` : null,
    d.reporting_cp ? `CP ${d.reporting_cp.name}` : null,
  ].filter(Boolean).join(" → ");

  return (
    <>
      {/* Identity hero — cinematic blue treatment for licensed agent. */}
      <div style={{
        position: "relative",
        marginBottom: 28,
        padding: "30px 30px 28px",
        background: "linear-gradient(135deg, rgba(42,112,208,0.10) 0%, rgba(42,112,208,0.015) 60%, rgba(0,230,168,0.04) 100%)",
        border: "1px solid rgba(42,112,208,0.25)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 60px rgba(42,112,208,0.10)",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: C.blue,
          boxShadow: `0 0 12px ${C.blue}aa`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 280, height: 280,
          background: `radial-gradient(circle, ${C.blue}1f 0%, transparent 60%)`,
          pointerEvents: "none",
          opacity: 0.7,
        }} />

        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center", gap: 14, marginBottom: 12,
          flexWrap: "wrap",
        }}>
          <div style={{
            fontSize: 20, fontWeight: 800, letterSpacing: 5, color: C.blue,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            textShadow: `0 0 24px ${C.blue}55, 0 0 8px ${C.blue}30`,
          }}>
            LICENSED AGENT
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 9px",
            background: "rgba(0,230,168,0.10)",
            border: "1px solid rgba(0,230,168,0.32)",
            borderRadius: 4,
            fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: "#00E6A8", ...mono,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3,
              background: "#00E6A8",
              boxShadow: "0 0 8px rgba(0,230,168,0.85)",
              animation: "liveDotPulse 1.6s ease-in-out infinite",
            }} />
            FIELD OPS · LIVE
          </span>
        </div>
        <div style={{
          position: "relative", zIndex: 2,
          fontSize: 32, fontWeight: 700, color: "#FFFFFF", marginBottom: 8,
          fontFamily: "'Georgia', 'Times New Roman', serif",
          letterSpacing: 0.4, lineHeight: 1.15,
          textShadow: "0 0 28px rgba(255,255,255,0.10)",
        }}>
          {d.user.name || d.user.email}
        </div>
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          fontSize: 13, color: "rgba(255,255,255,0.6)",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          letterSpacing: 0.5,
        }}>
          {d.primary_territory.name ? (
            <>
              <span style={{
                width: 5, height: 5, borderRadius: 3,
                background: C.blue,
                boxShadow: `0 0 6px ${C.blue}aa`,
                display: "inline-block",
              }} />
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.78)", textTransform: "uppercase", letterSpacing: 1 }}>
                {d.primary_territory.name}
              </span>
              <span style={{ color: "rgba(255,255,255,0.30)" }}>·</span>
              <span style={{ color: "rgba(255,255,255,0.55)", letterSpacing: 0.5 }}>Territory</span>
            </>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.40)" }}>No territory assigned</span>
          )}
          {chain && (
            <span style={{
              marginLeft: 6, padding: "2px 8px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 3,
              color: "rgba(255,255,255,0.55)",
              fontSize: 10, fontWeight: 700, letterSpacing: 0.6, ...mono,
              textTransform: "uppercase",
            }}>
              {chain}
            </span>
          )}
        </div>
      </div>

      {/* Section subtitle — cinematic strip. */}
      <div style={{
        marginBottom: 18,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: 4,
          background: "#00E6A8",
          boxShadow: "0 0 8px rgba(0,230,168,0.85)",
          animation: "liveDotPulse 1.6s ease-in-out infinite",
          display: "inline-block",
        }} />
        <h2 style={{
          ...mono, fontSize: 13, color: "rgba(255,255,255,0.78)",
          fontWeight: 800, margin: 0, letterSpacing: 2,
          textTransform: "uppercase",
        }}>
          My Dashboard
        </h2>
        <span style={{
          flex: 1, height: 1,
          background: "linear-gradient(90deg, rgba(0,230,168,0.30) 0%, rgba(255,255,255,0.04) 60%, transparent 100%)",
        }} />
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="My Leads" value={String(d.leads.total)} color={C.blue} />
        <KPI label="Claims In Flight" value={String(d.claims.total)} color={C.gold} />
        <KPI label="Revenue (MTD)" value={fmtCurrency(d.claims.mtd_revenue)} color="#00E6A8" />
        <KPI label="MTD Claims" value={String(d.claims.mtd_count)} color="#FFFFFF" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Attention items */}
          <Panel title="WHAT NEEDS ATTENTION TODAY" color="#E05050">
            {d.attention.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>Nothing needs attention right now.</div>
            )}
            {d.attention.map((a, i) => (
              <AttentionItem key={i} severity={a.severity} text={a.text} sub={a.sub} />
            ))}
          </Panel>

          {/* Lead pipeline */}
          <Panel title="MY ADVOCACY PIPELINE" color="#00E6A8" action={d.leads.total > 0 ? "VIEW ALL →" : undefined} onAction={() => navigate("/portal/fire-leads")}>
            {d.leads.pipeline.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No homeowner cases in your advocacy pipeline yet.</div>
            )}
            {d.leads.pipeline
              .sort((a, b) => b.count - a.count)
              .map((p, i) => (
                <EarningsRow key={i} label={p.status} value={String(p.count)} />
              ))}
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Claims by phase */}
          <Panel title="MY CLAIMS" color={C.gold}>
            {d.claims.by_phase.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No claims filed yet.</div>
            )}
            {d.claims.by_phase
              .sort((a, b) => b.count - a.count)
              .map((p, i) => (
                <EarningsRow key={i} label={p.phase} value={String(p.count)} />
              ))}
            {d.claims.total > 0 && (
              <EarningsRow label="MTD Revenue" value={fmtCurrency(d.claims.mtd_revenue)} color="#00E6A8" />
            )}
          </Panel>

          {/* Territory info */}
          <Panel title="MY TERRITORY" color="#00E6A8">
            {d.territories.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No territory assigned.</div>
            )}
            {d.territories.map(t => (
              <EarningsRow key={t.id} label={t.name} value={t.state} />
            ))}
            {d.reporting_rvp && (
              <div style={{ marginTop: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", ...mono, letterSpacing: 0.5 }}>REPORTING TO</div>
                <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500, marginTop: 4 }}>
                  RVP {d.reporting_rvp.name}
                  {d.reporting_cp && <span style={{ color: "rgba(255,255,255,0.45)" }}> → CP {d.reporting_cp.name}</span>}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <RetentionWidgets role="agent" />
    </>
  );
}

// ── RVP DASHBOARD (Phase 3: wired to real backend data) ────────────────────

function RVPDash({ navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiJson("/dashboard/rvp-summary")
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e?.status ?? e?.detail ?? e)); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: C.muted, ...mono, padding: 40 }}>Loading dashboard...</div>;
  if (error) return <div style={{ color: "#E05050", ...mono, padding: 40 }}>Failed to load dashboard: {error}</div>;

  const d = data;
  const fmtCurrency = (v) => v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "$0";

  return (
    <>
      {/* Identity hero — cinematic gold treatment for RVP. */}
      <div style={{
        position: "relative",
        marginBottom: 28,
        padding: "30px 30px 28px",
        background: "linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.015) 60%, rgba(0,230,168,0.04) 100%)",
        border: "1px solid rgba(201,168,76,0.22)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 60px rgba(201,168,76,0.10)",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: C.gold,
          boxShadow: `0 0 12px ${C.gold}aa`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 280, height: 280,
          background: `radial-gradient(circle, ${C.gold}1f 0%, transparent 60%)`,
          pointerEvents: "none",
          opacity: 0.7,
        }} />

        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center", gap: 14, marginBottom: 12,
          flexWrap: "wrap",
        }}>
          <div style={{
            fontSize: 20, fontWeight: 800, letterSpacing: 5, color: C.gold,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            textShadow: `0 0 24px ${C.gold}50, 0 0 8px ${C.gold}30`,
          }}>
            REGIONAL VICE PRESIDENT
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 9px",
            background: "rgba(0,230,168,0.10)",
            border: "1px solid rgba(0,230,168,0.32)",
            borderRadius: 4,
            fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: "#00E6A8", ...mono,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3,
              background: "#00E6A8",
              boxShadow: "0 0 8px rgba(0,230,168,0.85)",
              animation: "liveDotPulse 1.6s ease-in-out infinite",
            }} />
            TEAM OPS · LIVE
          </span>
        </div>
        <div style={{
          position: "relative", zIndex: 2,
          fontSize: 32, fontWeight: 700, color: "#FFFFFF", marginBottom: 8,
          fontFamily: "'Georgia', 'Times New Roman', serif",
          letterSpacing: 0.4, lineHeight: 1.15,
          textShadow: "0 0 28px rgba(255,255,255,0.10)",
        }}>
          {d.user.name || d.user.email}
        </div>
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          fontSize: 13, color: "rgba(255,255,255,0.6)",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          letterSpacing: 0.5,
        }}>
          {d.primary_territory.name ? (
            <>
              <span style={{
                width: 5, height: 5, borderRadius: 3,
                background: C.gold,
                boxShadow: `0 0 6px ${C.gold}aa`,
                display: "inline-block",
              }} />
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.78)", textTransform: "uppercase", letterSpacing: 1 }}>
                {d.primary_territory.name}
              </span>
              <span style={{ color: "rgba(255,255,255,0.30)" }}>·</span>
              <span style={{ color: "rgba(255,255,255,0.55)", letterSpacing: 0.5 }}>Territory</span>
              {d.reporting_cp && (
                <span style={{
                  marginLeft: 6, padding: "2px 8px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 3,
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.6, ...mono,
                  textTransform: "uppercase",
                }}>
                  CP · {d.reporting_cp.name}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.40)" }}>No territory assigned</span>
          )}
        </div>
      </div>

      {/* Section subtitle — cinematic strip. */}
      <div style={{
        marginBottom: 18,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: 4,
          background: "#00E6A8",
          boxShadow: "0 0 8px rgba(0,230,168,0.85)",
          animation: "liveDotPulse 1.6s ease-in-out infinite",
          display: "inline-block",
        }} />
        <h2 style={{
          ...mono, fontSize: 13, color: "rgba(255,255,255,0.78)",
          fontWeight: 800, margin: 0, letterSpacing: 2,
          textTransform: "uppercase",
        }}>
          Team Command Center
        </h2>
        <span style={{
          flex: 1, height: 1,
          background: "linear-gradient(90deg, rgba(0,230,168,0.30) 0%, rgba(255,255,255,0.04) 60%, transparent 100%)",
        }} />
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="Active Agents" value={String(d.agent_count)} color="#00E6A8" />
        <KPI label="Team Leads" value={String(d.team_lead_total)} color={C.blue} />
        <KPI label="Own Revenue (MTD)" value={fmtCurrency(d.own_book.revenue_mtd)} color="#FFFFFF" />
        <KPI label="Own Leads" value={String(d.own_book.total_leads)} color={C.gold} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Attention items */}
          <Panel title="WHAT NEEDS ATTENTION TODAY" color="#E05050">
            {d.attention.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>Nothing needs attention right now.</div>
            )}
            {d.attention.map((a, i) => (
              <AttentionItem key={i} severity={a.severity} text={a.text} sub={a.sub} />
            ))}
          </Panel>

          {/* Agent roster (read-only) */}
          <Panel title="AGENT ROSTER" color="#00E6A8">
            {d.agents.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No agents in your territory yet.</div>
            )}
            {d.agents.map(a => (
              <div key={a.user_id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono }}>{a.territory} — {a.lead_count} lead{a.lead_count !== 1 ? "s" : ""}</div>
                </div>
                <span style={{
                  padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, ...mono,
                  background: a.is_accepting_leads ? "rgba(0,230,168,0.1)" : "rgba(224,80,80,0.1)",
                  border: `1px solid ${a.is_accepting_leads ? "rgba(0,230,168,0.3)" : "rgba(224,80,80,0.3)"}`,
                  color: a.is_accepting_leads ? "#00E6A8" : "#E05050",
                }}>
                  {a.is_accepting_leads ? "ACTIVE" : "PAUSED"}
                </span>
              </div>
            ))}
            {d.agents.length > 0 && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", ...mono, marginTop: 8, fontStyle: "italic" }}>
                Read-only view — agent data managed by each agent
              </div>
            )}
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Own book pipeline */}
          <Panel title="MY ADVOCACY PIPELINE" color={C.gold}>
            {d.own_book.pipeline.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No homeowner cases in your advocacy pipeline yet.</div>
            )}
            {d.own_book.pipeline
              .sort((a, b) => b.count - a.count)
              .map((p, i) => (
                <EarningsRow key={i} label={p.status} value={String(p.count)} />
              ))}
          </Panel>

          {/* Territory info */}
          <Panel title="TERRITORY" color="#00E6A8">
            {d.territories.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No territory assignments.</div>
            )}
            {d.territories.map(t => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{t.name}</span>
                <span style={{ fontSize: 13, color: C.gold, ...mono, fontWeight: 700 }}>{t.state}</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>

      <RetentionWidgets role="RVP" />
    </>
  );
}

// ── CP DASHBOARD (Phase 2: wired to real backend data) ─────────────────────

function CPDash({ navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiJson("/dashboard/cp-summary")
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e?.status ?? e?.detail ?? e)); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: C.muted, ...mono, padding: 40 }}>Loading dashboard...</div>;
  if (error) return <div style={{ color: "#E05050", ...mono, padding: 40 }}>Failed to load dashboard: {error}</div>;

  const d = data;
  const fmtCurrency = (v) => v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "$0";
  const hasTerritories = d.territories.length > 0;

  return (
    <>
      {/* Identity hero — cinematic anchor with gold accent + LIVE chip.
          Provides the "you are here" beat for a CP entering the dashboard. */}
      <div style={{
        position: "relative",
        marginBottom: 28,
        padding: "30px 30px 28px",
        background: "linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.015) 60%, rgba(168,85,247,0.04) 100%)",
        border: "1px solid rgba(201,168,76,0.22)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 60px rgba(201,168,76,0.10)",
      }}>
        {/* Gold top accent + glow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: C.gold,
          boxShadow: `0 0 12px ${C.gold}aa`,
          pointerEvents: "none",
        }} />
        {/* Ambient corner glow — gold radial wash */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 280, height: 280,
          background: `radial-gradient(circle, ${C.gold}1f 0%, transparent 60%)`,
          pointerEvents: "none",
          opacity: 0.7,
        }} />

        {/* Top row: CHAPTER PRESIDENT chip + LIVE indicator */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center", gap: 14, marginBottom: 12,
          flexWrap: "wrap",
        }}>
          <div style={{
            fontSize: 20, fontWeight: 800, letterSpacing: 5, color: C.gold,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            textShadow: `0 0 24px ${C.gold}50, 0 0 8px ${C.gold}30`,
          }}>
            CHAPTER PRESIDENT
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 9px",
            background: "rgba(0,230,168,0.10)",
            border: "1px solid rgba(0,230,168,0.32)",
            borderRadius: 4,
            fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: "#00E6A8", ...mono,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3,
              background: "#00E6A8",
              boxShadow: "0 0 8px rgba(0,230,168,0.85)",
              animation: "liveDotPulse 1.6s ease-in-out infinite",
            }} />
            TERRITORY OPS · LIVE
          </span>
        </div>
        {/* Operator name — serif, prestige typography. */}
        <div style={{
          position: "relative", zIndex: 2,
          fontSize: 32, fontWeight: 700, color: "#FFFFFF", marginBottom: 8,
          fontFamily: "'Georgia', 'Times New Roman', serif",
          letterSpacing: 0.4, lineHeight: 1.15,
          textShadow: "0 0 28px rgba(255,255,255,0.10)",
        }}>
          {d.user.name || d.user.email}
        </div>
        {d.primary_territory.name ? (
          <div style={{
            position: "relative", zIndex: 2,
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 13, color: "rgba(255,255,255,0.6)",
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            letterSpacing: 0.5,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: 3,
              background: C.gold,
              boxShadow: `0 0 6px ${C.gold}aa`,
              display: "inline-block",
            }} />
            <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.78)", textTransform: "uppercase", letterSpacing: 1 }}>
              {d.primary_territory.name}
            </span>
            <span style={{ color: "rgba(255,255,255,0.30)" }}>·</span>
            <span style={{ color: "rgba(255,255,255,0.55)", letterSpacing: 0.5 }}>Territory</span>
            {d.territories.length > 1 && (
              <span style={{
                marginLeft: 6, padding: "1px 7px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 3,
                color: "rgba(255,255,255,0.55)",
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5, ...mono,
              }}>+{d.territories.length - 1} MORE</span>
            )}
          </div>
        ) : (
          <div style={{
            position: "relative", zIndex: 2,
            fontSize: 13, color: "rgba(255,255,255,0.40)",
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            letterSpacing: 0.5,
          }}>
            No territory assigned
          </div>
        )}
      </div>

      {/* Section subtitle — cinematic CP-style strip. */}
      <div style={{
        marginBottom: 18,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: 4,
          background: "#00E6A8",
          boxShadow: "0 0 8px rgba(0,230,168,0.85)",
          animation: "liveDotPulse 1.6s ease-in-out infinite",
          display: "inline-block",
        }} />
        <h2 style={{
          ...mono, fontSize: 13, color: "rgba(255,255,255,0.78)",
          fontWeight: 800, margin: 0, letterSpacing: 2,
          textTransform: "uppercase",
        }}>
          Territory Command Center
        </h2>
        <span style={{
          flex: 1, height: 1,
          background: "linear-gradient(90deg, rgba(0,230,168,0.30) 0%, rgba(255,255,255,0.04) 60%, transparent 100%)",
        }} />
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="Territory Revenue (MTD)" value={fmtCurrency(d.revenue.mtd_total)} color="#00E6A8" to="/portal/commission" />
        <KPI label="Active RVPs" value={String(d.downline.rvp_count)} color={C.gold} />
        <KPI label="Active Agents" value={String(d.downline.agent_count)} color="#00E6A8" />
        <KPI label="Total Leads" value={String(d.total_leads)} color={C.blue} />
      </div>

      {/* MY TEAM — surfaces team/recruiting at-a-glance. Total Agents
          is wired to cp-summary's downline; the other three are mock
          placeholders ("—") until the backend exposes producing-agents,
          7-day recruits, and lifetime team claims. Same KPI styling +
          4-column grid as the strip above. */}
      <div style={{
        marginBottom: 12,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: "#00E6A8",
          boxShadow: "0 0 6px rgba(0,230,168,0.70)",
          display: "inline-block",
        }} />
        <h3 style={{
          ...mono, fontSize: 12, color: "rgba(255,255,255,0.65)",
          fontWeight: 800, margin: 0, letterSpacing: 1.8,
          textTransform: "uppercase",
        }}>
          My Team
        </h3>
        <span style={{
          flex: 1, height: 1,
          background: "linear-gradient(90deg, rgba(0,230,168,0.20) 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
        }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="Total Agents"      value={String(d.downline.agent_count)} color="#00E6A8" />
        <KPI label="Active Agents"     value="—" color="#00E6A8" />
        <KPI label="New Recruits (7d)" value="—" color={C.gold} />
        <KPI label="Team Claims"       value="—" color={C.blue} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Attention items */}
          <Panel title="WHAT NEEDS ATTENTION TODAY" color="#E05050">
            {d.attention.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>Nothing needs attention right now.</div>
            )}
            {d.attention.map((a, i) => (
              <AttentionItem key={i} severity={a.severity} text={a.text} sub={a.sub} />
            ))}
          </Panel>

          {/* Territory snapshot */}
          <Panel title="TERRITORY SNAPSHOT" color="#00E6A8">
            {!hasTerritories && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No territories assigned yet.</div>
            )}
            {hasTerritories && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>Territories</div>
                  <div style={{ fontSize: 15, color: "#00E6A8", ...mono, fontWeight: 700, marginTop: 2 }}>{d.territories.length}</div>
                </div>
                <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>States</div>
                  <div style={{ fontSize: 15, color: C.gold, ...mono, fontWeight: 700, marginTop: 2 }}>
                    {[...new Set(d.territories.map(t => t.state).filter(Boolean))].join(", ") || "—"}
                  </div>
                </div>
                <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>MTD Revenue</div>
                  <div style={{ fontSize: 15, color: "#00E6A8", ...mono, fontWeight: 700, marginTop: 2 }}>{fmtCurrency(d.revenue.mtd_total)}</div>
                </div>
                <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>MTD Claims</div>
                  <div style={{ fontSize: 15, color: "#FFFFFF", ...mono, fontWeight: 700, marginTop: 2 }}>{d.revenue.mtd_claim_count}</div>
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Growth gaps */}
          <Panel title="GROWTH GAPS" color={C.gold}>
            {d.growth_gaps.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>
                {hasTerritories ? "All territories are at capacity." : "No territories to analyze."}
              </div>
            )}
            {d.growth_gaps.map((g, i) => (
              <AttentionItem
                key={i}
                severity={g.needed >= 3 ? "high" : "medium"}
                text={`${g.territory} needs ${g.needed} more agent${g.needed > 1 ? "s" : ""}`}
                sub={`${g.current_agents}/${g.max_agents} slots filled`}
              />
            ))}
          </Panel>

          {/* Lead pipeline */}
          <Panel title="ADVOCACY PIPELINE" color={C.blue}>
            {d.lead_pipeline.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No homeowner cases in your advocacy pipeline yet.</div>
            )}
            {d.lead_pipeline
              .sort((a, b) => b.count - a.count)
              .map((p, i) => (
                <EarningsRow key={i} label={p.status} value={String(p.count)} />
              ))}
          </Panel>
        </div>
      </div>

      {/* Phase 12: Growth Path panel */}
      <GrowthPathPanel />

      <RetentionWidgets role="CP" />
    </>
  );
}

// ── GROWTH PATH PANEL (CP only) ────────────────────────────────────────────

function GrowthPathPanel() {
  const [gp, setGp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expressing, setExpressing] = useState(false);

  useEffect(() => {
    apiFetch("/cp/growth-path")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setGp(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function expressInterest() {
    setExpressing(true);
    apiFetch("/cp/express-interest", { method: "POST" })
      .then(r => r.json())
      .then(() => {
        setGp(prev => ({ ...prev, adjusting_track_status: "interested" }));
        setShowModal(false);
        setExpressing(false);
      })
      .catch(() => setExpressing(false));
  }

  if (loading || !gp) return null;
  const status = gp.adjusting_track_status || "not_interested";

  return (
    <div style={{ marginTop: 24, padding: "24px", background: "linear-gradient(135deg, rgba(168,85,247,0.06) 0%, rgba(168,85,247,0.02) 100%)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 12 }}>

      {/* NOT INTERESTED */}
      {status === "not_interested" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 22 }}>{"\u{1F4C8}"}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", ...mono }}>Your Growth Path — Adjusting Track</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", ...mono }}>CPs with adjusting credentials earn +15% on every self-adjusted claim. Curious?</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {[
              "+15% income boost on every self-adjusted claim",
              "Per-claim choice — self-adjust or hand to ACI",
              "ACI provides training, mentorship, and state licensing support",
              "Progression visible in your dashboard",
            ].map(item => (
              <div key={item} style={{ display: "flex", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.7)", ...mono }}>
                <span style={{ color: "#A855F7" }}>{"\u2713"}</span> {item}
              </div>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} style={{
            padding: "10px 24px", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
            borderRadius: 6, color: "#A855F7", fontSize: 13, fontWeight: 700, cursor: "pointer", ...mono,
          }}>
            Explore Adjusting Track
          </button>

          {/* Modal */}
          {showModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
              <div style={{ background: "#131A2E", border: "1px solid #1F2742", borderRadius: 10, padding: 28, width: 460 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", ...mono, marginBottom: 16 }}>Hybrid CP Adjusting Track</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: 20 }}>
                  As a Hybrid CP, you'll earn a <strong style={{ color: "#A855F7" }}>+15% income boost</strong> on every claim you self-adjust. You choose per claim — self-adjust for more income, or hand to ACI's expert team.
                  <br /><br />
                  ACI provides full support: licensing guidance, training curriculum, exam prep, and ongoing mentorship. Your growth path is tracked in your dashboard.
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowModal(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#fff", cursor: "pointer", ...mono }}>Maybe Later</button>
                  <button onClick={expressInterest} disabled={expressing} style={{
                    padding: "8px 20px", background: "#A855F7", border: "none", borderRadius: 6, color: "#fff",
                    fontSize: 13, fontWeight: 700, cursor: "pointer", ...mono,
                  }}>
                    {expressing ? "Submitting..." : "Express Interest"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* INTERESTED */}
      {status === "interested" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#A855F7", ...mono, marginBottom: 8 }}>{"\u{1F4CB}"} Growth Path — Interest Registered</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", ...mono, marginBottom: 16 }}>
            Your interest is logged. An ACI Adjusting Development coach will reach out within 48 hours.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["Initial consultation call", "State licensing assessment", "Course enrollment (if needed)", "Adjuster exam preparation", "State exam", "Active license on file"].map((step, i) => (
              <div key={step} style={{ display: "flex", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.5)", ...mono }}>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>{"\u25CB"}</span> {step}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono }}>
            Questions? Email adjuster-track@aciadjustment.com
          </div>
        </>
      )}

      {/* IN PROGRESS */}
      {status === "in_progress" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#A855F7", ...mono, marginBottom: 12 }}>{"\u{1F680}"} Growth Path — In Progress</div>
          {gp.licenses.length > 0 ? gp.licenses.map(lic => (
            <div key={lic.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13 }}>
              <span style={{ color: "#fff", ...mono, fontWeight: 600 }}>{lic.state_code}</span>
              <span style={{ color: lic.status === "active" ? "#00E6A8" : "#C9A84C", ...mono }}>{lic.status}</span>
            </div>
          )) : (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", ...mono }}>License pipeline setup in progress...</div>
          )}
        </>
      )}

      {/* QUALIFIED (Hybrid CP) */}
      {status === "qualified" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#00E6A8", ...mono, marginBottom: 12 }}>{"\u{1F451}"} Hybrid Chapter President — Active</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {gp.licenses.filter(l => l.status === "active").map(lic => (
              <span key={lic.id} style={{
                padding: "4px 12px", background: "rgba(0,230,168,0.1)", border: "1px solid rgba(0,230,168,0.3)",
                borderRadius: 20, fontSize: 12, color: "#00E6A8", ...mono, fontWeight: 600,
              }}>
                {lic.state_code} — Active until {lic.expiry_date || "N/A"}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", ...mono }}>
            +{gp.boost_percentage * 100}% income boost available on self-adjusted claims in licensed states.
          </div>
        </>
      )}
    </div>
  );
}

// ── HOME OFFICE DASHBOARD ───────────────────────────────────────────────────

function HomeOfficeDash({ navigate }) {
  // KPI data sources (verified against running backend):
  //   Revenue Pulse  → GET /v1/commission/admin/overview  field: total_gross_fee_mtd
  //   At Risk        → GET /v1/escalation/active          length of returned list
  //   Payout Actions → no backend endpoint exists         renders as "—"
  //   Billing Issues → no backend endpoint exists         renders as "—"
  const [revenue, setRevenue] = useState(null);
  const [atRiskCount, setAtRiskCount] = useState(null);
  const [revenueErr, setRevenueErr] = useState(false);
  const [atRiskErr, setAtRiskErr] = useState(false);

  useEffect(() => {
    apiJson("/commission/admin/overview")
      .then((d) => setRevenue(typeof d?.total_gross_fee_mtd === "number" ? d.total_gross_fee_mtd : 0))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn("[HomeOfficeDash] Revenue Pulse — /v1/commission/admin/overview failed:",
          e?.status || e?.message || e);
        setRevenueErr(true);
      });
    apiJson("/escalation/active")
      .then((d) => setAtRiskCount(Array.isArray(d) ? d.length : 0))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn("[HomeOfficeDash] At Risk — /v1/escalation/active failed:",
          e?.status || e?.message || e);
        setAtRiskErr(true);
      });
    // eslint-disable-next-line no-console
    console.warn("[HomeOfficeDash] No backend endpoint exists for 'Payout Actions' KPI — rendering as —");
    // eslint-disable-next-line no-console
    console.warn("[HomeOfficeDash] No backend endpoint exists for 'Billing Issues' KPI — rendering as —");
  }, []);

  const fmtCurrency = (v) => v > 0
    ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : "$0";

  const revenueValue = revenueErr ? "—" : (revenue == null ? "…" : fmtCurrency(revenue));
  const atRiskValue  = atRiskErr  ? "—" : (atRiskCount == null ? "…" : String(atRiskCount));

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="Revenue Pulse"  value={revenueValue} color="#00E6A8"
             loading={revenue == null && !revenueErr} />
        <KPI label="Payout Actions" color={C.gold}  alert notConnected />
        <KPI label="Billing Issues" color="#E05050" alert notConnected />
        <KPI label="At Risk"        value={atRiskValue}  color="#E05050"
             loading={atRiskCount == null && !atRiskErr} />
      </div>

      {/* Smart summary — no backend data source; placeholder. */}
      <div style={{ padding: "14px 20px", marginBottom: 20, background: `${PURPLE}04`, border: `1px solid ${PURPLE}15`, borderRadius: 10 }}>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500, lineHeight: 1.7 }}>
          —
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="WHAT NEEDS ATTENTION TODAY" color="#E05050">
            <AttentionItem severity="high"   text="—" sub="—" />
            <AttentionItem severity="high"   text="—" sub="—" />
            <AttentionItem severity="high"   text="—" sub="—" />
            <AttentionItem severity="medium" text="—" sub="—" />
            <AttentionItem severity="medium" text="—" sub="—" />
          </Panel>
          <Panel title="PAYOUT QUEUE" color={C.gold} action="OPEN →" onAction={() => navigate("/portal/payout-runs")}>
            <EarningsRow label="Pending Approval" value="—" color={C.gold} />
            <EarningsRow label="Held Items"       value="—" color="#E05050" />
            <EarningsRow label="Ready to Pay"     value="—" />
            <EarningsRow label="Last Run Paid"    value="—" />
          </Panel>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="BILLING ALERTS" color="#E05050" action="OPEN →" onAction={() => navigate("/portal/billing")}>
            <AttentionItem severity="high"   text="—" sub="—" />
            <AttentionItem severity="high"   text="—" sub="—" />
            <AttentionItem severity="medium" text="—" sub="—" />
            <AttentionItem severity="info"   text="—" sub="—" />
          </Panel>
          <Panel title="TERRITORY PERFORMANCE" color="#00E6A8" action="VIEW →" onAction={() => navigate("/portal/territory-revenue")}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", ...mono, fontWeight: 700, width: 28 }}>—</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", ...mono, fontWeight: 700 }}>—</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 30, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", ...mono, fontWeight: 600 }}>—</span>
                </div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { userRole, territory } = useAxisContext();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const titles = {
    agent: { title: "MY DASHBOARD", sub: "Leads, deals, and earnings" },
    RVP: { title: "TEAM COMMAND CENTER", sub: "Team performance, overrides, and recruiting" },
    CP: { title: "TERRITORY COMMAND CENTER", sub: "Territory revenue, team growth, and ownership" },
    home_office: { title: "OPERATIONS COMMAND CENTER", sub: "Revenue, payouts, billing, territories, and compliance" },
  };
  const t = titles[userRole] || titles.agent;

  return (
    <div style={{
      maxWidth: 1100,
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translateY(0)" : "translateY(12px)",
      transition: "all 0.5s ease",
      position: "relative",
    }}>
      {/* Cinematic ambient backdrop — radial color washes anchored at the
          edges so the dashboard reads as a real "screen", not a flat panel. */}
      <div style={{
        position: "absolute", top: -140, left: -140,
        width: 520, height: 520,
        background: "radial-gradient(circle, rgba(0,230,168,0.07) 0%, transparent 65%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />
      <div style={{
        position: "absolute", top: 280, right: -180,
        width: 460, height: 460,
        background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 65%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />
      <div style={{
        position: "absolute", top: 700, left: 60,
        width: 380, height: 380,
        background: "radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 65%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />
      {/* Animation keyframes — mirror LeadsBoard so KPI / panel / hero
          elements can pulse and glow without per-component injection. */}
      <style>{`
        @keyframes liveDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.82); }
        }
        @keyframes edgeGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes kpiAmbient {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.85; }
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 1 }}>

      {/* UPA advocacy hero — branding layer, no logic */}
      <div style={{
        marginBottom: 22,
        padding: "18px 22px",
        background: "linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(168,85,247,0.03) 100%)",
        border: "1px solid rgba(168,85,247,0.22)",
        borderRadius: 10,
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          color: "#A855F7",
          marginBottom: 6,
        }}>
          Unified Public Advocacy Network
        </div>
        <div style={{
          fontSize: 14,
          fontWeight: 500,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.55,
        }}>
          You're managing claims through the <span style={{ color: "#fff", fontWeight: 700 }}>Unified Public Advocacy</span> network — advocating for homeowners and maximizing recovery outcomes.
        </div>
      </div>

      {/* Page header — hidden for CP/RVP/agent (identity header replaces it) */}
      {userRole !== "CP" && userRole !== "RVP" && userRole !== "agent" && (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>{t.title}</h1>
          <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>{t.sub}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "🔥 Find Leads", to: "/portal/fire-leads", color: "#00E6A8" },
          { label: "📞 Call with Marcus", to: "/portal/rin/marcus", color: "#3B82F6" },
          { label: "✍️ Sign Client", to: "/portal/rin/sign", color: C.gold },
        ].map(a => (
          <button
            key={a.to}
            onClick={() => navigate(a.to)}
            style={{
              padding: "10px 20px", background: `${a.color}10`, border: `1px solid ${a.color}30`,
              borderRadius: 8, color: a.color, fontSize: 13, fontWeight: 700, cursor: "pointer",
              ...mono, letterSpacing: 0.5, transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${a.color}20`; e.currentTarget.style.borderColor = `${a.color}60`; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${a.color}10`; e.currentTarget.style.borderColor = `${a.color}30`; }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {userRole === "agent" && <AgentDash navigate={navigate} />}
      {userRole === "RVP" && <RVPDash navigate={navigate} />}
      {userRole === "CP" && <CPDash navigate={navigate} />}
      {userRole === "home_office" && <HomeOfficeDash navigate={navigate} />}
      </div>
    </div>
  );
}
