import { useState, useEffect } from "react";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── MOCK DATA PER ROLE ──────────────────────────────────────────────────────

const AGENT_PAYOUTS = [
  { id: 1, date: "2026-03-28", source: "Whitfield Roof Claim", type: "Claim Commission", amount: 710, status: "available", note: "", expected: "2026-04-01" },
  { id: 2, date: "2026-03-26", source: "Park WTP Platinum Enrollment", type: "Protection Plan Sale", amount: 238, status: "available", note: "", expected: "2026-04-01" },
  { id: 3, date: "2026-03-24", source: "Okafor Business Shield", type: "Protection Plan Sale", amount: 478, status: "pending", note: "Awaiting payment confirmation", expected: "2026-04-01" },
  { id: 4, date: "2026-03-22", source: "Vasquez Landlord Pro", type: "Protection Plan Sale", amount: 300, status: "paid", note: "", expected: null, paidDate: "2026-03-18" },
  { id: 5, date: "2026-03-20", source: "Williams Flood Filing", type: "Claim Commission", amount: 320, status: "paid", note: "", expected: null, paidDate: "2026-03-18" },
  { id: 6, date: "2026-03-15", source: "Tran WTP Gold Enrollment", type: "Protection Plan Sale", amount: 118, status: "paid", note: "", expected: null, paidDate: "2026-03-18" },
  { id: 7, date: "2026-03-10", source: "Santos Multi-Unit Claim", type: "Claim Commission", amount: 1000, status: "paid", note: "Adjusted: -$140 (partial verification)", expected: null, paidDate: "2026-03-03" },
  { id: 8, date: "2026-03-05", source: "Referral Bonus — Priya Sharma", type: "Referral Bonus", amount: 100, status: "paid", note: "", expected: null, paidDate: "2026-03-03" },
  { id: 9, date: "2026-02-28", source: "Brooks BI Review", type: "Claim Commission", amount: 420, status: "on_hold", note: "Pending claim documentation review", expected: "TBD" },
];

const RVP_PAYOUTS = [
  { id: 1, date: "2026-03-28", source: "Agent subscription overrides (6 agents)", cat: "Licensing", amount: 240, status: "available", note: "", expected: "2026-04-01" },
  { id: 2, date: "2026-03-28", source: "Team production override", cat: "Production", amount: 520, status: "available", note: "", expected: "2026-04-01" },
  { id: 3, date: "2026-03-15", source: "Agent subscription overrides (5 agents)", cat: "Licensing", amount: 200, status: "paid", note: "", paidDate: "2026-03-18" },
  { id: 4, date: "2026-03-15", source: "Team production override", cat: "Production", amount: 480, status: "paid", note: "", paidDate: "2026-03-18" },
  { id: 5, date: "2026-03-15", source: "Direct: Whitfield Roof Claim", cat: "Production", amount: 710, status: "paid", note: "", paidDate: "2026-03-18" },
  { id: 6, date: "2026-03-01", source: "Agent subscription overrides (5 agents)", cat: "Licensing", amount: 200, status: "paid", note: "", paidDate: "2026-03-03" },
  { id: 7, date: "2026-03-01", source: "Team production override", cat: "Production", amount: 380, status: "paid", note: "", paidDate: "2026-03-03" },
  { id: 8, date: "2026-02-15", source: "Agent subscription overrides (4 agents)", cat: "Licensing", amount: 160, status: "paid", note: "", paidDate: "2026-02-18" },
  { id: 9, date: "2026-02-10", source: "Santos claim — hold pending verification", cat: "Production", amount: 1140, status: "on_hold", note: "Claim under review", expected: "TBD" },
];

const CP_PAYOUTS = [
  { id: 1, date: "2026-03-28", source: "RVP subscription overrides", cat: "Licensing", territory: "FL + TX", amount: 300, status: "available", note: "", expected: "2026-04-01" },
  { id: 2, date: "2026-03-28", source: "Agent subscription overrides", cat: "Licensing", territory: "FL + TX + GA", amount: 325, status: "available", note: "", expected: "2026-04-01" },
  { id: 3, date: "2026-03-28", source: "Team production override", cat: "Production", territory: "All", amount: 840, status: "pending", note: "Awaiting run approval", expected: "2026-04-01" },
  { id: 4, date: "2026-03-15", source: "RVP subscription overrides", cat: "Licensing", territory: "FL + TX", amount: 300, status: "paid", note: "", paidDate: "2026-03-18" },
  { id: 5, date: "2026-03-15", source: "Agent subscription overrides", cat: "Licensing", territory: "FL + TX + GA", amount: 280, status: "paid", note: "", paidDate: "2026-03-18" },
  { id: 6, date: "2026-03-15", source: "Team production override", cat: "Production", territory: "All", amount: 720, status: "paid", note: "", paidDate: "2026-03-18" },
  { id: 7, date: "2026-03-01", source: "Combined overrides", cat: "Licensing", territory: "FL + TX", amount: 520, status: "paid", note: "", paidDate: "2026-03-03" },
  { id: 8, date: "2026-03-01", source: "Team production override", cat: "Production", territory: "All", amount: 680, status: "paid", note: "", paidDate: "2026-03-03" },
  { id: 9, date: "2026-02-15", source: "GA territory — agent billing dispute", cat: "Licensing", territory: "GA", amount: 40, status: "reversed", note: "Agent billing reversed", paidDate: null },
];

const STATUS_STYLES = {
  available: { label: "AVAILABLE", color: "#00E6A8" },
  pending:   { label: "PENDING", color: C.gold },
  paid:      { label: "PAID", color: "rgba(255,255,255,0.55)" },
  on_hold:   { label: "ON HOLD", color: "#E05050" },
  reversed:  { label: "REVERSED", color: "#E05050" },
};

// ── HELPERS ─────────────────────────────────────────────────────────────────

function KPI({ label, value, color }) {
  return (
    <div style={{ background: "#162238", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 6, textShadow: `0 0 10px ${color}40` }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, ...mono, background: `${s.color}12`, border: `1px solid ${s.color}30`, color: s.color }}>{s.label}</span>;
}

// ── MAIN ────────────────────────────────────────────────────────────────────

export default function MyPayouts() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("all");
  const [detailId, setDetailId] = useState(null);
  const { userRole, territory } = useAxisContext();

  useEffect(() => { setMounted(true); setTab("all"); setDetailId(null); }, [userRole]);

  // Role-specific data
  const isAgent = userRole === "agent";
  const isRVP = userRole === "RVP";
  const isCP = userRole === "CP";
  const rawData = isCP ? CP_PAYOUTS : isRVP ? RVP_PAYOUTS : AGENT_PAYOUTS;

  // Role-specific tabs
  const tabs = isAgent
    ? [{ key: "all", label: "All" }, { key: "pending", label: "Pending" }, { key: "paid", label: "Paid" }, { key: "on_hold", label: "On Hold" }]
    : isRVP
    ? [{ key: "all", label: "All" }, { key: "licensing", label: "Licensing" }, { key: "production", label: "Production" }, { key: "pending", label: "Pending" }, { key: "paid", label: "Paid" }]
    : [{ key: "all", label: "All" }, { key: "licensing", label: "Licensing" }, { key: "production", label: "Production" }, { key: "paid", label: "Paid" }, { key: "on_hold", label: "Holds" }];

  const filtered = rawData.filter(p => {
    if (tab === "all") return true;
    if (tab === "pending") return p.status === "available" || p.status === "pending";
    if (tab === "paid") return p.status === "paid";
    if (tab === "on_hold") return p.status === "on_hold" || p.status === "reversed";
    if (tab === "licensing") return (p.cat || p.type || "").toLowerCase().includes("licens");
    if (tab === "production") return (p.cat || p.type || "").toLowerCase().includes("produc") || (p.type || "").toLowerCase().includes("claim") || (p.type || "").toLowerCase().includes("plan");
    return true;
  });

  const available = rawData.filter(p => p.status === "available").reduce((s, p) => s + p.amount, 0);
  const pendingAmt = rawData.filter(p => p.status === "pending" || p.status === "available").reduce((s, p) => s + p.amount, 0);
  const paidMonth = rawData.filter(p => p.status === "paid" && (p.paidDate || "").startsWith("2026-03")).reduce((s, p) => s + p.amount, 0);
  const paidYTD = rawData.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const licensingTotal = rawData.filter(p => (p.cat || p.type || "").toLowerCase().includes("licens")).reduce((s, p) => s + p.amount, 0);
  const productionTotal = rawData.filter(p => !((p.cat || p.type || "").toLowerCase().includes("licens")) && !((p.type || "").toLowerCase().includes("referral"))).reduce((s, p) => s + p.amount, 0);

  const detail = detailId ? rawData.find(p => p.id === detailId) : null;

  return (
    <div style={{ maxWidth: 1100, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
      <style>{`@keyframes mpFade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>MY PAYOUTS</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>
          {isAgent ? "Your commissions, bonuses, and payout history" : isRVP ? "Your overrides, production commissions, and payout history" : "Your territory overrides, production earnings, and payout history"}
          {" "}· {territory.agentName} ({userRole.toUpperCase()})
        </p>
      </div>

      {/* KPIs — role-specific */}
      <div style={{ display: "grid", gridTemplateColumns: isCP ? "repeat(5, 1fr)" : "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {isAgent ? (
          <>
            <KPI label="Available" value={`$${available.toLocaleString()}`} color="#00E6A8" />
            <KPI label="Pending" value={`$${pendingAmt.toLocaleString()}`} color={C.gold} />
            <KPI label="Paid This Month" value={`$${paidMonth.toLocaleString()}`} color="#00E6A8" />
            <KPI label="Paid YTD" value={`$${paidYTD.toLocaleString()}`} color="#FFFFFF" />
          </>
        ) : isRVP ? (
          <>
            <KPI label="Licensing Overrides" value={`$${licensingTotal.toLocaleString()}`} color={PURPLE} />
            <KPI label="Production Overrides" value={`$${productionTotal.toLocaleString()}`} color="#00E6A8" />
            <KPI label="Pending" value={`$${pendingAmt.toLocaleString()}`} color={C.gold} />
            <KPI label="Paid This Month" value={`$${paidMonth.toLocaleString()}`} color="#FFFFFF" />
          </>
        ) : (
          <>
            <KPI label="Licensing Overrides" value={`$${licensingTotal.toLocaleString()}`} color={PURPLE} />
            <KPI label="Production Overrides" value={`$${productionTotal.toLocaleString()}`} color="#00E6A8" />
            <KPI label="Pending" value={`$${pendingAmt.toLocaleString()}`} color={C.gold} />
            <KPI label="Paid" value={`$${paidMonth.toLocaleString()}`} color="#00E6A8" />
            <KPI label="Net This Month" value={`$${(paidMonth + available).toLocaleString()}`} color="#FFFFFF" />
          </>
        )}
      </div>

      {/* Available payout banner */}
      {available > 0 && (
        <div style={{ padding: "14px 20px", marginBottom: 20, background: "rgba(0,230,168,0.06)", border: "1px solid rgba(0,230,168,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: "#00E6A8", boxShadow: "0 0 6px rgba(0,230,168,0.5)" }} />
            <span style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 600, ...mono }}>${available.toLocaleString()} available for payout</span>
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", ...mono }}>Next payout: April 1, 2026</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: detail ? "1fr 320px" : "1fr", gap: 20 }}>
        <div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {tabs.map(t => {
              const count = t.key === "all" ? rawData.length : filtered.length;
              return (
                <button key={t.key} onClick={() => { setTab(t.key); setDetailId(null); }} style={{
                  padding: "6px 14px", borderRadius: 6,
                  background: tab === t.key ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${tab === t.key ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)"}`,
                  color: tab === t.key ? "#FFFFFF" : "rgba(255,255,255,0.55)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", ...mono,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {t.label}
                </button>
              );
            })}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono, alignSelf: "center" }}>{filtered.length} items</span>
          </div>

          {/* Table */}
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {(isAgent
                    ? ["Date", "Source", "Type", "Amount", "Status"]
                    : isRVP
                    ? ["Date", "Source", "Category", "Amount", "Status"]
                    : ["Date", "Source", "Category", "Territory", "Amount", "Status"]
                  ).map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)", ...mono, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} onClick={() => setDetailId(p.id)} style={{
                    cursor: "pointer", transition: "background 0.15s",
                    background: detailId === p.id ? `${PURPLE}08` : "transparent",
                  }}
                    onMouseEnter={e => { if (detailId !== p.id) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={e => { if (detailId !== p.id) e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono }}>{p.date}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500 }}>{p.source}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700, ...mono,
                        background: (p.cat || p.type || "").toLowerCase().includes("licens") ? `${PURPLE}12` : (p.type || "").toLowerCase().includes("referral") ? `${C.gold}12` : "rgba(0,230,168,0.12)",
                        border: `1px solid ${(p.cat || p.type || "").toLowerCase().includes("licens") ? `${PURPLE}25` : (p.type || "").toLowerCase().includes("referral") ? `${C.gold}25` : "rgba(0,230,168,0.25)"}`,
                        color: (p.cat || p.type || "").toLowerCase().includes("licens") ? PURPLE : (p.type || "").toLowerCase().includes("referral") ? C.gold : "#00E6A8",
                      }}>{(p.cat || p.type || "").toUpperCase()}</span>
                    </td>
                    {isCP && <td style={{ padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono }}>{p.territory || "—"}</td>}
                    <td style={{ padding: "10px 14px", fontSize: 14, color: p.status === "reversed" ? "#E05050" : "#FFFFFF", ...mono, fontWeight: 700 }}>
                      {p.status === "reversed" ? "-" : ""}${p.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 14px" }}><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={isCP ? 6 : 5} style={{ padding: "24px 14px", textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.35)", ...mono }}>No payouts in this category</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail drawer */}
        {detail && (
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", position: "sticky", top: 24, alignSelf: "start", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono }}>PAYOUT DETAIL</span>
              <button onClick={() => setDetailId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              {/* Amount highlight */}
              <div style={{ textAlign: "center", padding: "16px 0 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 }}>
                <div style={{ fontSize: 32, color: detail.status === "reversed" ? "#E05050" : "#FFFFFF", fontWeight: 700, ...mono, textShadow: `0 0 12px ${detail.status === "available" ? "rgba(0,230,168,0.4)" : "rgba(255,255,255,0.1)"}` }}>
                  {detail.status === "reversed" ? "-" : ""}${detail.amount.toLocaleString()}
                </div>
                <div style={{ marginTop: 6 }}><StatusBadge status={detail.status} /></div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Date", value: detail.date },
                  { label: "Source", value: detail.source },
                  { label: "Category", value: detail.cat || detail.type },
                  ...(isCP && detail.territory ? [{ label: "Territory", value: detail.territory }] : []),
                  { label: "Expected Payout", value: detail.expected || detail.paidDate || "—" },
                  ...(detail.paidDate ? [{ label: "Paid Date", value: detail.paidDate }] : []),
                  { label: "Payout Method", value: "Direct deposit (ACH)" },
                  ...(detail.note ? [{ label: "Note", value: detail.note }] : []),
                ].map(r => (
                  <div key={r.label}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600, marginBottom: 2 }}>{r.label}</div>
                    <div style={{ fontSize: 13, color: r.label === "Note" ? C.gold : "#FFFFFF", ...mono, fontWeight: 500 }}>{r.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
