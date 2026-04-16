import { useState, useEffect } from "react";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── MOCK DATA ───────────────────────────────────────────────────────────────

const MOCK_LINE_ITEMS = [
  { id: 1, recipient: "Sarah Kim", role: "CP", sourceType: "Licensing", sourceName: "RVP Override (Marcus Lee)", sourceAmt: 1000, rule: "CP→RVP 10%", overridePct: 10, gross: 100, adjustments: 0, net: 100, status: "ready", notes: "" },
  { id: 2, recipient: "Sarah Kim", role: "CP", sourceType: "Licensing", sourceName: "RVP Override (James Obi)", sourceAmt: 1000, rule: "CP→RVP 10%", overridePct: 10, gross: 100, adjustments: 0, net: 100, status: "ready", notes: "" },
  { id: 3, recipient: "Sarah Kim", role: "CP", sourceType: "Licensing", sourceName: "Agent Override (5 agents)", sourceAmt: 2500, rule: "CP→Agent 5%", overridePct: 5, gross: 125, adjustments: 0, net: 125, status: "ready", notes: "" },
  { id: 4, recipient: "Sarah Kim", role: "CP", sourceType: "Production", sourceName: "Team Override", sourceAmt: 5200, rule: "CP Team 3%", overridePct: 3, gross: 156, adjustments: 0, net: 156, status: "ready", notes: "" },
  { id: 5, recipient: "Marcus Lee", role: "RVP", sourceType: "Licensing", sourceName: "Agent Override (3 agents)", sourceAmt: 1500, rule: "RVP→Agent 8%", overridePct: 8, gross: 120, adjustments: 0, net: 120, status: "ready", notes: "" },
  { id: 6, recipient: "Marcus Lee", role: "RVP", sourceType: "Production", sourceName: "Whitfield Roof Claim", sourceAmt: 14200, rule: "RVP Override 5%", overridePct: 5, gross: 710, adjustments: 0, net: 710, status: "ready", notes: "" },
  { id: 7, recipient: "James Obi", role: "RVP", sourceType: "Licensing", sourceName: "Agent Override (4 agents)", sourceAmt: 2000, rule: "RVP→Agent 8%", overridePct: 8, gross: 160, adjustments: 0, net: 160, status: "ready", notes: "" },
  { id: 8, recipient: "James Obi", role: "RVP", sourceType: "Production", sourceName: "Santos Multi-Unit Claim", sourceAmt: 22800, rule: "RVP Override 5%", overridePct: 5, gross: 1140, adjustments: 0, net: 1140, status: "held", notes: "Pending claim verification" },
  { id: 9, recipient: "Alex Chen", role: "Agent", sourceType: "Production", sourceName: "Tran WTP Gold Enrollment", sourceAmt: 588, rule: "Closer 20%", overridePct: 20, gross: 118, adjustments: 0, net: 118, status: "ready", notes: "" },
  { id: 10, recipient: "Alex Chen", role: "Agent", sourceType: "Production", sourceName: "Park WTP Platinum", sourceAmt: 1188, rule: "Closer 20%", overridePct: 20, gross: 238, adjustments: 0, net: 238, status: "ready", notes: "" },
  { id: 11, recipient: "Priya Sharma", role: "Agent", sourceType: "Production", sourceName: "Okafor Business Shield", sourceAmt: 2388, rule: "Closer 20%", overridePct: 20, gross: 478, adjustments: 0, net: 478, status: "ready", notes: "" },
  { id: 12, recipient: "David Kim", role: "Agent", sourceType: "Production", sourceName: "Williams Flood Filing", sourceAmt: 3200, rule: "Agent 10%", overridePct: 10, gross: 320, adjustments: 0, net: 320, status: "ready", notes: "" },
  { id: 13, recipient: "Rachel Torres", role: "Agent", sourceType: "Production", sourceName: "Vasquez Landlord Pro", sourceAmt: 1788, rule: "Closer 20%", overridePct: 20, gross: 358, adjustments: -58, net: 300, status: "ready", notes: "Adjusted: partial commission (trial)" },
  { id: 14, recipient: "Tanya Brooks", role: "Agent", sourceType: "Licensing", sourceName: "Agent Fee", sourceAmt: 500, rule: "N/A", overridePct: 0, gross: 0, adjustments: 0, net: 0, status: "failed", notes: "Billing failed — card declined" },
];

const PRIOR_RUNS = [
  { id: "PR-2026-008", type: "Combined", period: "Mar 1–15", gross: 4120, held: 320, retained: 28400, status: "Paid", approvedBy: "Admin", date: "2026-03-18" },
  { id: "PR-2026-007", type: "Licensing", period: "Feb 16–28", gross: 1890, held: 0, retained: 30100, status: "Paid", approvedBy: "Admin", date: "2026-03-03" },
  { id: "PR-2026-006", type: "Production", period: "Feb 16–28", gross: 3540, held: 540, retained: 18200, status: "Paid", approvedBy: "Admin", date: "2026-03-03" },
  { id: "PR-2026-005", type: "Combined", period: "Feb 1–15", gross: 3210, held: 0, retained: 26800, status: "Paid", approvedBy: "Admin", date: "2026-02-18" },
];

const WARNINGS = [
  { type: "billing", msg: "1 account with failed billing excluded (Tanya Brooks)", severity: "high" },
  { type: "held", msg: "1 line item held pending claim verification ($1,140)", severity: "medium" },
  { type: "trial", msg: "1 trial account with reduced commission (Rachel Torres)", severity: "low" },
];

const ADJ_TYPES = ["bonus", "correction", "clawback", "billing_hold", "chargeback_hold", "manual_override"];

// ── HELPERS ─────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  ready:    { bg: "rgba(0,230,168,0.12)", border: "rgba(0,230,168,0.25)", color: "#00E6A8" },
  held:     { bg: `${C.gold}12`, border: `${C.gold}25`, color: C.gold },
  failed:   { bg: "rgba(224,80,80,0.12)", border: "rgba(224,80,80,0.25)", color: "#E05050" },
  approved: { bg: "rgba(0,230,168,0.12)", border: "rgba(0,230,168,0.25)", color: "#00E6A8" },
  paid:     { bg: "rgba(0,230,168,0.12)", border: "rgba(0,230,168,0.25)", color: "#00E6A8" },
  draft:    { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" },
};

function Badge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, ...mono, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {status.toUpperCase()}
    </span>
  );
}

function Panel({ children, title, color, style: extra }) {
  return (
    <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", marginBottom: 20, overflow: "hidden", ...extra }}>
      {title && (
        <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
          {color && <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />}
          <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>{title}</span>
        </div>
      )}
      <div style={{ padding: title ? "16px 24px" : "20px 24px" }}>{children}</div>
    </div>
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────

export default function PayoutRuns() {
  const { permissions } = useAxisContext();
  const canApprove = permissions.canApprovePayouts;
  const canExport = permissions.canExportFinancials;

  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState(MOCK_LINE_ITEMS);
  const [runStatus, setRunStatus] = useState("preview"); // draft|preview|approved|paid|held
  const [selected, setSelected] = useState(new Set());
  const [detailId, setDetailId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterSource, setFilterSource] = useState("all"); // Licensing|Production|all
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortCol, setSortCol] = useState("recipient");
  const [sortDir, setSortDir] = useState(1);
  const [adjModal, setAdjModal] = useState(null); // { id, type, amount, note }

  useEffect(() => { setMounted(true); }, []);

  // Computed
  const filtered = items.filter(it => {
    if (search && !it.recipient.toLowerCase().includes(search.toLowerCase()) && !it.sourceName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole !== "all" && it.role !== filterRole) return false;
    if (filterSource !== "all" && it.sourceType !== filterSource) return false;
    if (filterStatus !== "all" && it.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    if (typeof av === "number") return (av - bv) * sortDir;
    return String(av).localeCompare(String(bv)) * sortDir;
  });

  const totalGross = items.filter(i => i.status !== "failed").reduce((s, i) => s + i.gross, 0);
  const totalHeld = items.filter(i => i.status === "held").reduce((s, i) => s + i.gross, 0);
  const totalNet = items.filter(i => i.status === "ready" || i.status === "approved").reduce((s, i) => s + i.net, 0);
  const failedCount = items.filter(i => i.status === "failed").length;
  const cpTotal = items.filter(i => i.role === "CP" && i.status !== "failed").reduce((s, i) => s + i.net, 0);
  const rvpTotal = items.filter(i => i.role === "RVP" && i.status !== "failed").reduce((s, i) => s + i.net, 0);
  const agentTotal = items.filter(i => i.role === "Agent" && i.status !== "failed").reduce((s, i) => s + i.net, 0);
  const retained = 32500 - totalNet; // mock company total

  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(filtered.map(i => i.id)));
  const clearSelection = () => setSelected(new Set());

  const holdSelected = () => {
    setItems(prev => prev.map(i => selected.has(i.id) ? { ...i, status: "held", notes: i.notes || "Admin hold" } : i));
    clearSelection();
  };

  const applyAdj = () => {
    if (!adjModal) return;
    setItems(prev => prev.map(i => i.id === adjModal.id ? { ...i, adjustments: i.adjustments + Number(adjModal.amount || 0), net: i.gross + i.adjustments + Number(adjModal.amount || 0), notes: adjModal.note || i.notes } : i));
    setAdjModal(null);
  };

  const doSort = (col) => {
    if (sortCol === col) setSortDir(d => -d);
    else { setSortCol(col); setSortDir(1); }
  };

  const detail = detailId ? items.find(i => i.id === detailId) : null;

  return (
    <div style={{ maxWidth: 1300, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
      <style>{`@keyframes prFadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>PAYOUT RUN CENTER</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>Generate, review, approve, and export payout runs.</p>
      </div>

      {/* Action bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 20, padding: "12px 20px", background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            ...(canApprove ? [
              { label: "New Run", color: PURPLE, action: () => setRunStatus("draft") },
              { label: "Preview", color: PURPLE, action: () => setRunStatus("preview") },
              { label: "Approve", color: "#00E6A8", action: () => setRunStatus("approved") },
              { label: "Hold Selected", color: C.gold, action: holdSelected, disabled: selected.size === 0 },
            ] : []),
            ...(canExport ? [
              { label: "CSV", color: "rgba(255,255,255,0.55)" },
              { label: "PDF", color: "rgba(255,255,255,0.55)" },
            ] : []),
          ].map(btn => (
            <button key={btn.label} onClick={btn.action} disabled={btn.disabled} style={{
              padding: "6px 14px", background: `${btn.color}10`, border: `1px solid ${btn.color}30`,
              borderRadius: 6, color: btn.disabled ? "rgba(255,255,255,0.25)" : btn.color,
              fontSize: 12, fontWeight: 700, cursor: btn.disabled ? "default" : "pointer", ...mono, transition: "all 0.2s",
            }}>{btn.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono }}>Run:</span>
          <Badge status={runStatus} />
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Gross Payout", value: `$${totalGross.toLocaleString()}`, color: "#FFFFFF" },
          { label: "Held", value: `$${totalHeld.toLocaleString()}`, color: C.gold },
          { label: "Company Retained", value: `$${retained.toLocaleString()}`, color: "#00E6A8" },
          { label: "Recipients", value: new Set(items.filter(i => i.status !== "failed").map(i => i.recipient)).size, color: PURPLE },
          { label: "Failed Billing", value: failedCount, color: "#E05050" },
          { label: "Chargebacks", value: 0, color: "rgba(255,255,255,0.45)" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#162238", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 4, textShadow: `0 0 10px ${kpi.color}40` }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: detailId ? "1fr 340px" : "1fr", gap: 20 }}>
        {/* Main table area */}
        <div>
          {/* Warnings */}
          {WARNINGS.length > 0 && (
            <Panel title="WARNINGS" color="#E05050" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {WARNINGS.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: `${w.severity === "high" ? "rgba(224,80,80,0.06)" : w.severity === "medium" ? `${C.gold}06` : "rgba(255,255,255,0.02)"}`, border: `1px solid ${w.severity === "high" ? "rgba(224,80,80,0.15)" : w.severity === "medium" ? `${C.gold}15` : "rgba(255,255,255,0.06)"}`, borderRadius: 6 }}>
                    <span style={{ fontSize: 12, color: w.severity === "high" ? "#E05050" : w.severity === "medium" ? C.gold : "rgba(255,255,255,0.55)" }}>⚠</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", ...mono, fontWeight: 500 }}>{w.msg}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Filters + Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{
              padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 6, color: "#FFFFFF", fontSize: 12, ...mono, outline: "none", width: 180,
            }} />
            {[
              { key: "filterRole", val: filterRole, set: setFilterRole, opts: [["all","All Roles"],["CP","CP"],["RVP","RVP"],["Agent","Agent"]] },
              { key: "filterSource", val: filterSource, set: setFilterSource, opts: [["all","All Sources"],["Licensing","Licensing"],["Production","Production"]] },
              { key: "filterStatus", val: filterStatus, set: setFilterStatus, opts: [["all","All Status"],["ready","Ready"],["held","Held"],["failed","Failed"]] },
            ].map(f => (
              <select key={f.key} value={f.val} onChange={e => f.set(e.target.value)} style={{
                padding: "6px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 6, color: "#FFFFFF", fontSize: 12, ...mono, outline: "none",
              }}>
                {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono }}>{filtered.length} items</span>
            <button onClick={selected.size > 0 ? clearSelection : selectAll} style={{
              padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 5, color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600, cursor: "pointer", ...mono,
            }}>{selected.size > 0 ? `Clear (${selected.size})` : "Select All"}</button>
          </div>

          {/* Table */}
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ width: 32, padding: "10px 12px" }} />
                    {[
                      { key: "recipient", label: "Recipient" },
                      { key: "role", label: "Role" },
                      { key: "sourceType", label: "Source" },
                      { key: "sourceName", label: "Name", wide: true },
                      { key: "overridePct", label: "%" },
                      { key: "gross", label: "Gross" },
                      { key: "adjustments", label: "Adj" },
                      { key: "net", label: "Net" },
                      { key: "status", label: "Status" },
                    ].map(col => (
                      <th key={col.key} onClick={() => doSort(col.key)} style={{
                        textAlign: "left", padding: "10px 12px", fontSize: 11,
                        color: sortCol === col.key ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                        letterSpacing: 1, textTransform: "uppercase",
                        borderBottom: "1px solid rgba(255,255,255,0.06)", ...mono, fontWeight: 600,
                        cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                      }}>
                        {col.label}{sortCol === col.key ? (sortDir === 1 ? " ▲" : " ▼") : ""}
                      </th>
                    ))}
                    <th style={{ width: 40, padding: "10px 8px" }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id}
                      onClick={() => setDetailId(item.id)}
                      style={{ cursor: "pointer", transition: "background 0.15s", background: detailId === item.id ? "rgba(168,85,247,0.06)" : selected.has(item.id) ? "rgba(255,255,255,0.03)" : "transparent" }}
                      onMouseEnter={e => { if (detailId !== item.id && !selected.has(item.id)) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={e => { if (detailId !== item.id && !selected.has(item.id)) e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "8px 12px" }} onClick={e => { e.stopPropagation(); toggleSelect(item.id); }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${selected.has(item.id) ? "#00E6A8" : "rgba(255,255,255,0.15)"}`, background: selected.has(item.id) ? "#00E6A8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#002018", cursor: "pointer" }}>
                          {selected.has(item.id) && "✓"}
                        </div>
                      </td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{item.recipient}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700, ...mono, background: item.role === "CP" ? "rgba(0,230,168,0.12)" : item.role === "RVP" ? `${C.gold}12` : `${C.blue}12`, border: `1px solid ${item.role === "CP" ? "rgba(0,230,168,0.25)" : item.role === "RVP" ? `${C.gold}25` : `${C.blue}25`}`, color: item.role === "CP" ? "#00E6A8" : item.role === "RVP" ? C.gold : C.blue }}>{item.role}</span>
                      </td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: item.sourceType === "Licensing" ? PURPLE : "#00E6A8", ...mono, fontWeight: 600 }}>{item.sourceType}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono, fontWeight: 500 }}>{item.sourceName}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500 }}>{item.overridePct}%</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>${item.gross}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: item.adjustments < 0 ? "#E05050" : item.adjustments > 0 ? "#00E6A8" : "rgba(255,255,255,0.35)", ...mono, fontWeight: 600 }}>{item.adjustments !== 0 ? `${item.adjustments > 0 ? "+" : ""}$${item.adjustments}` : "—"}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: "#00E6A8", ...mono, fontWeight: 700 }}>${item.net}</td>
                      <td style={{ padding: "8px 12px" }}><Badge status={item.status} /></td>
                      <td style={{ padding: "8px 8px" }}>
                        {canApprove && <button onClick={e => { e.stopPropagation(); setAdjModal({ id: item.id, type: "bonus", amount: 0, note: "" }); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 14, cursor: "pointer", padding: 0 }}>⚙</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20 }}>
            {[
              { label: "CP Payouts", value: cpTotal, color: "#00E6A8" },
              { label: "RVP Payouts", value: rvpTotal, color: C.gold },
              { label: "Agent Payouts", value: agentTotal, color: C.blue },
              { label: "Company Retained", value: retained, color: "#FFFFFF" },
            ].map(r => (
              <div key={r.label} style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{r.label}</div>
                <div style={{ fontSize: 20, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 4, textShadow: `0 0 10px ${r.color}40` }}>${r.value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Prior runs */}
          <Panel title="PRIOR RUNS" color="rgba(255,255,255,0.45)" style={{ marginTop: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Run ID", "Type", "Period", "Gross", "Held", "Retained", "Status", "Approved", "Date"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)", ...mono, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRIOR_RUNS.map(run => (
                  <tr key={run.id} style={{ transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: PURPLE, ...mono, fontWeight: 600 }}>{run.id}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.75)", ...mono, fontWeight: 500 }}>{run.type}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono, fontWeight: 500 }}>{run.period}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#FFFFFF", ...mono, fontWeight: 600 }}>${run.gross.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: C.gold, ...mono, fontWeight: 600 }}>${run.held.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#00E6A8", ...mono, fontWeight: 600 }}>${run.retained.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px" }}><Badge status={run.status.toLowerCase()} /></td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono }}>{run.approvedBy}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono }}>{run.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* Detail drawer */}
        {detail && (
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", position: "sticky", top: 24, alignSelf: "start", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono }}>LINE DETAIL</span>
              <button onClick={() => setDetailId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Recipient", value: detail.recipient },
                { label: "Role", value: detail.role },
                { label: "Source", value: `${detail.sourceType}: ${detail.sourceName}` },
                { label: "Source Amount", value: `$${detail.sourceAmt.toLocaleString()}` },
                { label: "Rule Applied", value: detail.rule },
                { label: "Override", value: `${detail.overridePct}%` },
                { label: "Gross", value: `$${detail.gross}` },
                { label: "Adjustments", value: `$${detail.adjustments}` },
                { label: "Net Payout", value: `$${detail.net}`, highlight: true },
                { label: "Status", value: detail.status.toUpperCase() },
                { label: "Rule Version", value: "v3" },
                { label: "Notes", value: detail.notes || "—" },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600, marginBottom: 2 }}>{row.label}</div>
                  <div style={{ fontSize: 13, color: row.highlight ? "#00E6A8" : "#FFFFFF", ...mono, fontWeight: row.highlight ? 700 : 500 }}>{row.value}</div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                {canApprove && (
                  <>
                    <button onClick={() => setItems(prev => prev.map(i => i.id === detail.id ? { ...i, status: "held" } : i))} style={{ flex: 1, padding: "6px 0", background: `${C.gold}10`, border: `1px solid ${C.gold}25`, borderRadius: 6, color: C.gold, fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono }}>HOLD</button>
                    <button onClick={() => setAdjModal({ id: detail.id, type: "bonus", amount: 0, note: "" })} style={{ flex: 1, padding: "6px 0", background: `${PURPLE}10`, border: `1px solid ${PURPLE}25`, borderRadius: 6, color: PURPLE, fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono }}>ADJUST</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Adjustment modal */}
      {adjModal && (
        <>
          <div onClick={() => setAdjModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 400, background: "#0C1222", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 1001, padding: "24px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)", ...mono }}>
            <div style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 700, marginBottom: 16 }}>ADJUSTMENT</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>TYPE</div>
              <select value={adjModal.type} onChange={e => setAdjModal(prev => ({ ...prev, type: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#FFFFFF", fontSize: 13, outline: "none" }}>
                {ADJ_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").toUpperCase()}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>AMOUNT</div>
              <input type="number" value={adjModal.amount} onChange={e => setAdjModal(prev => ({ ...prev, amount: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#FFFFFF", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>NOTE</div>
              <input value={adjModal.note} onChange={e => setAdjModal(prev => ({ ...prev, note: e.target.value }))} placeholder="Reason..." style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#FFFFFF", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAdjModal(null)} style={{ flex: 1, padding: "10px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>CANCEL</button>
              <button onClick={applyAdj} style={{ flex: 1, padding: "10px 0", background: "linear-gradient(90deg, #00C896, #00E6A8)", border: "none", borderRadius: 8, color: "#002018", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 14px rgba(0,230,168,0.3)" }}>APPLY</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
