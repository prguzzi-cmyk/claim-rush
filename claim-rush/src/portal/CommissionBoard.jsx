import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { C } from "./theme";
import PageHeader from "./shared/PageHeader";

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
      </div>
      <PageHeader
        title="Commission"
        subtitle="Override earnings, territory revenue, and recent ledger activity."
        kicker="Revenue Ops"
        accent="#00E6A8"
      />

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
      position: "relative",
      padding: "16px 18px",
      background: `linear-gradient(135deg, ${accent}10 0%, ${accent}02 100%)`,
      border: `1px solid ${accent}30`,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: `0 4px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 16px ${accent}10`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: accent, boxShadow: `0 0 8px ${accent}aa`, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: -30, right: -30,
        width: 110, height: 110,
        background: `radial-gradient(circle, ${accent}20 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", gap: 6,
        ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
        textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
        marginBottom: 4,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: 3,
          background: accent, boxShadow: `0 0 5px ${accent}`,
          display: "inline-block",
        }} />
        {label}
      </div>
      <div style={{
        position: "relative", zIndex: 1,
        ...mono, fontSize: 24, fontWeight: 800, color: accent,
        letterSpacing: -0.2, lineHeight: 1.05,
        textShadow: `0 0 14px ${accent}45, 0 0 5px ${accent}25`,
      }}>
        {value}
      </div>
      <div style={{
        position: "relative", zIndex: 1,
        ...mono, fontSize: 9, color: "rgba(255,255,255,0.40)",
        letterSpacing: 1.2, textTransform: "uppercase",
        marginTop: 6, fontWeight: 700,
      }}>
        {sub}
      </div>
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: 3,
          background: "#00E6A8",
          boxShadow: "0 0 5px rgba(0,230,168,0.70)",
          display: "inline-block",
        }} />
        <span style={{
          fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.78)",
          letterSpacing: 1.8, ...mono, textTransform: "uppercase",
        }}>
          {title}
        </span>
        <span style={{
          flex: 1, height: 1,
          background: "linear-gradient(90deg, rgba(0,230,168,0.20) 0%, rgba(255,255,255,0.04) 60%, transparent 100%)",
        }} />
      </div>
      <div style={{
        fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono,
        marginBottom: 14, letterSpacing: 0.4, lineHeight: 1.5,
      }}>
        {sub}
      </div>
      {children}
    </div>
  );
}

function SettlementRow({ s }) {
  return (
    <div
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.borderColor = "rgba(0,230,168,0.40)";
        e.currentTarget.style.background = "linear-gradient(135deg, rgba(0,230,168,0.08) 0%, rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.01) 100%)";
        e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,0,0,0.40), 0 0 0 1px rgba(0,230,168,0.22), 0 0 20px rgba(0,230,168,0.16)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.28), 0 0 12px rgba(0,230,168,0.08)";
      }}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        alignItems: "center",
        gap: 16,
        padding: "14px 18px 14px 22px",
        background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.28), 0 0 12px rgba(0,230,168,0.08)",
        transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
      }}>
      {/* Settlement-positive left edge accent (green = closed/settled revenue) */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: "#00E6A8",
        boxShadow: "0 0 10px rgba(0,230,168,0.55)",
        pointerEvents: "none",
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", ...mono, letterSpacing: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {s.client_name || "(Unnamed)"}
          <span style={{
            fontWeight: 700, marginLeft: 10,
            color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", fontSize: 10,
          }}>{s.claim_number}</span>
        </div>
        <div style={{
          fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4, ...mono,
          letterSpacing: 0.5, fontWeight: 600,
        }}>
          {s.agent_name || "UNASSIGNED"}
          <span style={{ color: "rgba(255,255,255,0.30)" }}> · SETTLED {fmtDate(s.settled_at).toUpperCase()}</span>
        </div>
      </div>

      {/* Gross fee */}
      <div style={{ textAlign: "right" }}>
        <div style={{
          fontSize: 9, color: "rgba(255,255,255,0.45)",
          letterSpacing: 1.4, ...mono, fontWeight: 800, textTransform: "uppercase",
          marginBottom: 2,
        }}>Gross Fee</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", ...mono, letterSpacing: 0.3 }}>
          {fmtUSD(s.gross_fee)}
        </div>
      </div>

      {/* CP override */}
      <div style={{
        textAlign: "right",
        paddingLeft: 16,
        borderLeft: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{
          fontSize: 9, color: "rgba(255,255,255,0.45)",
          letterSpacing: 1.4, ...mono, fontWeight: 800, textTransform: "uppercase",
          marginBottom: 2,
        }}>Your Override</div>
        <div style={{
          fontSize: 14, fontWeight: 800, color: "#00E6A8", ...mono, letterSpacing: 0.3,
          textShadow: "0 0 10px rgba(0,230,168,0.30)",
        }}>
          {fmtUSD(s.cp_override_amount)}
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ row, divider }) {
  const meta = txnMeta(row.txn_type);
  const isNegative = Number(row.amount) < 0;
  const amountColor = isNegative ? "#E05050" : "#00E6A8";
  return (
    <div
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${meta.color}0d`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "92px 1fr auto auto",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        borderBottom: divider ? "1px solid rgba(255,255,255,0.05)" : "none",
        transition: "background 0.18s ease",
      }}>
      <div style={{
        fontSize: 10, color: "rgba(255,255,255,0.45)", ...mono,
        letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
      }}>
        {fmtDate(row.occurred_at)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", ...mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: 0.3 }}>
          {row.client_name || row.notes || "—"}
          {row.claim_number && (
            <span style={{
              fontWeight: 700, marginLeft: 8,
              color: "rgba(255,255,255,0.40)", letterSpacing: 1, textTransform: "uppercase", fontSize: 10,
            }}>
              {row.claim_number}
            </span>
          )}
        </div>
        {row.notes && row.client_name && (
          <div style={{
            fontSize: 10, color: "rgba(255,255,255,0.40)",
            marginTop: 3, ...mono, letterSpacing: 0.4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {row.notes}
          </div>
        )}
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 8px",
        background: `${meta.color}14`,
        border: `1px solid ${meta.color}45`,
        borderRadius: 3,
        color: meta.color,
        fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
        ...mono, textTransform: "uppercase",
      }}>
        <span style={{
          width: 4, height: 4, borderRadius: 2,
          background: meta.color, boxShadow: `0 0 4px ${meta.color}`,
        }} />
        {meta.label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 800, color: amountColor,
        ...mono, letterSpacing: 0.3, textAlign: "right", minWidth: 84,
        textShadow: `0 0 10px ${amountColor}28`,
      }}>
        {fmtUSD(row.amount)}
      </div>
    </div>
  );
}
