import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { C } from "./theme";

/**
 * My Clients — claim-based client list scoped to the CP's territory.
 *
 * Fed by GET /v1/dashboard/cp-clients. Each row represents one
 * commission_claim the CP either owns (cp_id) or is in their
 * downline (writing_agent in downline agents).
 *
 * Stage chips bucket claims into Active / Closed / All for easy
 * at-a-glance triage.
 */

const mono = { fontFamily: "'Courier New', monospace" };

// Stage → display meta. Unknown stages fall to a neutral default.
const STAGE_META = {
  INTAKE_SIGNED:         { label: "INTAKE SIGNED",     color: C.muted,     bucket: "active" },
  INSPECTION_SCHEDULED:  { label: "INSPECTION SCHED",  color: "#3B82F6",   bucket: "active" },
  INSPECTION_COMPLETED:  { label: "INSPECTION DONE",   color: "#3B82F6",   bucket: "active" },
  ESTIMATE_SUBMITTED:    { label: "ESTIMATE SENT",     color: "#7DD3FC",   bucket: "active" },
  CARRIER_REVIEW:        { label: "CARRIER REVIEW",    color: C.gold,      bucket: "active" },
  NEGOTIATION:           { label: "NEGOTIATION",       color: "#A855F7",   bucket: "active" },
  SUPPLEMENT_SUBMITTED:  { label: "SUPPLEMENT",        color: "#A855F7",   bucket: "active" },
  SETTLEMENT_REACHED:    { label: "SETTLEMENT REACHED",color: "#00E6A8",   bucket: "active" },
  LITIGATION:            { label: "LITIGATION",        color: "#E05050",   bucket: "active" },
  PAID:                  { label: "PAID",              color: "#00E6A8",   bucket: "closed" },
  CLOSED:                { label: "CLOSED",            color: C.muted,     bucket: "closed" },
};
const DEFAULT_STAGE = { label: "IN PROGRESS", color: "rgba(255,255,255,0.55)", bucket: "active" };
function stageMeta(s) { return STAGE_META[s] || { ...DEFAULT_STAGE, label: (s || "NEW").toUpperCase() }; }

const CLAIM_TYPE_META = {
  residential: { label: "Residential", color: "#00E6A8", icon: "🏠" },
  commercial:  { label: "Commercial",  color: C.gold,    icon: "🏢" },
};
function typeMeta(t) {
  return CLAIM_TYPE_META[t] || { label: "Claim", color: "rgba(255,255,255,0.55)", icon: "📄" };
}

function formatCurrency(v) {
  const n = Number(v || 0);
  if (n <= 0) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function ClientsBoard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    apiJson("/dashboard/cp-clients")
      .then(d => { setClients(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(e => { setError(String(e?.status ?? e?.detail ?? e)); setLoading(false); });
  }, []);

  const counts = useMemo(() => {
    let active = 0, closed = 0;
    for (const c of clients) {
      const b = stageMeta(c.stage).bucket;
      if (b === "closed") closed += 1; else active += 1;
    }
    return { all: clients.length, active, closed };
  }, [clients]);

  const visible = useMemo(() => {
    if (filter === "all") return clients;
    return clients.filter(c => stageMeta(c.stage).bucket === filter);
  }, [clients, filter]);

  const totalGrossFee = useMemo(
    () => clients.reduce((s, c) => s + Number(c.gross_fee || 0), 0),
    [clients]
  );

  if (loading) {
    return <div style={{ color: C.muted, ...mono, padding: 40 }}>Loading clients…</div>;
  }
  if (error) {
    return <div style={{ color: "#E05050", ...mono, padding: 40 }}>Failed to load clients: {error}</div>;
  }

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
          My Clients
        </h1>
        <div style={{ color: C.muted, fontSize: 13, ...mono }}>
          {clients.length} claim{clients.length === 1 ? "" : "s"} across your territory
          {totalGrossFee > 0 && (
            <span style={{ marginLeft: 10, color: C.gold }}>
              · {formatCurrency(totalGrossFee)} gross fee
            </span>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <FilterChip label={`All · ${counts.all}`}      active={filter === "all"}    color="#FFFFFF" onClick={() => setFilter("all")} />
        <FilterChip label={`Active · ${counts.active}`} active={filter === "active"} color={C.gold}  onClick={() => setFilter("active")} />
        <FilterChip label={`Closed · ${counts.closed}`} active={filter === "closed"} color="#00E6A8" onClick={() => setFilter("closed")} />
      </div>

      {/* Rows */}
      {visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(client => (
            <ClientRow key={client.claim_id} client={client} />
          ))}
        </div>
      )}
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
        color: active ? color : "rgba(255,255,255,0.70)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.5,
        cursor: "pointer",
        transition: "all 0.15s",
        ...mono,
      }}
    >
      {label}
    </button>
  );
}

function ClientRow({ client }) {
  const stage = stageMeta(client.stage);
  const type = typeMeta(client.claim_type);
  const locationLine = [client.city, client.state].filter(Boolean).join(", ");

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto 1fr auto auto auto",
      alignItems: "center",
      gap: 16,
      padding: "14px 18px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
    }}>
      {/* Type icon */}
      <div style={{
        width: 40, height: 40,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${type.color}18`,
        border: `1px solid ${type.color}33`,
        borderRadius: 10,
        fontSize: 20,
      }}>
        {type.icon}
      </div>

      {/* Name + ref */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", ...mono, letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {client.client_name || "(Unnamed)"}
          <span style={{ fontWeight: 400, color: C.muted, marginLeft: 8 }}>
            · {client.claim_number}
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3, ...mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {client.agent_name || "Unassigned"}
          {locationLine && <span> · {locationLine}</span>}
          {client.carrier && <span> · {client.carrier}</span>}
        </div>
      </div>

      {/* Gross fee */}
      <div style={{
        fontSize: 13, fontWeight: 700, color: stage.bucket === "closed" ? "#00E6A8" : "#fff",
        ...mono, letterSpacing: 0.5,
      }}>
        {formatCurrency(client.gross_fee)}
      </div>

      {/* Claim type pill */}
      <div style={{
        padding: "4px 10px",
        background: `${type.color}12`,
        border: `1px solid ${type.color}30`,
        borderRadius: 6,
        color: type.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        ...mono,
      }}>
        {type.label.toUpperCase()}
      </div>

      {/* Stage pill */}
      <div style={{
        padding: "4px 10px",
        background: `${stage.color}12`,
        border: `1px solid ${stage.color}40`,
        borderRadius: 6,
        color: stage.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        ...mono,
        minWidth: 140,
        textAlign: "center",
      }}>
        {stage.label}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      textAlign: "center",
      padding: "60px 24px",
      background: "rgba(255,255,255,0.02)",
      border: "1px dashed rgba(255,255,255,0.12)",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
      <div style={{ ...mono, fontSize: 14, color: "rgba(255,255,255,0.55)" }}>
        No clients match this filter.
      </div>
    </div>
  );
}
