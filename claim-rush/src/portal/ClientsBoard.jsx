import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { C } from "./theme";
import PageHeader from "./shared/PageHeader";

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
      </div>
      <PageHeader
        title="My Clients"
        subtitle={<>
          {clients.length} claim{clients.length === 1 ? "" : "s"} across your territory
          {totalGrossFee > 0 && (
            <span style={{ marginLeft: 10, color: C.gold, fontWeight: 700 }}>
              · {formatCurrency(totalGrossFee)} gross fee
            </span>
          )}
        </>}
        kicker="Client Base"
        accent={C.gold}
      />

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
      onMouseEnter={active ? undefined : (e) => {
        e.currentTarget.style.background = `${color}10`;
        e.currentTarget.style.borderColor = `${color}40`;
        e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={active ? undefined : (e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
        e.currentTarget.style.color = "rgba(255,255,255,0.55)";
      }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "6px 12px",
        background: active ? `${color}1a` : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? `${color}66` : "rgba(255,255,255,0.10)"}`,
        borderRadius: 4,
        color: active ? color : "rgba(255,255,255,0.55)",
        fontSize: 10, fontWeight: 800, letterSpacing: 1.4,
        textTransform: "uppercase",
        cursor: "pointer", ...mono,
        transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
        boxShadow: active ? `0 0 12px ${color}25, inset 0 1px 0 rgba(255,255,255,0.05)` : "none",
      }}
    >
      <span style={{
        width: 4, height: 4, borderRadius: 2,
        background: color,
        boxShadow: active ? `0 0 5px ${color}` : "none",
        opacity: active ? 1 : 0.55,
        display: "inline-block",
      }} />
      {label}
    </button>
  );
}

function ClientRow({ client }) {
  const stage = stageMeta(client.stage);
  const type = typeMeta(client.claim_type);
  const isClosed = stage.bucket === "closed";
  const locationLine = [client.city, client.state].filter(Boolean).join(", ");

  return (
    <div
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.borderColor = `${stage.color}55`;
        e.currentTarget.style.background = `linear-gradient(135deg, ${stage.color}10 0%, rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.01) 100%)`;
        e.currentTarget.style.boxShadow = `0 8px 22px rgba(0,0,0,0.40), 0 0 0 1px ${stage.color}28, 0 0 22px ${stage.color}1a`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)";
        e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.28), 0 0 14px ${stage.color}10`;
      }}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto auto",
        alignItems: "center",
        gap: 16,
        padding: "14px 18px 14px 22px",
        background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: `0 4px 12px rgba(0,0,0,0.28), 0 0 14px ${stage.color}10`,
        transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
      }}>
      {/* Stage-encoded left edge accent */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: stage.color,
        boxShadow: `0 0 10px ${stage.color}80`,
        pointerEvents: "none",
      }} />

      {/* Type icon */}
      <div style={{
        width: 40, height: 40,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(135deg, ${type.color}26 0%, ${type.color}0d 100%)`,
        border: `1px solid ${type.color}45`,
        borderRadius: 10,
        fontSize: 20,
        boxShadow: `0 0 14px ${type.color}25, inset 0 1px 0 rgba(255,255,255,0.06)`,
        flexShrink: 0,
      }}>
        {type.icon}
      </div>

      {/* Name + ref */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", ...mono, letterSpacing: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {client.client_name || "(Unnamed)"}
          <span style={{
            fontWeight: 700, marginLeft: 10,
            color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", fontSize: 10,
          }}>
            {client.claim_number}
          </span>
        </div>
        <div style={{
          fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4, ...mono,
          letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontWeight: 600,
        }}>
          {client.agent_name || "UNASSIGNED"}
          {locationLine && <span style={{ color: "rgba(255,255,255,0.30)" }}> · {locationLine}</span>}
          {client.carrier && <span style={{ color: "rgba(255,255,255,0.30)" }}> · {client.carrier}</span>}
        </div>
      </div>

      {/* Gross fee */}
      <div style={{
        fontSize: 14, fontWeight: 800,
        color: isClosed ? "#00E6A8" : "#fff",
        ...mono, letterSpacing: 0.3,
        textShadow: isClosed ? `0 0 10px rgba(0,230,168,0.30)` : "none",
      }}>
        {formatCurrency(client.gross_fee)}
      </div>

      {/* Claim type pill */}
      <div style={{
        padding: "3px 10px",
        background: `${type.color}1a`,
        border: `1px solid ${type.color}40`,
        borderRadius: 4,
        color: type.color,
        fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
        ...mono, textTransform: "uppercase",
      }}>
        {type.label.toUpperCase()}
      </div>

      {/* Stage pill */}
      <div style={{
        padding: "3px 10px",
        background: `${stage.color}1f`,
        borderRadius: 4,
        color: stage.color,
        fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
        ...mono, textTransform: "uppercase",
        minWidth: 130, textAlign: "center",
        boxShadow: !isClosed ? `0 0 10px ${stage.color}24` : "none",
      }}>
        {stage.label}
      </div>
    </div>
  );
}

function EmptyState() {
  const accent = "#C9A84C";
  return (
    <div style={{
      position: "relative",
      padding: "44px 28px 38px",
      background: `linear-gradient(180deg, ${accent}05 0%, rgba(255,255,255,0.005) 100%)`,
      border: `1px solid ${accent}25`,
      borderRadius: 10,
      overflow: "hidden",
      textAlign: "center",
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 22px ${accent}0d`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: accent, boxShadow: `0 0 8px ${accent}aa`, pointerEvents: "none",
      }} />
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "3px 10px", marginBottom: 16,
        background: `${accent}10`, border: `1px solid ${accent}38`, borderRadius: 3,
        ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
        color: accent, textTransform: "uppercase",
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: 3,
          background: accent, boxShadow: `0 0 6px ${accent}`,
          animation: "liveDotPulse 1.6s ease-in-out infinite",
        }} />
        Awaiting Telemetry
      </div>
      <div style={{
        ...mono, fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: 800,
        letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 8,
      }}>
        No Clients Match This Filter
      </div>
      <div style={{
        ...mono, fontSize: 11, color: "rgba(255,255,255,0.50)",
        maxWidth: 460, margin: "0 auto", lineHeight: 1.6, letterSpacing: 0.3,
      }}>
        Adjust the filter or select All to view the full client base.
      </div>
    </div>
  );
}
