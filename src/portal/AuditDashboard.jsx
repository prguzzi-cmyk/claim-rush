import { useState, useEffect } from "react";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── MOCK DATA ───────────────────────────────────────────────────────────────

const SECURITY_EVENTS = [
  { id: 1, time: "2026-03-29 14:22:04", user: "David Kim", role: "agent", type: "unauthorized_route_access", severity: "high", resource: "/portal/payout-rules", outcome: "blocked", ip: "192.168.1.44" },
  { id: 2, time: "2026-03-29 14:18:31", user: "James Obi", role: "RVP", type: "unauthorized_route_access", severity: "high", resource: "/portal/billing", outcome: "blocked", ip: "10.0.0.12" },
  { id: 3, time: "2026-03-29 13:45:10", user: "Admin", role: "home_office", type: "payout_run_approved", severity: "low", resource: "PR-2026-009", outcome: "success", ip: "10.0.0.1" },
  { id: 4, time: "2026-03-29 13:30:22", user: "Admin", role: "home_office", type: "rule_changed", severity: "medium", resource: "Agent promo fee", outcome: "success", ip: "10.0.0.1" },
  { id: 5, time: "2026-03-29 12:15:00", user: "Tanya Brooks", role: "agent", type: "unauthorized_api_access", severity: "high", resource: "/api/payout-runs", outcome: "403", ip: "192.168.1.88" },
  { id: 6, time: "2026-03-29 11:40:18", user: "Admin", role: "home_office", type: "wallet_credit_added", severity: "low", resource: "Sarah Kim +$100", outcome: "success", ip: "10.0.0.1" },
  { id: 7, time: "2026-03-29 10:22:55", user: "Admin", role: "home_office", type: "suspension_applied", severity: "medium", resource: "Tanya Brooks", outcome: "success", ip: "10.0.0.1" },
  { id: 8, time: "2026-03-28 16:45:30", user: "David Kim", role: "agent", type: "unauthorized_route_access", severity: "high", resource: "/portal/payout-runs", outcome: "blocked", ip: "192.168.1.44" },
  { id: 9, time: "2026-03-28 15:10:12", user: "Admin", role: "home_office", type: "payout_exported", severity: "low", resource: "PR-2026-008 CSV", outcome: "success", ip: "10.0.0.1" },
  { id: 10, time: "2026-03-28 14:00:00", user: "Admin", role: "home_office", type: "billing_override_applied", severity: "medium", resource: "James Obi — fee waiver", outcome: "success", ip: "10.0.0.1" },
  { id: 11, time: "2026-03-28 11:20:45", user: "Marcus Lee", role: "RVP", type: "unauthorized_route_access", severity: "high", resource: "/portal/forecast", outcome: "blocked", ip: "10.0.0.33" },
  { id: 12, time: "2026-03-27 09:15:00", user: "Admin", role: "home_office", type: "payout_item_adjusted", severity: "medium", resource: "Rachel Torres -$58", outcome: "success", ip: "10.0.0.1" },
];

const VIOLATIONS = [
  { user: "David Kim", role: "agent", resource: "/portal/payout-rules, /portal/payout-runs", count: 4, last: "2026-03-29 14:22", status: "flagged" },
  { user: "James Obi", role: "RVP", resource: "/portal/billing", count: 2, last: "2026-03-29 14:18", status: "monitoring" },
  { user: "Tanya Brooks", role: "agent", resource: "/api/payout-runs", count: 1, last: "2026-03-29 12:15", status: "reviewed" },
  { user: "Marcus Lee", role: "RVP", resource: "/portal/forecast", count: 1, last: "2026-03-28 11:20", status: "reviewed" },
];

const PAYOUT_AUDIT = [
  { time: "2026-03-29 13:45", user: "Admin", action: "Run approved", runId: "PR-2026-009", amount: "$3,885", old: "preview", new_: "approved", note: "" },
  { time: "2026-03-29 13:30", user: "Admin", action: "Item adjusted", runId: "PR-2026-009", amount: "-$58", old: "$358", new_: "$300", note: "Trial account partial commission" },
  { time: "2026-03-29 13:00", user: "Admin", action: "Item held", runId: "PR-2026-009", amount: "$1,140", old: "ready", new_: "held", note: "Pending claim verification" },
  { time: "2026-03-29 12:30", user: "Admin", action: "Preview generated", runId: "PR-2026-009", amount: "$4,943", old: "—", new_: "preview", note: "" },
  { time: "2026-03-18 10:00", user: "Admin", action: "Run paid", runId: "PR-2026-008", amount: "$4,120", old: "approved", new_: "paid", note: "" },
  { time: "2026-03-18 09:30", user: "Admin", action: "Export CSV", runId: "PR-2026-008", amount: "—", old: "—", new_: "exported", note: "Accounting export" },
];

const RULE_CHANGES = [
  { time: "2026-03-29 13:30", user: "Admin", rule: "Agent promo fee", old: "$399", new_: "$299", effective: "2026-03-01", note: "Q2 promotion" },
  { time: "2026-03-15 10:00", user: "Admin", rule: "CP override on RVP", old: "8%", new_: "10%", effective: "2026-03-15", note: "v3 rule update" },
  { time: "2026-03-01 09:15", user: "Admin", rule: "Clawback window", old: "60 days", new_: "90 days", effective: "2026-03-01", note: "Legal compliance" },
  { time: "2026-02-01 11:30", user: "Admin", rule: "Agent fee", old: "$450", new_: "$500", effective: "2026-02-01", note: "v2 pricing" },
];

const ANOMALIES = [
  { id: 1, type: "Repeated access violations", target: "David Kim", detail: "4 attempts at restricted routes in 48hrs", severity: "high" },
  { id: 2, type: "Manual payout adjustment", target: "Rachel Torres", detail: "-$58 adjustment on trial account", severity: "low" },
  { id: 3, type: "Fee waiver applied", target: "James Obi", detail: "Manual billing override — past due waived", severity: "medium" },
  { id: 4, type: "Suspension + outstanding balance", target: "Tanya Brooks", detail: "$1,500 outstanding, account suspended", severity: "medium" },
];

const COMPLIANCE_QUEUE = [
  { id: 1, item: "David Kim — repeated access violations", severity: "high", status: "open", assignee: null, created: "2026-03-29" },
  { id: 2, item: "James Obi — billing override review", severity: "medium", status: "open", assignee: null, created: "2026-03-28" },
  { id: 3, item: "Tanya Brooks — suspended account review", severity: "medium", status: "in_review", assignee: "Admin", created: "2026-03-28" },
  { id: 4, item: "Rachel Torres — payout adjustment audit", severity: "low", status: "reviewed", assignee: "Admin", created: "2026-03-29" },
];

const SEV = {
  critical: { color: "#FF4444", bg: "rgba(255,68,68,0.12)", border: "rgba(255,68,68,0.25)" },
  high:     { color: "#E05050", bg: "rgba(224,80,80,0.12)", border: "rgba(224,80,80,0.25)" },
  medium:   { color: C.gold, bg: `${C.gold}12`, border: `${C.gold}25` },
  low:      { color: "rgba(255,255,255,0.55)", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)" },
};

function SevBadge({ severity }) {
  const s = SEV[severity] || SEV.low;
  return <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, ...mono, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>{severity.toUpperCase()}</span>;
}

// ── MAIN ────────────────────────────────────────────────────────────────────

export default function AuditDashboard() {
  const { permissions } = useAxisContext();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("all");
  const [detailUser, setDetailUser] = useState(null);
  const [complianceItems, setComplianceItems] = useState(COMPLIANCE_QUEUE);

  useEffect(() => { setMounted(true); }, []);

  if (!permissions.canSeePayoutRules) {
    return <div style={{ padding: 40, textAlign: "center", fontSize: 16, color: "#E05050", ...mono }}>Access denied. Home office only.</div>;
  }

  const filteredEvents = SECURITY_EVENTS.filter(e => {
    if (search && !e.user.toLowerCase().includes(search.toLowerCase()) && !e.type.toLowerCase().includes(search.toLowerCase()) && !e.resource.toLowerCase().includes(search.toLowerCase())) return false;
    if (sevFilter !== "all" && e.severity !== sevFilter) return false;
    return true;
  });

  const unauthorizedCount = SECURITY_EVENTS.filter(e => e.type.includes("unauthorized")).length;
  const ruleChanges = RULE_CHANGES.length;
  const payoutApprovals = PAYOUT_AUDIT.filter(a => a.action.includes("approved") || a.action.includes("paid")).length;
  const failedBilling = 2;
  const anomalyCount = ANOMALIES.filter(a => a.severity === "high" || a.severity === "critical").length;
  const openCompliance = complianceItems.filter(c => c.status === "open").length;

  const detailData = detailUser ? {
    ...VIOLATIONS.find(v => v.user === detailUser),
    events: SECURITY_EVENTS.filter(e => e.user === detailUser),
  } : null;

  const markReviewed = (id) => setComplianceItems(prev => prev.map(c => c.id === id ? { ...c, status: "reviewed" } : c));

  return (
    <div style={{ maxWidth: 1300, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
      <style>{`@keyframes adFade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>AUDIT + COMPLIANCE DASHBOARD</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>Monitor security, financial controls, access violations, and compliance issues.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Access Violations", value: unauthorizedCount, color: "#E05050" },
          { label: "Rule Changes", value: ruleChanges, color: C.gold },
          { label: "Payout Approvals", value: payoutApprovals, color: "#00E6A8" },
          { label: "Failed Billing", value: failedBilling, color: "#E05050" },
          { label: "Anomaly Flags", value: anomalyCount, color: "#E05050" },
          { label: "Open Compliance", value: openCompliance, color: openCompliance > 0 ? C.gold : "rgba(255,255,255,0.45)" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#162238", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 4, textShadow: `0 0 10px ${kpi.color}40` }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: detailData ? "1fr 340px" : "1fr", gap: 20 }}>
        <div>
          {/* Security events */}
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: "#E05050" }} />
                <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>SECURITY EVENT FEED</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, color: "#FFFFFF", fontSize: 11, ...mono, outline: "none", width: 140 }} />
                <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} style={{ padding: "5px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, color: "#FFFFFF", fontSize: 11, ...mono, outline: "none" }}>
                  <option value="all">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </div>
            </div>
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Time", "User", "Role", "Event", "Severity", "Resource", "Outcome"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)", ...mono, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map(e => (
                    <tr key={e.id} onClick={() => setDetailUser(e.user)} style={{ cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,0.55)", ...mono }}>{e.time.split(" ")[1]}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{e.user}</td>
                      <td style={{ padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,0.55)", ...mono }}>{e.role}</td>
                      <td style={{ padding: "8px 12px", fontSize: 11, color: e.type.includes("unauthorized") ? "#E05050" : "rgba(255,255,255,0.65)", ...mono, fontWeight: 500 }}>{e.type.replace(/_/g, " ")}</td>
                      <td style={{ padding: "8px 12px" }}><SevBadge severity={e.severity} /></td>
                      <td style={{ padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,0.55)", ...mono }}>{e.resource}</td>
                      <td style={{ padding: "8px 12px", fontSize: 11, color: e.outcome === "blocked" || e.outcome === "403" ? "#E05050" : "#00E6A8", ...mono, fontWeight: 600 }}>{e.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Two-column: Violations + Anomalies */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Permission violations */}
            <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "16px 20px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: 11, color: "#E05050", letterSpacing: 1, ...mono, fontWeight: 700, marginBottom: 12 }}>PERMISSION VIOLATIONS</div>
              {VIOLATIONS.map((v, i) => (
                <div key={i} onClick={() => setDetailUser(v.user)} style={{ padding: "8px 0", borderBottom: i < VIOLATIONS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{v.user}</span>
                    <span style={{ fontSize: 12, color: v.count >= 3 ? "#E05050" : C.gold, ...mono, fontWeight: 700 }}>{v.count}x</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono, marginTop: 2 }}>{v.resource}</div>
                </div>
              ))}
            </div>

            {/* Anomalies */}
            <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "16px 20px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: 11, color: C.gold, letterSpacing: 1, ...mono, fontWeight: 700, marginBottom: 12 }}>ANOMALY DETECTION</div>
              {ANOMALIES.map(a => (
                <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{a.type}</span>
                    <SevBadge severity={a.severity} />
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono, marginTop: 2 }}>{a.target} — {a.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Two-column: Payout audit + Rule changes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: "#00E6A8" }} />
                <span style={{ fontSize: 12, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>PAYOUT AUDIT TRAIL</span>
              </div>
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {PAYOUT_AUDIT.map((a, i) => (
                  <div key={i} style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{a.action}</span>
                      <span style={{ fontSize: 12, color: "#00E6A8", ...mono, fontWeight: 700 }}>{a.amount}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono, marginTop: 2 }}>
                      {a.time} · {a.runId} · {a.old} → {a.new_}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: C.gold }} />
                <span style={{ fontSize: 12, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>RULE CHANGE LOG</span>
              </div>
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {RULE_CHANGES.map((r, i) => (
                  <div key={i} style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 12, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{r.rule}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: "#E05050", ...mono, textDecoration: "line-through" }}>{r.old}</span>
                      <span style={{ fontSize: 11, color: "#00E6A8", ...mono, fontWeight: 700 }}>{r.new_}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", ...mono, marginTop: 2 }}>{r.time} · {r.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Compliance queue */}
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: C.gold }} />
              <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>COMPLIANCE QUEUE</span>
            </div>
            {complianceItems.map(c => {
              const statusColor = c.status === "open" ? "#E05050" : c.status === "in_review" ? C.gold : "#00E6A8";
              return (
                <div key={c.id} style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{c.item}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono, marginTop: 2 }}>Created {c.created}{c.assignee ? ` · Assigned: ${c.assignee}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SevBadge severity={c.severity} />
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, ...mono, background: `${statusColor}12`, border: `1px solid ${statusColor}30`, color: statusColor }}>{c.status.replace("_", " ").toUpperCase()}</span>
                    {c.status !== "reviewed" && (
                      <button onClick={() => markReviewed(c.id)} style={{ padding: "3px 8px", background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.25)", borderRadius: 4, color: "#00E6A8", fontSize: 10, fontWeight: 700, cursor: "pointer", ...mono }}>MARK REVIEWED</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail drawer */}
        {detailData && (
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", position: "sticky", top: 24, alignSelf: "start", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono }}>{detailData.user || detailUser}</span>
              <button onClick={() => setDetailUser(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              {detailData.role && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: "Role", value: detailData.role?.toUpperCase() },
                    { label: "Violations", value: detailData.count || 0, color: (detailData.count || 0) > 2 ? "#E05050" : C.gold },
                    { label: "Status", value: detailData.status?.toUpperCase() || "—" },
                    { label: "Last Attempt", value: detailData.last?.split(" ")[1] || "—" },
                  ].map(r => (
                    <div key={r.label} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>{r.label}</div>
                      <div style={{ fontSize: 14, color: r.color || "#FFFFFF", ...mono, fontWeight: 700, marginTop: 2 }}>{r.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600, marginBottom: 8 }}>RECENT EVENTS</div>
              {detailData.events?.slice(0, 5).map(e => (
                <div key={e.id} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 12, color: e.type.includes("unauthorized") ? "#E05050" : "#00E6A8", ...mono, fontWeight: 600 }}>{e.type.replace(/_/g, " ")}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono }}>{e.time} · {e.resource}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
