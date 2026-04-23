import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { C } from "./theme";

/**
 * Fire Leads — CP's downline lead board.
 *
 * Real data from GET /v1/dashboard/cp-leads (one entry per lead assigned
 * to any agent in the CP's downline). Filter chips by peril, status chips
 * per row, clean click-back to the Command Center.
 */

const mono = { fontFamily: "'Courier New', monospace" };

// Peril display — icon + label + accent colour. Any peril not in the list
// falls through to OTHER.
const PERIL_META = {
  fire:   { label: "Fire",   icon: "🔥", color: "#E05050" },
  storm:  { label: "Storm",  icon: "⛈️", color: "#3B82F6" },
  flood:  { label: "Flood",  icon: "💧", color: "#3B82F6" },
  hail:   { label: "Hail",   icon: "🧊", color: "#7DD3FC" },
  wind:   { label: "Wind",   icon: "💨", color: "#86EFAC" },
  theft:  { label: "Theft",  icon: "🔒", color: "#A855F7" },
  other:  { label: "Other",  icon: "📋", color: "rgba(255,255,255,0.55)" },
};

// Status pill colouring — lowercase-kebab slugs that match LeadStatusEnum.
const STATUS_META = {
  "signed-approved": { label: "CLOSED · APPROVED",  color: "#00E6A8" },
  "signed":          { label: "SIGNED",             color: "#00E6A8" },
  "pending-sign":    { label: "PENDING SIGN",       color: C.gold },
  "interested":      { label: "INTERESTED",         color: C.gold },
  "callback":        { label: "CALLBACK",           color: "#3B82F6" },
  "transfer":        { label: "TRANSFERRED",        color: "#A855F7" },
  "not-qualified":   { label: "NOT QUALIFIED",      color: "rgba(255,255,255,0.45)" },
  "not-interested":  { label: "NOT INTERESTED",     color: "rgba(255,255,255,0.45)" },
};
function statusPill(status) {
  const meta = STATUS_META[status] || { label: (status || "NEW").toUpperCase(), color: C.muted };
  return meta;
}
function perilMeta(p) {
  return PERIL_META[p] || PERIL_META.other;
}

export default function LeadsBoard() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    apiJson("/dashboard/cp-leads")
      .then(d => { setLeads(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(e => { setError(String(e?.status ?? e?.detail ?? e)); setLoading(false); });
  }, []);

  // Build filter chips from actual lead perils present (so CP never sees
  // a chip that filters to zero rows unless they ask for "All").
  const perilCounts = useMemo(() => {
    const counts = { all: leads.length };
    for (const l of leads) {
      const key = l.peril || "other";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [leads]);

  const visible = useMemo(() => {
    if (filter === "all") return leads;
    return leads.filter(l => (l.peril || "other") === filter);
  }, [leads, filter]);

  if (loading) {
    return (
      <div style={{ color: C.muted, ...mono, padding: 40 }}>
        Loading leads…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ color: "#E05050", ...mono, padding: 40 }}>
        Failed to load leads: {error}
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
          Fire Leads
        </h1>
        <div style={{ color: C.muted, fontSize: 13, ...mono }}>
          {leads.length} lead{leads.length === 1 ? "" : "s"} across your downline.
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <FilterChip
          label={`All · ${perilCounts.all || 0}`}
          active={filter === "all"}
          color="#FFFFFF"
          onClick={() => setFilter("all")}
        />
        {Object.entries(PERIL_META).map(([key, meta]) => {
          const count = perilCounts[key] || 0;
          if (count === 0) return null;
          return (
            <FilterChip
              key={key}
              label={`${meta.icon} ${meta.label} · ${count}`}
              active={filter === key}
              color={meta.color}
              onClick={() => setFilter(key)}
            />
          );
        })}
      </div>

      {/* Leads list */}
      {visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(lead => (
            <LeadRow key={lead.id} lead={lead} />
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

function LeadRow({ lead }) {
  const peril = perilMeta(lead.peril);
  const status = statusPill(lead.status);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto 1fr auto auto",
      alignItems: "center",
      gap: 16,
      padding: "14px 18px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
    }}>
      {/* Peril icon */}
      <div style={{
        width: 40, height: 40,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${peril.color}18`,
        border: `1px solid ${peril.color}33`,
        borderRadius: 10,
        fontSize: 20,
      }}>
        {peril.icon}
      </div>

      {/* Info */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", ...mono, letterSpacing: 0.5 }}>
          Lead #{lead.ref_number}
          {lead.insurance_company && (
            <span style={{ fontWeight: 400, color: C.muted, marginLeft: 8 }}>
              · {lead.insurance_company}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3, ...mono }}>
          {lead.agent_name || "Unassigned"} · {lead.days_open} day{lead.days_open === 1 ? "" : "s"} open
        </div>
      </div>

      {/* Peril label (compact) */}
      <div style={{
        padding: "4px 10px",
        background: `${peril.color}12`,
        border: `1px solid ${peril.color}30`,
        borderRadius: 6,
        color: peril.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        ...mono,
      }}>
        {peril.label.toUpperCase()}
      </div>

      {/* Status pill */}
      <div style={{
        padding: "4px 10px",
        background: `${status.color}12`,
        border: `1px solid ${status.color}40`,
        borderRadius: 6,
        color: status.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        ...mono,
      }}>
        {status.label}
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
      <div style={{ fontSize: 36, marginBottom: 12 }}>🌥️</div>
      <div style={{ ...mono, fontSize: 14, color: "rgba(255,255,255,0.55)" }}>
        No leads match this filter.
      </div>
    </div>
  );
}
