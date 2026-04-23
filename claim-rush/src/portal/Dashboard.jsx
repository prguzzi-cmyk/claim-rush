import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";
import RetentionWidgets from "./RetentionWidgets";
import { apiJson, apiFetch } from "../lib/api";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── SHARED COMPONENTS ───────────────────────────────────────────────────────

function KPI({ label, value, color, alert }) {
  return (
    <div style={{ background: "#162238", border: `1px solid ${alert ? "#E0505030" : "rgba(255,255,255,0.12)"}`, borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 6, textShadow: `0 0 10px ${color}40` }}>{value}</div>
    </div>
  );
}

function Panel({ title, color, children, action, onAction }) {
  return (
    <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden" }}>
      {title && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {color && <span style={{ width: 7, height: 7, borderRadius: 4, background: color }} />}
            <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>{title}</span>
          </div>
          {action && <button onClick={onAction} style={{ padding: "4px 10px", background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.25)", borderRadius: 5, color: "#00E6A8", fontSize: 10, fontWeight: 700, cursor: "pointer", ...mono }}>{action}</button>}
        </div>
      )}
      <div style={{ padding: "14px 20px" }}>{children}</div>
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
      {/* Identity header */}
      <div style={{ marginBottom: 28, padding: "28px 28px 24px", background: "linear-gradient(135deg, rgba(42,112,208,0.08) 0%, rgba(42,112,208,0.02) 100%)", border: "1px solid rgba(42,112,208,0.18)", borderRadius: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 5, color: C.blue, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", textShadow: "0 0 20px rgba(42,112,208,0.3)" }}>
          LICENSED AGENT
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#FFFFFF", marginBottom: 6, fontFamily: "'Georgia', 'Times New Roman', serif", letterSpacing: 0.5, lineHeight: 1.2, marginTop: 10 }}>
          {d.user.name || d.user.email}
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", letterSpacing: 0.5 }}>
          {d.primary_territory.name ? `${d.primary_territory.name} Territory` : "No territory assigned"}
          {chain && <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: 10 }}>— {chain}</span>}
        </div>
      </div>

      {/* Page subtitle */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ ...mono, fontSize: 16, color: "rgba(255,255,255,0.55)", fontWeight: 700, margin: 0, letterSpacing: 1.5, textTransform: "uppercase" }}>
          My Dashboard
        </h2>
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
          <Panel title="MY LEAD PIPELINE" color="#00E6A8" action={d.leads.total > 0 ? "VIEW ALL →" : undefined} onAction={() => navigate("/portal/fire-leads")}>
            {d.leads.pipeline.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No leads in pipeline yet.</div>
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
      {/* Identity header */}
      <div style={{ marginBottom: 28, padding: "28px 28px 24px", background: "linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(201,168,76,0.02) 100%)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 5, color: C.gold, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", textShadow: "0 0 20px rgba(201,168,76,0.25)" }}>
          REGIONAL VICE PRESIDENT
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#FFFFFF", marginBottom: 6, fontFamily: "'Georgia', 'Times New Roman', serif", letterSpacing: 0.5, lineHeight: 1.2, marginTop: 10 }}>
          {d.user.name || d.user.email}
        </div>
        {d.reporting_cp ? (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", letterSpacing: 0.5 }}>
            {d.primary_territory.name} Territory — reporting to CP {d.reporting_cp.name}
          </div>
        ) : d.primary_territory.name ? (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
            {d.primary_territory.name} Territory
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
            No territory assigned
          </div>
        )}
      </div>

      {/* Page subtitle */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ ...mono, fontSize: 16, color: "rgba(255,255,255,0.55)", fontWeight: 700, margin: 0, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Team Command Center
        </h2>
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
          <Panel title="MY LEAD PIPELINE" color={C.gold}>
            {d.own_book.pipeline.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No leads in your personal pipeline yet.</div>
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
      {/* Identity header — visual anchor */}
      <div style={{ marginBottom: 28, padding: "28px 28px 24px", background: "linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(201,168,76,0.02) 100%)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <div style={{
            fontSize: 20, fontWeight: 800, letterSpacing: 5, color: C.gold,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            textShadow: "0 0 20px rgba(201,168,76,0.25)",
          }}>
            CHAPTER PRESIDENT
          </div>
        </div>
        <div style={{
          fontSize: 28, fontWeight: 700, color: "#FFFFFF", marginBottom: 6,
          fontFamily: "'Georgia', 'Times New Roman', serif",
          letterSpacing: 0.5, lineHeight: 1.2,
        }}>
          {d.user.name || d.user.email}
        </div>
        {d.primary_territory.name ? (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", letterSpacing: 0.5 }}>
            {d.primary_territory.name} Territory
            {d.territories.length > 1 && (
              <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: 8 }}>+{d.territories.length - 1} more</span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
            No territory assigned
          </div>
        )}
      </div>

      {/* Page subtitle */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ ...mono, fontSize: 16, color: "rgba(255,255,255,0.55)", fontWeight: 700, margin: 0, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Territory Command Center
        </h2>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="Territory Revenue (MTD)" value={fmtCurrency(d.revenue.mtd_total)} color="#FFFFFF" />
        <KPI label="Active RVPs" value={String(d.downline.rvp_count)} color={C.gold} />
        <KPI label="Active Agents" value={String(d.downline.agent_count)} color="#00E6A8" />
        <KPI label="Total Leads" value={String(d.total_leads)} color={C.blue} />
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
          <Panel title="LEAD PIPELINE" color={C.blue}>
            {d.lead_pipeline.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, padding: "8px 0" }}>No leads in pipeline yet.</div>
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
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="Revenue Pulse" value="$258K" color="#00E6A8" />
        <KPI label="Payout Actions" value="3" color={C.gold} alert />
        <KPI label="Billing Issues" value="3" color="#E05050" alert />
        <KPI label="At Risk" value="2" color="#E05050" />
      </div>

      {/* Smart summary */}
      <div style={{ padding: "14px 20px", marginBottom: 20, background: `${PURPLE}04`, border: `1px solid ${PURPLE}15`, borderRadius: 10 }}>
        <div style={{ fontSize: 14, color: "#FFFFFF", ...mono, fontWeight: 500, lineHeight: 1.7 }}>
          <span style={{ color: "#E05050", fontWeight: 700 }}>2 past due</span> — Obi $1K, Brooks $1.5K suspended.
          {" "}<span style={{ color: C.gold, fontWeight: 700 }}>PR-2026-009</span> awaiting approval ($3.9K, 1 held).
          {" "}AL territory <span style={{ color: "#E05050", fontWeight: 700 }}>has no RVPs</span>.
          {" "}Revenue <span style={{ color: "#00E6A8", fontWeight: 700 }}>+16%</span> this month.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="WHAT NEEDS ATTENTION TODAY" color="#E05050">
            <AttentionItem severity="high" text="Approve payout run PR-2026-009" sub="$3,885 gross · 12 items · 1 held" />
            <AttentionItem severity="high" text="David Kim — 4 access violations" sub="Repeated attempts at restricted routes" />
            <AttentionItem severity="high" text="Tanya Brooks — suspended" sub="$1,500 outstanding · card: None" />
            <AttentionItem severity="medium" text="James Obi — $1,000 past due" sub="32 days · autopay off" />
            <AttentionItem severity="medium" text="Alabama — no RVPs" sub="Declining health score (45%)" />
          </Panel>
          <Panel title="PAYOUT QUEUE" color={C.gold} action="OPEN →" onAction={() => navigate("/portal/payout-runs")}>
            <EarningsRow label="Pending Approval" value="$3,885" color={C.gold} />
            <EarningsRow label="Held Items" value="$1,140" color="#E05050" />
            <EarningsRow label="Ready to Pay" value="11 items" />
            <EarningsRow label="Last Run Paid" value="PR-2026-008 · $4,120" />
          </Panel>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="BILLING ALERTS" color="#E05050" action="OPEN →" onAction={() => navigate("/portal/billing")}>
            <AttentionItem severity="high" text="Tanya Brooks — suspended" sub="$1,500 · no card on file" />
            <AttentionItem severity="high" text="David Kim — payment failed" sub="$500 · card declined" />
            <AttentionItem severity="medium" text="James Obi — past due" sub="$1,000 · 32 days" />
            <AttentionItem severity="info" text="5 renewals this week" sub="All on autopay" />
          </Panel>
          <Panel title="TERRITORY PERFORMANCE" color="#00E6A8" action="VIEW →" onAction={() => navigate("/portal/territory-revenue")}>
            {[
              { terr: "CA", rev: "$64K", health: 88, color: "#00E6A8" },
              { terr: "TX", rev: "$54K", health: 85, color: "#00E6A8" },
              { terr: "FL", rev: "$42K", health: 92, color: "#00E6A8" },
              { terr: "AL", rev: "$5K", health: 45, color: "#E05050" },
            ].map(t => (
              <div key={t.terr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 14, color: "#FFFFFF", ...mono, fontWeight: 700, width: 28 }}>{t.terr}</span>
                <span style={{ fontSize: 13, color: "#00E6A8", ...mono, fontWeight: 700 }}>{t.rev}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 30, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
                    <div style={{ width: `${t.health}%`, height: "100%", borderRadius: 2, background: t.color }} />
                  </div>
                  <span style={{ fontSize: 11, color: t.color, ...mono, fontWeight: 600 }}>{t.health}</span>
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
    <div style={{ maxWidth: 1100, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
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
          { label: "🔥 Find Leads", to: "/portal/rin/fire-leads", color: "#00E6A8" },
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
  );
}
