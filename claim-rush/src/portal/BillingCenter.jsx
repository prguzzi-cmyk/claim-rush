import { useState, useEffect } from "react";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── MOCK DATA ───────────────────────────────────────────────────────────────

const BILLING_ACCOUNTS = [
  { id: 1, user: "Sarah Kim", role: "CP", territory: "FL", fee: 2000, status: "current", lastPayment: "2026-03-01", nextBilling: "2026-04-01", autopay: true, walletCredit: 325, amountDue: 0, suspended: false, card: "Visa •••4821", commDue: 481, commPaid: 1240 },
  { id: 2, user: "Marcus Lee", role: "RVP", territory: "GA", fee: 1000, status: "current", lastPayment: "2026-03-01", nextBilling: "2026-04-01", autopay: true, walletCredit: 0, amountDue: 0, suspended: false, card: "MC •••3310", commDue: 830, commPaid: 2100 },
  { id: 3, user: "James Obi", role: "RVP", territory: "TX", fee: 1000, status: "past_due", lastPayment: "2026-02-01", nextBilling: "2026-03-01", autopay: false, walletCredit: 150, amountDue: 1000, suspended: false, card: "Visa •••7742", commDue: 1300, commPaid: 890 },
  { id: 4, user: "Alex Chen", role: "Agent", territory: "NC", fee: 500, status: "current", lastPayment: "2026-03-15", nextBilling: "2026-04-15", autopay: true, walletCredit: 0, amountDue: 0, suspended: false, card: "Amex •••1199", commDue: 356, commPaid: 712 },
  { id: 5, user: "Priya Sharma", role: "Agent", territory: "FL", fee: 500, status: "current", lastPayment: "2026-03-10", nextBilling: "2026-04-10", autopay: true, walletCredit: 50, amountDue: 0, suspended: false, card: "Visa •••8834", commDue: 478, commPaid: 956 },
  { id: 6, user: "David Kim", role: "Agent", territory: "CO", fee: 500, status: "failed", lastPayment: "2026-02-20", nextBilling: "2026-03-20", autopay: true, walletCredit: 0, amountDue: 500, suspended: false, card: "MC •••2201", commDue: 320, commPaid: 0 },
  { id: 7, user: "Rachel Torres", role: "Agent", territory: "AZ", fee: 299, status: "current", lastPayment: "2026-03-25", nextBilling: "2026-04-25", autopay: true, walletCredit: 0, amountDue: 0, suspended: false, card: "Visa •••5567", commDue: 300, commPaid: 0 },
  { id: 8, user: "Tanya Brooks", role: "Agent", territory: "TX", fee: 500, status: "suspended", lastPayment: "2026-01-15", nextBilling: "—", autopay: false, walletCredit: 0, amountDue: 1500, suspended: true, card: "None", commDue: 0, commPaid: 0 },
  { id: 9, user: "Carlos Vega", role: "Agent", territory: "LA", fee: 500, status: "current", lastPayment: "2026-03-20", nextBilling: "2026-04-20", autopay: true, walletCredit: 75, amountDue: 0, suspended: false, card: "Visa •••9912", commDue: 280, commPaid: 560 },
  { id: 10, user: "Nina Patel", role: "RVP", territory: "TN", fee: 1000, status: "pending", lastPayment: "2026-03-01", nextBilling: "2026-04-01", autopay: true, walletCredit: 200, amountDue: 0, suspended: false, card: "MC •••6643", commDue: 540, commPaid: 1080 },
];

const WALLET_LEDGER = [
  { date: "2026-03-28", type: "Credit", amount: 100, source: "Referral bonus", note: "Referred Nina Patel", by: "System" },
  { date: "2026-03-25", type: "Credit", amount: 50, source: "Promo credit", note: "Q2 launch promo", by: "Admin" },
  { date: "2026-03-20", type: "Debit", amount: -75, source: "Fee offset", note: "Applied to March billing", by: "System" },
  { date: "2026-03-15", type: "Credit", amount: 200, source: "Commission advance", note: "Advance on pending payout", by: "Admin" },
  { date: "2026-03-01", type: "Credit", amount: 50, source: "Loyalty credit", note: "6-month anniversary", by: "System" },
];

const ALERTS = [
  { type: "failed", msg: "David Kim — payment failed (card declined)", color: "#E05050" },
  { type: "past_due", msg: "James Obi — $1,000 past due (32 days)", color: C.gold },
  { type: "suspended", msg: "Tanya Brooks — suspended, $1,500 outstanding", color: "#E05050" },
  { type: "renewal", msg: "5 accounts renewing in next 7 days", color: C.blue },
  { type: "wallet", msg: "Sarah Kim — $325 wallet credit available", color: PURPLE },
];

const STATUS_MAP = {
  current:   { label: "CURRENT", bg: "rgba(0,230,168,0.12)", border: "rgba(0,230,168,0.25)", color: "#00E6A8" },
  pending:   { label: "PENDING", bg: `${PURPLE}12`, border: `${PURPLE}25`, color: PURPLE },
  past_due:  { label: "PAST DUE", bg: `${C.gold}12`, border: `${C.gold}25`, color: C.gold },
  failed:    { label: "FAILED", bg: "rgba(224,80,80,0.12)", border: "rgba(224,80,80,0.25)", color: "#E05050" },
  suspended: { label: "SUSPENDED", bg: "rgba(224,80,80,0.12)", border: "rgba(224,80,80,0.25)", color: "#E05050" },
  canceled:  { label: "CANCELED", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" },
};

// ── COMPONENT ───────────────────────────────────────────────────────────────

export default function BillingCenter() {
  const { permissions } = useAxisContext();
  const canManage = permissions.canSeeBilling;

  const [mounted, setMounted] = useState(false);
  const [accounts, setAccounts] = useState(BILLING_ACCOUNTS);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [detailId, setDetailId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [actionFeedback, setActionFeedback] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  const filtered = accounts.filter(a => {
    if (search && !a.user.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole !== "all" && a.role !== filterRole) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  });

  const detail = detailId ? accounts.find(a => a.id === detailId) : null;
  const totalBilled = accounts.reduce((s, a) => s + a.fee, 0);
  const totalCollected = accounts.filter(a => a.status === "current" || a.status === "pending").reduce((s, a) => s + a.fee, 0);
  const totalPastDue = accounts.filter(a => a.amountDue > 0).reduce((s, a) => s + a.amountDue, 0);
  const totalWallet = accounts.reduce((s, a) => s + a.walletCredit, 0);
  const totalCommDue = accounts.reduce((s, a) => s + a.commDue, 0);
  const netPosition = totalCollected - totalCommDue + totalWallet;

  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const doAction = (msg) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const retryPayment = (id) => {
    if (!canManage) return;
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, status: "pending", amountDue: 0, lastPayment: new Date().toISOString().split("T")[0] } : a));
    doAction("Payment retry initiated");
  };

  const suspendAccount = (id) => {
    if (!canManage) return;
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, status: "suspended", suspended: true } : a));
    doAction("Account suspended");
  };

  const reinstateAccount = (id) => {
    if (!canManage) return;
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, status: "current", suspended: false, amountDue: 0 } : a));
    doAction("Account reinstated");
  };

  const applyCredit = (id) => {
    if (!canManage) return;
    setAccounts(prev => prev.map(a => {
      if (a.id !== id || a.walletCredit <= 0) return a;
      const applied = Math.min(a.walletCredit, a.amountDue);
      return { ...a, walletCredit: a.walletCredit - applied, amountDue: a.amountDue - applied, status: a.amountDue - applied <= 0 ? "current" : a.status };
    }));
    doAction("Wallet credit applied");
  };

  const SBadge = ({ status }) => {
    const s = STATUS_MAP[status] || STATUS_MAP.canceled;
    return <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, ...mono, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>{s.label}</span>;
  };

  return (
    <div style={{ maxWidth: 1300, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
      <style>{`@keyframes bcFade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>BILLING + WALLET CENTER</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>Manage platform fees, payment status, wallet credits, commissions due, and payout balances.</p>
      </div>

      {/* Feedback toast */}
      {actionFeedback && (
        <div style={{ padding: "10px 20px", marginBottom: 16, background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.20)", borderRadius: 8, fontSize: 13, color: "#00E6A8", ...mono, fontWeight: 600, animation: "bcFade 0.2s ease both" }}>
          ✓ {actionFeedback}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Billed", value: `$${totalBilled.toLocaleString()}`, color: "#FFFFFF" },
          { label: "Collected", value: `$${totalCollected.toLocaleString()}`, color: "#00E6A8" },
          { label: "Past Due", value: `$${totalPastDue.toLocaleString()}`, color: totalPastDue > 0 ? "#E05050" : "rgba(255,255,255,0.45)" },
          { label: "Wallet Credits", value: `$${totalWallet.toLocaleString()}`, color: PURPLE },
          { label: "Comm. Due", value: `$${totalCommDue.toLocaleString()}`, color: C.gold },
          { label: "Net Position", value: `$${netPosition.toLocaleString()}`, color: netPosition >= 0 ? "#00E6A8" : "#E05050" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#162238", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 4, textShadow: `0 0 10px ${kpi.color}40` }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {ALERTS.map((a, i) => (
          <div key={i} style={{ padding: "6px 12px", background: `${a.color}08`, border: `1px solid ${a.color}20`, borderRadius: 6, fontSize: 12, color: a.color, ...mono, fontWeight: 600 }}>
            {a.msg}
          </div>
        ))}
      </div>

      {/* Bulk actions — home_office only */}
      {canManage && (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { label: "Retry Failed", color: C.gold, action: () => doAction("Retrying failed payments...") },
          { label: "Apply Promo Credit", color: PURPLE },
          { label: "Extend Grace", color: C.blue },
          { label: "Suspend Selected", color: "#E05050", action: () => { selected.forEach(id => suspendAccount(id)); setSelected(new Set()); } },
          { label: "Reinstate Selected", color: "#00E6A8", action: () => { selected.forEach(id => reinstateAccount(id)); setSelected(new Set()); } },
          { label: "Export Report", color: "rgba(255,255,255,0.55)" },
          { label: "Send Reminders", color: C.gold },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action} style={{
            padding: "6px 14px", background: `${btn.color}10`, border: `1px solid ${btn.color}30`,
            borderRadius: 6, color: btn.color, fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono,
          }}>{btn.label}</button>
        ))}
      </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: detailId ? "1fr 360px" : "1fr", gap: 20 }}>
        {/* Main table */}
        <div>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user..." style={{ padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#FFFFFF", fontSize: 12, ...mono, outline: "none", width: 180 }} />
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#FFFFFF", fontSize: 12, ...mono, outline: "none" }}>
              <option value="all">All Roles</option><option value="CP">CP</option><option value="RVP">RVP</option><option value="Agent">Agent</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#FFFFFF", fontSize: 12, ...mono, outline: "none" }}>
              <option value="all">All Status</option><option value="current">Current</option><option value="pending">Pending</option><option value="past_due">Past Due</option><option value="failed">Failed</option><option value="suspended">Suspended</option>
            </select>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono }}>{filtered.length} accounts</span>
          </div>

          {/* Table */}
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
                <thead>
                  <tr>
                    <th style={{ width: 32, padding: "10px 10px" }} />
                    {["User", "Role", "Territory", "Fee", "Status", "Last Paid", "Next Bill", "Wallet", "Due", "Net Bal"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 10px", fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)", ...mono, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => {
                    const netBal = a.commDue - a.amountDue + a.walletCredit;
                    return (
                      <tr key={a.id} onClick={() => setDetailId(a.id)} style={{ cursor: "pointer", transition: "background 0.15s", background: detailId === a.id ? `${PURPLE}08` : selected.has(a.id) ? "rgba(255,255,255,0.03)" : "transparent" }}
                        onMouseEnter={e => { if (detailId !== a.id && !selected.has(a.id)) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                        onMouseLeave={e => { if (detailId !== a.id && !selected.has(a.id)) e.currentTarget.style.background = "transparent"; }}>
                        <td style={{ padding: "8px 10px" }} onClick={e => { e.stopPropagation(); toggleSelect(a.id); }}>
                          <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${selected.has(a.id) ? "#00E6A8" : "rgba(255,255,255,0.15)"}`, background: selected.has(a.id) ? "#00E6A8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#002018", cursor: "pointer" }}>{selected.has(a.id) && "✓"}</div>
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{a.user}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700, ...mono, background: a.role === "CP" ? "rgba(0,230,168,0.12)" : a.role === "RVP" ? `${C.gold}12` : `${C.blue}12`, border: `1px solid ${a.role === "CP" ? "rgba(0,230,168,0.25)" : a.role === "RVP" ? `${C.gold}25` : `${C.blue}25`}`, color: a.role === "CP" ? "#00E6A8" : a.role === "RVP" ? C.gold : C.blue }}>{a.role}</span>
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono }}>{a.territory}</td>
                        <td style={{ padding: "8px 10px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>${a.fee}</td>
                        <td style={{ padding: "8px 10px" }}><SBadge status={a.status} /></td>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono }}>{a.lastPayment}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono }}>{a.nextBilling}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: a.walletCredit > 0 ? PURPLE : "rgba(255,255,255,0.35)", ...mono, fontWeight: a.walletCredit > 0 ? 600 : 500 }}>{a.walletCredit > 0 ? `$${a.walletCredit}` : "—"}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: a.amountDue > 0 ? "#E05050" : "rgba(255,255,255,0.35)", ...mono, fontWeight: a.amountDue > 0 ? 700 : 500 }}>{a.amountDue > 0 ? `$${a.amountDue}` : "—"}</td>
                        <td style={{ padding: "8px 10px", fontSize: 13, color: netBal >= 0 ? "#00E6A8" : "#E05050", ...mono, fontWeight: 700 }}>{netBal >= 0 ? "" : "-"}${Math.abs(netBal).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reconciliation */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 20 }}>
            {[
              { label: "Total Billed", value: `$${totalBilled.toLocaleString()}`, color: "#FFFFFF" },
              { label: "Collected + Credits", value: `$${(totalCollected + totalWallet).toLocaleString()}`, color: "#00E6A8" },
              { label: "Commissions Due", value: `$${totalCommDue.toLocaleString()}`, color: C.gold },
            ].map(r => (
              <div key={r.label} style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{r.label}</div>
                <div style={{ fontSize: 20, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 4, textShadow: `0 0 10px ${r.color}40` }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail drawer */}
        {detail && (
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", position: "sticky", top: 24, alignSelf: "start", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono }}>{detail.user}</span>
              <button onClick={() => setDetailId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              {/* Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Role", value: detail.role },
                  { label: "Territory", value: detail.territory },
                  { label: "Plan", value: `$${detail.fee}/mo` },
                  { label: "Status", value: detail.status.replace("_", " ").toUpperCase() },
                  { label: "Card", value: detail.card },
                  { label: "Autopay", value: detail.autopay ? "Yes" : "No" },
                ].map(r => (
                  <div key={r.label}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600, marginBottom: 2 }}>{r.label}</div>
                    <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500 }}>{r.value}</div>
                  </div>
                ))}
              </div>

              {/* Net balance */}
              {(() => {
                const nb = detail.commDue - detail.amountDue + detail.walletCredit;
                return (
                  <div style={{ padding: "12px 14px", background: nb >= 0 ? "rgba(0,230,168,0.06)" : "rgba(224,80,80,0.06)", border: `1px solid ${nb >= 0 ? "rgba(0,230,168,0.15)" : "rgba(224,80,80,0.15)"}`, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600, marginBottom: 4 }}>NET BALANCE</div>
                    <div style={{ fontSize: 20, color: nb >= 0 ? "#00E6A8" : "#E05050", fontWeight: 700, ...mono }}>{nb >= 0 ? "" : "-"}${Math.abs(nb).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono, marginTop: 4 }}>
                      Comm due ${detail.commDue} - Owed ${detail.amountDue} + Wallet ${detail.walletCredit}
                    </div>
                  </div>
                );
              })()}

              {/* Commission summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>COMM. DUE</div>
                  <div style={{ fontSize: 16, color: C.gold, fontWeight: 700, ...mono, marginTop: 2 }}>${detail.commDue}</div>
                </div>
                <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>COMM. PAID</div>
                  <div style={{ fontSize: 16, color: "#00E6A8", fontWeight: 700, ...mono, marginTop: 2 }}>${detail.commPaid}</div>
                </div>
              </div>

              {/* Wallet ledger (sample) */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600, marginBottom: 8 }}>WALLET LEDGER</div>
                {WALLET_LEDGER.slice(0, 3).map((entry, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", ...mono, fontWeight: 500 }}>{entry.source}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", ...mono }}>{entry.date}</div>
                    </div>
                    <span style={{ fontSize: 13, color: entry.amount >= 0 ? "#00E6A8" : "#E05050", ...mono, fontWeight: 700 }}>
                      {entry.amount >= 0 ? "+" : ""}${entry.amount}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {detail.amountDue > 0 && (
                  <>
                    <button onClick={() => retryPayment(detail.id)} style={{ padding: "8px 0", background: `${C.gold}10`, border: `1px solid ${C.gold}25`, borderRadius: 6, color: C.gold, fontSize: 12, fontWeight: 700, cursor: "pointer", ...mono }}>RETRY PAYMENT</button>
                    {detail.walletCredit > 0 && (
                      <button onClick={() => applyCredit(detail.id)} style={{ padding: "8px 0", background: `${PURPLE}10`, border: `1px solid ${PURPLE}25`, borderRadius: 6, color: PURPLE, fontSize: 12, fontWeight: 700, cursor: "pointer", ...mono }}>APPLY WALLET CREDIT</button>
                    )}
                  </>
                )}
                {detail.suspended ? (
                  <button onClick={() => reinstateAccount(detail.id)} style={{ padding: "8px 0", background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.25)", borderRadius: 6, color: "#00E6A8", fontSize: 12, fontWeight: 700, cursor: "pointer", ...mono }}>REINSTATE</button>
                ) : (
                  <button onClick={() => suspendAccount(detail.id)} style={{ padding: "8px 0", background: "rgba(224,80,80,0.08)", border: "1px solid rgba(224,80,80,0.20)", borderRadius: 6, color: "#E05050", fontSize: 12, fontWeight: 700, cursor: "pointer", ...mono }}>SUSPEND</button>
                )}
                <button onClick={() => doAction("Invoice resent")} style={{ padding: "8px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 600, cursor: "pointer", ...mono }}>RESEND INVOICE</button>
                <button onClick={() => doAction("Payment link sent")} style={{ padding: "8px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 600, cursor: "pointer", ...mono }}>SEND PAYMENT LINK</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
