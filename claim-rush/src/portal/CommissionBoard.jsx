import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { C } from "./theme";

/**
 * Commission — CP's full commission picture.
 *
 * Backed by GET /v1/dashboard/cp-commission. Four surfaces:
 *   - 4-KPI row  (Override MTD, Override YTD, Territory MTD, Settlements MTD)
 *   - Settlements this month — per-claim breakdown with CP override amount
 *   - Recent ledger activity — last ~10 CP-bucket transactions
 */

const mono = { fontFamily: "'Courier New', monospace" };

function fmtUSD(v) {
  const n = Number(v || 0);
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  return `${n < 0 ? "-" : ""}$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  catch { return "—"; }
}

// Ledger txn_type → label + color.
const TXN_META = {
  COMMISSION_EARNED: { label: "Earned",          color: "#00E6A8" },
  PAYOUT_ISSUED:     { label: "Payout",          color: C.gold    },
  ADVANCE_ISSUED:    { label: "Advance",         color: "#3B82F6" },
  INTEREST_APPLIED:  { label: "Interest",        color: "#7DD3FC" },
  REPAYMENT_OFFSET:  { label: "Offset",          color: "#A855F7" },
  ADJUSTMENT:        { label: "Adjustment",      color: "rgba(255,255,255,0.55)" },
};
function txnMeta(t) {
  return TXN_META[t] || { label: (t || "TXN").replace(/_/g, " "), color: "rgba(255,255,255,0.55)" };
}

export default function CommissionBoard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiJson("/dashboard/cp-commission")
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e?.status ?? e?.detail ?? e)); setLoading(false); });
  }, []);

  if (loading) {
    return <div style={{ color: C.muted, ...mono, padding: 40 }}>Loading commission…</div>;
  }
  if (error) {
    return <div style={{ color: "#E05050", ...mono, padding: 40 }}>Failed to load commission: {error}</div>;
  }

  const over = data.override_earnings || {};
  const terr = data.territory_revenue || {};
  const settlements = data.settlements_mtd || [];
  const ledger = data.recent_ledger || [];

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <button
          onClick={() => navigate("/portal")}
          style={{
            background: "transparent",
            border: "none",
            color: C.muted,
            fontSize: 12,
            cursor: "pointer",
            padding: "4px 0",
            letterSpacing: 0.5,
            ...mono,
          }}
        >
          ← BACK TO COMMAND CENTER
        </button>
        <h1 style={{ ...mono, fontSize: 22, color: "#fff", fontWeight: 700, margin: "6px 0 4px" }}>
          Commission
        </h1>
        <div style={{ color: C.muted, fontSize: 13, ...mono }}>
          Override earnings, territory revenue, and recent ledger activity.
        </div>
      </div>

      {/* 4-KPI row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 14,
        marginBottom: 24,
      }}>
        <Kpi
          label="OVERRIDE · MTD"
          value={fmtUSD(over.mtd_total)}
          sub={`${over.mtd_claim_count || 0} claim${(over.mtd_claim_count || 0) === 1 ? "" : "s"}`}
          accent="#00E6A8"
        />
        <Kpi
          label="OVERRIDE · YTD"
          value={fmtUSD(over.ytd_total)}
          sub={`${over.ytd_claim_count || 0} claim${(over.ytd_claim_count || 0) === 1 ? "" : "s"}`}
          accent={C.gold}
        />
        <Kpi
          label="TERRITORY FEE · MTD"
          value={fmtUSD(terr.mtd_gross_fee)}
          sub={`${terr.mtd_settled_count || 0} settled`}
          accent="#3B82F6"
        />
        <Kpi
          label="TERRITORY FEE · YTD"
          value={fmtUSD(terr.ytd_gross_fee)}
          sub={`${terr.ytd_settled_count || 0} settled`}
          accent="#7DD3FC"
        />
      </div>

      {/* Settlements this month */}
      <Section
        title="SETTLEMENTS THIS MONTH"
        sub={settlements.length === 0 ? "No settlements yet this month." : `${settlements.length} claim${settlements.length === 1 ? "" : "s"} settled.`}
      >
        {settlements.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {settlements.map(s => (
              <SettlementRow key={s.claim_id} s={s} />
            ))}
          </div>
        )}
      </Section>

      {/* Recent ledger activity */}
      <Section
        title="RECENT LEDGER ACTIVITY"
        sub={ledger.length === 0 ? "No transactions yet." : "Last 10 CP-bucket entries."}
      >
        {ledger.length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            overflow: "hidden",
          }}>
            {ledger.map((row, idx) => (
              <LedgerRow key={row.id} row={row} divider={idx < ledger.length - 1} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function Kpi({ label, value, sub, accent }) {
  return (
    <div style={{
      padding: "18px 20px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      borderTop: `2px solid ${accent}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1.5, ...mono }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent, ...mono, marginTop: 6, letterSpacing: 0.5 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4, ...mono }}>
        {sub}
      </div>
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)",
        letterSpacing: 1.5, ...mono, marginBottom: 4,
      }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: C.muted, ...mono, marginBottom: 12 }}>
        {sub}
      </div>
      {children}
    </div>
  );
}

function SettlementRow({ s }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr auto auto",
      alignItems: "center",
      gap: 16,
      padding: "14px 18px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", ...mono, letterSpacing: 0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {s.client_name || "(Unnamed)"}
          <span style={{ fontWeight: 400, color: C.muted, marginLeft: 8 }}>· {s.claim_number}</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3, ...mono }}>
          {s.agent_name || "Unassigned"} · settled {fmtDate(s.settled_at)}
        </div>
      </div>

      {/* Gross fee */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, ...mono }}>GROSS FEE</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", ...mono }}>{fmtUSD(s.gross_fee)}</div>
      </div>

      {/* CP override */}
      <div style={{
        textAlign: "right",
        paddingLeft: 16,
        borderLeft: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, ...mono }}>YOUR OVERRIDE</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#00E6A8", ...mono }}>{fmtUSD(s.cp_override_amount)}</div>
      </div>
    </div>
  );
}

function LedgerRow({ row, divider }) {
  const meta = txnMeta(row.txn_type);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "80px 1fr auto auto",
      alignItems: "center",
      gap: 14,
      padding: "12px 18px",
      borderBottom: divider ? "1px solid rgba(255,255,255,0.05)" : "none",
    }}>
      <div style={{ fontSize: 11, color: C.muted, ...mono, letterSpacing: 0.5 }}>
        {fmtDate(row.occurred_at)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", ...mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.client_name || row.notes || "—"}
          {row.claim_number && (
            <span style={{ fontWeight: 400, color: C.muted, marginLeft: 6, fontSize: 11 }}>
              {row.claim_number}
            </span>
          )}
        </div>
        {row.notes && row.client_name && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2, ...mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.notes}
          </div>
        )}
      </div>
      <div style={{
        padding: "3px 8px",
        background: `${meta.color}14`,
        border: `1px solid ${meta.color}40`,
        borderRadius: 4,
        color: meta.color,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1,
        ...mono,
      }}>
        {meta.label.toUpperCase()}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: Number(row.amount) < 0 ? "#E05050" : "#00E6A8",
        ...mono, letterSpacing: 0.3, textAlign: "right", minWidth: 80,
      }}>
        {fmtUSD(row.amount)}
      </div>
    </div>
  );
}
