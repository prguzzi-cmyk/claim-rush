import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { C } from "./theme";

/**
 * My Cases — claim-centric operational board for adjusters.
 *
 * Backed by GET /v1/reports/claims/advanced-search (the same endpoint
 * the RIN Claims Dashboard uses). The backend already filters by
 * `assigned_to` for non-admin users, so an adjuster sees only the
 * claims they own. No new endpoints; no schema change.
 *
 * Pattern mirrors LeadsBoard / ClientsBoard so the visual language and
 * dark-theme styling stay consistent. Detail surface is a slide-over
 * panel rendered in the same component (no separate route).
 */

const mono = { fontFamily: "'Courier New', monospace" };

// Phase → display meta. Mirrors ClientsBoard.STAGE_META but uses
// `current_phase` values produced by the backend ClaimPhases enum.
const PHASE_META = {
  "claim-reported":         { label: "REPORTED",          color: C.muted,   bucket: "active" },
  "intake-signed":          { label: "INTAKE SIGNED",     color: C.muted,   bucket: "active" },
  "inspection-scheduled":   { label: "INSPECTION SCHED",  color: "#3B82F6", bucket: "active" },
  "inspection-completed":   { label: "INSPECTION DONE",   color: "#3B82F6", bucket: "active" },
  "estimating":             { label: "ESTIMATING",        color: "#7DD3FC", bucket: "active" },
  "estimate-submitted":     { label: "ESTIMATE SENT",     color: "#7DD3FC", bucket: "active" },
  "carrier-review":         { label: "CARRIER REVIEW",    color: C.gold,    bucket: "active" },
  "negotiation":            { label: "NEGOTIATION",       color: "#A855F7", bucket: "active" },
  "supplement-requested":   { label: "SUPPLEMENT",        color: "#A855F7", bucket: "active" },
  "supplement_requested":   { label: "SUPPLEMENT",        color: "#A855F7", bucket: "active" },
  "settlement-reached":     { label: "SETTLEMENT REACHED",color: "#00E6A8", bucket: "active" },
  "litigation":             { label: "LITIGATION",        color: "#E05050", bucket: "active" },
  "partial_payment":        { label: "PARTIAL PAYMENT",   color: "#7DD3FC", bucket: "active" },
  "fully_recovered":        { label: "FULLY RECOVERED",   color: "#00E6A8", bucket: "closed" },
  "paid":                   { label: "PAID",              color: "#00E6A8", bucket: "closed" },
  "closed":                 { label: "CLOSED",            color: C.muted,   bucket: "closed" },
};
const DEFAULT_PHASE = { label: "IN PROGRESS", color: C.muted, bucket: "active" };
function phaseMeta(p) {
  if (!p) return { ...DEFAULT_PHASE };
  return PHASE_META[p] || { ...DEFAULT_PHASE, label: String(p).replace(/[-_]/g, " ").toUpperCase() };
}

function fmtCurrency(v) {
  const n = Number(v || 0);
  if (n <= 0) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function relativeTime(iso) {
  if (!iso) return "no activity";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

export default function MyCasesBoard() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    // Backend defaults to sort_by=created_at, order_by=desc — keeping the
    // call minimal so we don't trip the ClaimSort enum (sort_by=updated_at
    // is not in the enum and 500s).
    apiJson("/reports/claims/advanced-search?period_type=all-time&page=1&size=100")
      .then(d => {
        const items = Array.isArray(d?.items) ? d.items : (Array.isArray(d) ? d : []);
        setClaims(items.filter(c => c && !c.is_removed));
        setLoading(false);
      })
      .catch(e => {
        setError(`HTTP ${e?.status ?? ""} ${e?.detail ?? e?.message ?? e}`.trim());
        setLoading(false);
      });
  }, []);

  const counts = useMemo(() => {
    let active = 0, closed = 0;
    for (const c of claims) {
      if (phaseMeta(c.current_phase).bucket === "closed") closed += 1;
      else active += 1;
    }
    return { all: claims.length, active, closed };
  }, [claims]);

  const visible = useMemo(() => {
    if (filter === "all") return claims;
    return claims.filter(c => phaseMeta(c.current_phase).bucket === filter);
  }, [claims, filter]);

  if (loading) {
    return <div style={{ color: C.muted, ...mono, padding: 40 }}>Loading cases…</div>;
  }
  if (error) {
    return (
      <div style={{ ...mono, padding: 40 }}>
        <div style={{ color: "#E05050", marginBottom: 12 }}>Failed to load cases: {error}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "8px 16px", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6,
            color: C.muted, cursor: "pointer", ...mono,
          }}
        >Retry</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <button
          onClick={() => navigate("/portal")}
          style={{
            background: "transparent", border: "none", color: C.muted,
            fontSize: 12, cursor: "pointer", padding: "4px 0",
            letterSpacing: 0.5, ...mono,
          }}
        >
          ← BACK TO COMMAND CENTER
        </button>
        <h1 style={{ ...mono, fontSize: 22, color: "#fff", fontWeight: 700, margin: "6px 0 4px" }}>
          My Cases
        </h1>
        <div style={{ color: C.muted, fontSize: 13, ...mono }}>
          {claims.length} claim{claims.length === 1 ? "" : "s"} assigned to you
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <FilterChip label={`All · ${counts.all}`}        active={filter === "all"}    color="#FFFFFF" onClick={() => setFilter("all")} />
        <FilterChip label={`Active · ${counts.active}`}  active={filter === "active"} color={C.gold}  onClick={() => setFilter("active")} />
        <FilterChip label={`Closed · ${counts.closed}`}  active={filter === "closed"} color="#00E6A8" onClick={() => setFilter("closed")} />
      </div>

      {/* Rows */}
      {visible.length === 0 ? (
        <EmptyState hasAny={claims.length > 0} hasFilter={filter !== "all"} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(claim => (
            <CaseRow key={claim.id} claim={claim} onClick={() => setSelected(claim)} />
          ))}
        </div>
      )}

      {/* Detail slide-over */}
      {selected && <CaseDetail claim={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FilterChip({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        background: active ? `${color}22` : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? color + "88" : "rgba(255,255,255,0.10)"}`,
        borderRadius: 999,
        color: active ? color : C.muted,
        fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
        cursor: "pointer", transition: "all 0.15s",
        ...mono,
      }}
    >
      {label}
    </button>
  );
}

function CaseRow({ claim, onClick }) {
  const phase = phaseMeta(claim.current_phase);
  const clientName = (claim.client && (claim.client.full_name || claim.client.first_name)) || "(Unnamed)";
  const carrier = claim.insurance_company || "—";
  const loc = [
    claim.claim_contact?.city_loss,
    claim.claim_contact?.state_loss,
  ].filter(Boolean).join(", ");

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto auto",
        alignItems: "center",
        gap: 16,
        padding: "14px 18px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        width: "100%",
      }}
    >
      {/* Ref icon */}
      <div style={{
        width: 40, height: 40,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${phase.color}18`,
        border: `1px solid ${phase.color}33`,
        borderRadius: 10,
        fontSize: 14, fontWeight: 700, color: phase.color, ...mono,
      }}>
        📄
      </div>

      {/* Name + ref */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", ...mono, letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {clientName}
          <span style={{ fontWeight: 400, color: C.muted, marginLeft: 8 }}>
            · {claim.ref_string || `CLM-${claim.ref_number}`}
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3, ...mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {carrier}
          {loc && <span> · {loc}</span>}
          <span> · last activity {relativeTime(claim.updated_at || claim.created_at)}</span>
        </div>
      </div>

      {/* Anticipated amount */}
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: phase.bucket === "closed" ? "#00E6A8" : "#fff",
        ...mono, letterSpacing: 0.5,
      }}>
        {fmtCurrency(claim.anticipated_amount)}
      </div>

      {/* Peril pill */}
      <div style={{
        padding: "4px 10px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 6,
        color: C.muted,
        fontSize: 10, fontWeight: 700, letterSpacing: 1,
        ...mono,
      }}>
        {(claim.peril || "—").toUpperCase()}
      </div>

      {/* Phase pill */}
      <div style={{
        padding: "4px 10px",
        background: `${phase.color}12`,
        border: `1px solid ${phase.color}40`,
        borderRadius: 6,
        color: phase.color,
        fontSize: 10, fontWeight: 700, letterSpacing: 1,
        ...mono,
        minWidth: 140, textAlign: "center",
      }}>
        {phase.label}
      </div>
    </button>
  );
}

function CaseDetail({ claim, onClose }) {
  const phase = phaseMeta(claim.current_phase);
  const clientName = (claim.client && (claim.client.full_name || claim.client.first_name)) || "(Unnamed)";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(540px, 100%)",
          height: "100%",
          background: C.panel,
          borderLeft: "1px solid rgba(255,255,255,0.14)",
          padding: "28px 28px 60px",
          overflowY: "auto",
          color: "#fff",
          ...mono,
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 16, right: 18,
            background: "transparent", border: "none",
            color: C.muted, fontSize: 22, cursor: "pointer",
            ...mono,
          }}
        >×</button>

        <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>
          CLAIM · {claim.ref_string || `CLM-${claim.ref_number}`}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#fff" }}>
          {clientName}
        </h2>
        <div style={{
          display: "inline-block",
          padding: "4px 12px",
          background: `${phase.color}12`,
          border: `1px solid ${phase.color}40`,
          borderRadius: 6,
          color: phase.color,
          fontSize: 10, fontWeight: 700, letterSpacing: 1,
          marginBottom: 24,
        }}>
          {phase.label}
        </div>

        <DetailGrid title="CARRIER">
          <DetailRow label="Insurance company" value={claim.insurance_company} />
          <DetailRow label="Policy #"           value={claim.policy_number} />
          <DetailRow label="Claim # (carrier)"  value={claim.claim_number} />
          <DetailRow label="Policy type"        value={claim.policy_type_name || claim.policy_type} />
        </DetailGrid>

        <DetailGrid title="LOSS">
          <DetailRow label="Peril"      value={claim.peril} />
          <DetailRow label="Loss date"  value={fmtDate(claim.loss_date)} />
          <DetailRow label="Address"    value={claim.claim_contact?.address_loss} />
          <DetailRow label="City"       value={claim.claim_contact?.city_loss} />
          <DetailRow label="State"      value={claim.claim_contact?.state_loss} />
          <DetailRow label="Zip"        value={claim.claim_contact?.zip_code_loss} />
          <DetailRow label="Inhabitable"        value={claim.inhabitable === true ? "Yes" : claim.inhabitable === false ? "No" : null} />
          <DetailRow label="State of emergency" value={claim.state_of_emergency === true ? "Yes" : claim.state_of_emergency === false ? "No" : null} />
        </DetailGrid>

        <DetailGrid title="VALUE">
          <DetailRow label="Anticipated amount" value={fmtCurrency(claim.anticipated_amount)} />
          <DetailRow label="Fee"                value={claim.fee != null ? `${claim.fee}${claim.fee_type === 'percent' ? '%' : ''}` : null} />
          <DetailRow label="Prior carrier paid" value={fmtCurrency(claim.prior_carrier_payments)} />
        </DetailGrid>

        <DetailGrid title="TIMELINE">
          <DetailRow label="Created"       value={fmtDate(claim.created_at)} />
          <DetailRow label="Last activity" value={fmtDate(claim.updated_at || claim.created_at)} />
          <DetailRow label="Date logged"   value={fmtDate(claim.date_logged)} />
          <DetailRow label="Contract sign" value={fmtDate(claim.contract_sign_date)} />
        </DetailGrid>

        <DetailGrid title="OWNERSHIP">
          <DetailRow label="Assigned to" value={claim.assigned_user
            ? `${claim.assigned_user.first_name || ""} ${claim.assigned_user.last_name || ""}`.trim()
            : null} />
          <DetailRow label="Signed by"   value={claim.signed_by_user
            ? `${claim.signed_by_user.first_name || ""} ${claim.signed_by_user.last_name || ""}`.trim()
            : null} />
          <DetailRow label="Adjusted by" value={claim.adjusted_by_user
            ? `${claim.adjusted_by_user.first_name || ""} ${claim.adjusted_by_user.last_name || ""}`.trim()
            : null} />
        </DetailGrid>

        {claim.instructions_or_notes && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>NOTES</div>
            <div style={{
              fontSize: 13, lineHeight: 1.55, color: "#fff",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.10)",
              padding: 12, borderRadius: 8, whiteSpace: "pre-wrap",
            }}>
              {claim.instructions_or_notes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailGrid({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>{title}</div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 8,
        padding: "12px 14px",
      }}>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 0.5 }}>{label}</div>
      <div style={{
        fontSize: 12, color: value ? "#fff" : C.muted,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value || "—"}
      </div>
    </div>
  );
}

function EmptyState({ hasAny, hasFilter }) {
  const isFilteredOut = hasAny && hasFilter;
  const title = isFilteredOut
    ? "No cases match this filter."
    : "No cases assigned to you yet.";
  const sub = isFilteredOut
    ? "Try a different filter or pick \"All\"."
    : "When a claim is assigned to you, it'll appear here automatically.";
  return (
    <div style={{
      textAlign: "center",
      padding: "60px 24px",
      background: "rgba(255,255,255,0.02)",
      border: "1px dashed rgba(255,255,255,0.14)",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{isFilteredOut ? "🔍" : "📂"}</div>
      <div style={{ ...mono, fontSize: 14, color: C.white, fontWeight: 700, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: C.muted, maxWidth: 440, margin: "0 auto", lineHeight: 1.5 }}>
        {sub}
      </div>
    </div>
  );
}
