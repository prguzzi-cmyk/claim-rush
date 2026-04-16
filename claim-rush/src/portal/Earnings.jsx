import { useState, useEffect } from "react";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── MOCK DATA ───────────────────────────────────────────────────────────────

const PAYOUTS = {
  agent: [
    { id: 1, date: "2026-03-28", source: "Whitfield Roof Claim", type: "Claim", amount: 710, status: "available" },
    { id: 2, date: "2026-03-26", source: "Park WTP Platinum", type: "Plan Sale", amount: 238, status: "available" },
    { id: 3, date: "2026-03-24", source: "Okafor Business Shield", type: "Plan Sale", amount: 478, status: "pending" },
    { id: 4, date: "2026-03-22", source: "Vasquez Landlord Pro", type: "Plan Sale", amount: 300, status: "paid", paidDate: "2026-03-18" },
    { id: 5, date: "2026-03-20", source: "Williams Flood Filing", type: "Claim", amount: 320, status: "paid", paidDate: "2026-03-18" },
    { id: 6, date: "2026-03-15", source: "Tran WTP Gold", type: "Plan Sale", amount: 118, status: "paid", paidDate: "2026-03-18" },
    { id: 7, date: "2026-03-10", source: "Santos Multi-Unit", type: "Claim", amount: 1000, status: "paid", paidDate: "2026-03-03" },
    { id: 8, date: "2026-03-05", source: "Referral — Priya Sharma", type: "Bonus", amount: 100, status: "paid", paidDate: "2026-03-03" },
  ],
  RVP: [
    { id: 1, date: "2026-03-28", source: "Agent overrides (6)", type: "Licensing", amount: 240, status: "available" },
    { id: 2, date: "2026-03-28", source: "Team production override", type: "Production", amount: 520, status: "available" },
    { id: 3, date: "2026-03-15", source: "Agent overrides (5)", type: "Licensing", amount: 200, status: "paid", paidDate: "2026-03-18" },
    { id: 4, date: "2026-03-15", source: "Team production override", type: "Production", amount: 480, status: "paid", paidDate: "2026-03-18" },
    { id: 5, date: "2026-03-15", source: "Direct: Whitfield Claim", type: "Production", amount: 710, status: "paid", paidDate: "2026-03-18" },
    { id: 6, date: "2026-03-01", source: "Agent overrides (5)", type: "Licensing", amount: 200, status: "paid", paidDate: "2026-03-03" },
    { id: 7, date: "2026-03-01", source: "Team production override", type: "Production", amount: 380, status: "paid", paidDate: "2026-03-03" },
  ],
  CP: [
    { id: 1, date: "2026-03-28", source: "RVP overrides", type: "Licensing", amount: 300, status: "available" },
    { id: 2, date: "2026-03-28", source: "Agent overrides", type: "Licensing", amount: 325, status: "available" },
    { id: 3, date: "2026-03-28", source: "Team production override", type: "Production", amount: 840, status: "pending" },
    { id: 4, date: "2026-03-15", source: "RVP overrides", type: "Licensing", amount: 300, status: "paid", paidDate: "2026-03-18" },
    { id: 5, date: "2026-03-15", source: "Agent overrides", type: "Licensing", amount: 280, status: "paid", paidDate: "2026-03-18" },
    { id: 6, date: "2026-03-15", source: "Team production override", type: "Production", amount: 720, status: "paid", paidDate: "2026-03-18" },
    { id: 7, date: "2026-03-01", source: "Combined overrides", type: "Licensing", amount: 520, status: "paid", paidDate: "2026-03-03" },
  ],
};

const STATUS_STYLES = {
  available: { label: "AVAILABLE", color: "#00E6A8" },
  pending:   { label: "PENDING", color: C.gold },
  paid:      { label: "PAID", color: "rgba(255,255,255,0.45)" },
};

// ── MAIN ────────────────────────────────────────────────────────────────────

export default function Earnings() {
  const { userRole, territory } = useAxisContext();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("overview");
  const [detailId, setDetailId] = useState(null);

  useEffect(() => { setMounted(true); setTab("overview"); setDetailId(null); }, [userRole]);

  const data = PAYOUTS[userRole] || PAYOUTS.agent;
  const available = data.filter(p => p.status === "available").reduce((s, p) => s + p.amount, 0);
  const pendingAmt = data.filter(p => p.status === "available" || p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const paidMonth = data.filter(p => p.status === "paid" && (p.paidDate || "").includes("2026-03")).reduce((s, p) => s + p.amount, 0);
  const paidYTD = data.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const total = data.reduce((s, p) => s + p.amount, 0);

  const filtered = tab === "overview" ? data
    : tab === "pending" ? data.filter(p => p.status === "available" || p.status === "pending")
    : data.filter(p => p.status === "paid");

  const detail = detailId ? data.find(p => p.id === detailId) : null;

  return (
    <div style={{ maxWidth: 1000, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>EARNINGS</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>Your income, pending payouts, and payment history</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <div style={{ background: "#162238", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>Available</div>
          <div style={{ fontSize: 26, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 6, textShadow: "0 0 10px rgba(0,230,168,0.4)" }}>${available.toLocaleString()}</div>
        </div>
        <div style={{ background: "#162238", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>Pending</div>
          <div style={{ fontSize: 26, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 6, textShadow: `0 0 10px ${C.gold}40` }}>${pendingAmt.toLocaleString()}</div>
        </div>
        <div style={{ background: "#162238", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>Paid This Month</div>
          <div style={{ fontSize: 26, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 6, textShadow: "0 0 10px rgba(0,230,168,0.4)" }}>${paidMonth.toLocaleString()}</div>
        </div>
        <div style={{ background: "#162238", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>Total YTD</div>
          <div style={{ fontSize: 26, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 6 }}>${paidYTD.toLocaleString()}</div>
        </div>
      </div>

      {/* Available banner */}
      {available > 0 && (
        <div style={{ padding: "12px 18px", marginBottom: 20, background: "rgba(0,230,168,0.06)", border: "1px solid rgba(0,230,168,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: "#00E6A8", boxShadow: "0 0 6px rgba(0,230,168,0.5)" }} />
            <span style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 600, ...mono }}>${available.toLocaleString()} available for payout</span>
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", ...mono }}>Next: April 1</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[{ key: "overview", label: "Overview" }, { key: "pending", label: "Pending" }, { key: "paid", label: "Paid" }].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setDetailId(null); }} style={{
            padding: "7px 16px", borderRadius: 6,
            background: tab === t.key ? "rgba(0,230,168,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${tab === t.key ? "rgba(0,230,168,0.30)" : "rgba(255,255,255,0.08)"}`,
            color: tab === t.key ? "#00E6A8" : "rgba(255,255,255,0.55)",
            fontSize: 13, fontWeight: 700, cursor: "pointer", ...mono,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: detail ? "1fr 300px" : "1fr", gap: 20 }}>
        {/* Table */}
        <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Date", "Source", "Type", "Amount", "Status"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)", ...mono, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const st = STATUS_STYLES[p.status] || STATUS_STYLES.pending;
                const typeColor = p.type === "Licensing" ? PURPLE : p.type === "Bonus" ? C.gold : "#00E6A8";
                return (
                  <tr key={p.id} onClick={() => setDetailId(p.id)} style={{ cursor: "pointer", transition: "background 0.15s", background: detailId === p.id ? `${PURPLE}08` : "transparent" }}
                    onMouseEnter={e => { if (detailId !== p.id) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={e => { if (detailId !== p.id) e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono }}>{p.date}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500 }}>{p.source}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700, ...mono, background: `${typeColor}12`, border: `1px solid ${typeColor}25`, color: typeColor }}>{p.type.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 14, color: "#FFFFFF", ...mono, fontWeight: 700 }}>${p.amount.toLocaleString()}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, ...mono, background: `${st.color}12`, border: `1px solid ${st.color}30`, color: st.color }}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.35)", ...mono }}>No items</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail drawer */}
        {detail && (
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", position: "sticky", top: 24, alignSelf: "start" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono }}>DETAIL</span>
              <button onClick={() => setDetailId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 28, color: "#FFFFFF", fontWeight: 700, ...mono }}>${detail.amount.toLocaleString()}</div>
                <div style={{ marginTop: 6 }}><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, ...mono, background: `${(STATUS_STYLES[detail.status]?.color || C.gold)}12`, border: `1px solid ${(STATUS_STYLES[detail.status]?.color || C.gold)}30`, color: STATUS_STYLES[detail.status]?.color }}>{STATUS_STYLES[detail.status]?.label}</span></div>
              </div>
              {[
                { label: "Date", value: detail.date },
                { label: "Source", value: detail.source },
                { label: "Type", value: detail.type },
                ...(detail.paidDate ? [{ label: "Paid", value: detail.paidDate }] : [{ label: "Expected", value: "April 1, 2026" }]),
                { label: "Method", value: "ACH Direct Deposit" },
              ].map(r => (
                <div key={r.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>{r.label}</div>
                  <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500, marginTop: 1 }}>{r.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
