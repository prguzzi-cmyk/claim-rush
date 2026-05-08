import { useState, useMemo, useRef, useEffect } from "react";
import PageHeader from "./shared/PageHeader";
import { fetchActiveIncidents, aggregateMetrics } from "./services/crimeIntel";

/**
 * Crime Intel — flagship neighborhood/property threat intelligence module.
 *
 * Investor-demo-ready surface for surfacing crime risk by neighborhood.
 * Today renders sample data clearly tagged "DEMO MODE"; the data hooks
 * (`DEMO_INCIDENTS`, `FEEDS`, `metrics`) are single-point swaps when the
 * /v1/crime-intel backend ships. No backend / API / routing rewrites
 * required to flip demo → live.
 */

const PURPLE = "#A855F7";
const COPPER = "#FF6D00";
const GOLD   = "#C9A84C";
const GREEN  = "#00E6A8";
const RED    = "#E05050";
const BLUE   = "#3B82F6";
const mono = { fontFamily: "'Courier New', monospace" };

const TYPE_ICONS = {
  BURGLARY:  "🪟",
  THEFT:     "💼",
  VANDALISM: "🧨",
  AUTO:      "🚗",
  ARSON:     "🔥",
  ASSAULT:   "⚠️",
};

// Severity → color encoding shared by status chips and edge accents.
const SEVERITY_META = {
  CRITICAL: { color: RED,    pulse: true,  description: "Active threat" },
  HIGH:     { color: COPPER, pulse: true,  description: "Elevated activity" },
  MODERATE: { color: GOLD,   pulse: false, description: "Watch list" },
  LOW:      { color: GREEN,  pulse: false, description: "Below trend line" },
};

// Demo incidents — clearly tagged in the grid header. Swap for live
// `apiFetch("/v1/crime-intel/incidents")` response when ready.
const DEMO_INCIDENTS = [
  { id: "i1", type: "BURGLARY",  address: "412 Linden Ave",       neighborhood: "Westwood",       city: "Denver",     state: "CO", severity: "CRITICAL", riskScore: 94, hours: 2,  status: "ACTIVE" },
  { id: "i2", type: "AUTO",      address: "8821 Magnolia Pkwy",   neighborhood: "Midtown North",  city: "Atlanta",    state: "GA", severity: "HIGH",     riskScore: 87, hours: 4,  status: "INVESTIGATING" },
  { id: "i3", type: "VANDALISM", address: "276 Beaufort St",      neighborhood: "Old Town",       city: "Charleston", state: "SC", severity: "MODERATE", riskScore: 72, hours: 6,  status: "LOGGED" },
  { id: "i4", type: "THEFT",     address: "1402 Olive Way",       neighborhood: "Capitol Hill",   city: "Seattle",    state: "WA", severity: "HIGH",     riskScore: 81, hours: 3,  status: "INVESTIGATING" },
  { id: "i5", type: "ARSON",     address: "3155 Elm St",          neighborhood: "Heights",        city: "Houston",    state: "TX", severity: "CRITICAL", riskScore: 96, hours: 1,  status: "ACTIVE" },
  { id: "i6", type: "ASSAULT",   address: "560 Mission Blvd",     neighborhood: "Downtown",       city: "Phoenix",    state: "AZ", severity: "MODERATE", riskScore: 68, hours: 8,  status: "LOGGED" },
];

// Status → operational color
const STATUS_META = {
  ACTIVE:        { color: RED,    pulse: true  },
  INVESTIGATING: { color: COPPER, pulse: false },
  LOGGED:        { color: BLUE,   pulse: false },
};

// Intelligence feed catalog — what Crime Intel surfaces.
const FEEDS = [
  { id: "burglary",  icon: "🪟", label: "Burglary History",        status: "ONLINE",  color: GREEN  },
  { id: "auto",      icon: "🚗", label: "Auto Crime Patterns",     status: "ONLINE",  color: GREEN  },
  { id: "theft",     icon: "💼", label: "Theft Trends",            status: "ONLINE",  color: GREEN  },
  { id: "vandalism", icon: "🧨", label: "Vandalism Reports",       status: "SYNCING", color: BLUE   },
  { id: "arson",     icon: "🔥", label: "Arson Activity",          status: "ONLINE",  color: GREEN  },
  { id: "police",    icon: "🚓", label: "Police Response Index",   status: "ONLINE",  color: GREEN  },
];

// ── Operational Status tile ──────────────────────────────────────────
function StatusTile({ label, value, sub, color, pulse }) {
  return (
    <div style={{
      position: "relative",
      padding: "14px 16px",
      background: `linear-gradient(135deg, ${color}10 0%, ${color}02 100%)`,
      border: `1px solid ${color}30`,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: `0 4px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 16px ${color}10`,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, boxShadow: `0 0 8px ${color}aa`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, background: `radial-gradient(circle, ${color}20 0%, transparent 65%)`, pointerEvents: "none" }} />
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", gap: 6,
        ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
        textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
        marginBottom: 4,
      }}>
        {pulse && (
          <span style={{
            width: 5, height: 5, borderRadius: 3,
            background: color, boxShadow: `0 0 6px ${color}aa`,
            animation: "crimePulse 1.6s ease-in-out infinite",
            display: "inline-block",
          }} />
        )}
        {label}
      </div>
      <div style={{
        position: "relative", zIndex: 1,
        ...mono, fontSize: 26, fontWeight: 800, color,
        letterSpacing: -0.3, lineHeight: 1,
        textShadow: `0 0 14px ${color}45, 0 0 5px ${color}25`,
      }}>{value}</div>
      {sub && (
        <div style={{
          position: "relative", zIndex: 1,
          ...mono, fontSize: 9, color: "rgba(255,255,255,0.40)",
          letterSpacing: 1.2, textTransform: "uppercase",
          marginTop: 6, fontWeight: 700,
        }}>{sub}</div>
      )}
    </div>
  );
}

// ── Cinematic section strip header ───────────────────────────────────
function SectionStrip({ label, color = GREEN, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color, boxShadow: `0 0 6px ${color}cc`, display: "inline-block" }} />
      <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.78)", fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase" }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}28 0%, rgba(255,255,255,0.04) 60%, transparent 100%)` }} />
      {right}
    </div>
  );
}

// ── Threat Heat Map console ──────────────────────────────────────────
function HeatMapConsole({ incidents }) {
  // Each incident carries pre-computed canvas coords; the heat map only
  // needs to colorize by targeting priority + cluster classification.
  const HOT_ZONES = useMemo(() => {
    return incidents.map(inc => {
      const priority = inc.scoring.targeting_priority;
      const cls = inc.zone_impact.cluster_classification;
      const color = priority >= 90 ? RED
                  : priority >= 75 ? COPPER
                  : priority >= 55 ? GOLD
                  : GREEN;
      const surge = cls === "SURGING" || inc.recommendation.action === "TARGET_NOW";
      return {
        x: inc.location.canvas_x,
        y: inc.location.canvas_y,
        color, surge, priority,
        label: inc.event_type.toUpperCase().replace("_", " "),
      };
    });
  }, [incidents]);

  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
      border: `1px solid ${PURPLE}26`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 6px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 26px ${PURPLE}10`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: PURPLE, boxShadow: `0 0 10px ${PURPLE}aa`, pointerEvents: "none",
      }} />
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "10px 16px",
        background: "rgba(255,255,255,0.025)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: PURPLE, boxShadow: `0 0 6px ${PURPLE}cc`,
          animation: "crimePulse 1.6s ease-in-out infinite",
        }} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          Neighborhood Threat Heat Map
        </span>
        <span style={{
          marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 9, ...mono, fontWeight: 800, letterSpacing: 1.5,
          color: GREEN, padding: "2px 8px",
          background: `${GREEN}10`, border: `1px solid ${GREEN}40`,
          borderRadius: 3, textTransform: "uppercase",
        }}>
          <span style={{ width: 4, height: 4, borderRadius: 2, background: GREEN, boxShadow: `0 0 5px ${GREEN}`, animation: "crimePulse 1.6s ease-in-out infinite" }} />
          Monitoring · Live
        </span>
      </div>
      {/* Heat canvas */}
      <div style={{
        position: "relative",
        height: 360,
        background: "radial-gradient(ellipse at center, rgba(168,85,247,0.10) 0%, rgba(168,85,247,0.03) 40%, rgba(0,0,0,0.40) 100%)",
        overflow: "hidden",
      }}>
        {/* Tighter city grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(0deg, rgba(168,85,247,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168,85,247,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
          pointerEvents: "none",
        }} />
        {/* Crosshairs */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "rgba(168,85,247,0.10)" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "rgba(168,85,247,0.10)" }} />
        {/* Sweeping scan line */}
        <div style={{
          position: "absolute",
          top: 0, bottom: 0, width: 2,
          background: `linear-gradient(180deg, transparent 0%, ${PURPLE} 50%, transparent 100%)`,
          boxShadow: `0 0 14px ${PURPLE}aa`,
          animation: "crimeScan 7s linear infinite",
          pointerEvents: "none",
        }} />
        {/* Hot zone glows — purple radial wash per cluster */}
        {[
          { left: "22%", top: "22%" },
          { left: "78%", top: "26%" },
          { left: "24%", top: "76%" },
          { left: "76%", top: "78%" },
        ].map((p, i) => (
          <div key={i} style={{
            position: "absolute",
            left: p.left, top: p.top,
            transform: "translate(-50%, -50%)",
            width: 220, height: 220,
            background: `radial-gradient(circle, ${PURPLE}18 0%, transparent 65%)`,
            pointerEvents: "none",
          }} />
        ))}
        {/* Incident dots — sized + pulse-encoded by targeting priority */}
        {HOT_ZONES.map((p, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${p.x}%`, top: `${p.y}%`,
            transform: "translate(-50%, -50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            pointerEvents: "none",
          }}>
            <span style={{
              width: p.surge ? 12 : 9, height: p.surge ? 12 : 9, borderRadius: 6,
              background: p.color,
              boxShadow: p.surge
                ? `0 0 14px ${p.color}, 0 0 28px ${p.color}99, inset 0 0 4px ${p.color}`
                : `0 0 10px ${p.color}, 0 0 18px ${p.color}66`,
              animation: p.surge ? "crimePulse 1.4s ease-in-out infinite" : "none",
            }} />
            <span style={{
              ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.2,
              color: p.color, textShadow: `0 0 6px ${p.color}aa`,
              textTransform: "uppercase",
            }}>
              {p.label} · {p.priority}
            </span>
          </div>
        ))}
        {/* Empty state */}
        {HOT_ZONES.length === 0 && (
          <div style={{
            position: "absolute", left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            ...mono, fontSize: 10, color: "rgba(255,255,255,0.40)",
            letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700,
          }}>
            <span style={{ fontSize: 28 }}>🛡️</span>
            All Zones Clear
          </div>
        )}
      </div>
      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px",
        background: "rgba(255,255,255,0.015)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        ...mono, fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 0.8,
      }}>
        <span>● {HOT_ZONES.length} INCIDENT DOT{HOT_ZONES.length === 1 ? "" : "S"} · 4 HOT ZONES</span>
        <span style={{ color: "rgba(255,255,255,0.30)" }}>SCAN INTERVAL: 7s</span>
      </div>
    </div>
  );
}

// ── Risk score ring (radial gauge) ───────────────────────────────────
function RiskRing({ value, color }) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div style={{
      position: "relative",
      width: 56, height: 56, borderRadius: "50%",
      background: `conic-gradient(${color} ${safe * 3.6}deg, rgba(255,255,255,0.08) 0)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 0 12px ${color}30`,
    }}>
      <div style={{
        position: "absolute", inset: 4, borderRadius: "50%",
        background: "linear-gradient(135deg, #131A2A 0%, #0C1220 100%)",
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        ...mono, fontSize: 14, fontWeight: 800, color,
        letterSpacing: -0.3, lineHeight: 1,
        textShadow: `0 0 8px ${color}55`,
      }}>{safe}</div>
    </div>
  );
}

// ── Action → tactical color encoding for the recommendation pill ─────
const ACTION_META = {
  TARGET_NOW:         { color: RED,    label: "Target Now",       pulse: true  },
  HIGH_PROPERTY_RISK: { color: COPPER, label: "High Property Risk", pulse: true },
  WATCH_ZONE:         { color: GOLD,   label: "Watch Zone",        pulse: false },
  MONITOR:            { color: BLUE,   label: "Monitor",           pulse: false },
  ESCALATE:           { color: PURPLE, label: "Escalate",          pulse: true  },
  ARCHIVE:            { color: "rgba(255,255,255,0.40)", label: "Archive", pulse: false },
};

const CLUSTER_COLOR = {
  SURGING:  RED,
  ACTIVE:   COPPER,
  EMERGING: GOLD,
  ISOLATED: BLUE,
};

// ── Incident card — tactical intel panel (CrimeIncident shape) ───────
function IncidentCard({ inc }) {
  const sevUpper = (inc.severity || "moderate").toUpperCase();
  const sevColor = sevUpper === "CRITICAL" ? RED
                 : sevUpper === "HIGH"     ? COPPER
                 : sevUpper === "MODERATE" ? GOLD
                 : GREEN;
  const isPulse = inc.scoring.targeting_priority >= 75;
  const action = ACTION_META[inc.recommendation.action] || ACTION_META.MONITOR;
  const cluster = inc.zone_impact.cluster_classification;
  const clusterColor = CLUSTER_COLOR[cluster] || GOLD;
  const eventLabel = inc.event_type.toUpperCase().replace("_", " ");
  const icon = TYPE_ICONS[eventLabel.split(" ")[0]] || TYPE_ICONS[eventLabel] || "⚠️";
  const fmtRisk = (n) => n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);

  return (
    <div style={{
      position: "relative",
      padding: "16px 18px 16px 22px",
      background: `linear-gradient(135deg, ${sevColor}10 0%, ${sevColor}02 60%, rgba(255,255,255,0.012) 100%)`,
      border: `1px solid ${sevColor}30`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 6px 18px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.03), 0 0 20px ${sevColor}14`,
    }}>
      {/* Severity-encoded left edge — pulses on high-priority */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 4,
        background: sevColor,
        boxShadow: `0 0 14px ${sevColor}cc, 0 0 24px ${sevColor}55`,
        pointerEvents: "none",
        animation: isPulse ? "crimeEdge 2.4s ease-in-out infinite" : "none",
      }} />
      {/* Ambient corner glow */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 160, height: 160,
        background: `radial-gradient(circle, ${sevColor}1c 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Tier 1: severity chip + event type + recommendation pill + risk ring */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: sevColor, padding: "2px 8px",
            background: `${sevColor}1a`, border: `1px solid ${sevColor}55`,
            borderRadius: 3, ...mono, textTransform: "uppercase",
            boxShadow: isPulse ? `0 0 10px ${sevColor}40` : "none",
          }}>
            {isPulse && (
              <span style={{ width: 5, height: 5, borderRadius: 3, background: sevColor, boxShadow: `0 0 5px ${sevColor}`, animation: "crimePulse 1.4s ease-in-out infinite" }} />
            )}
            {sevUpper}
          </span>
          <span style={{
            fontSize: 16, fontWeight: 800, color: "#fff",
            ...mono, letterSpacing: 0.5, textTransform: "uppercase",
            textShadow: `0 0 10px ${sevColor}40`,
          }}>{eventLabel}</span>
          {/* Recommendation pill */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: action.color, padding: "2px 8px",
            background: `${action.color}1a`, border: `1px solid ${action.color}55`,
            borderRadius: 3, ...mono, textTransform: "uppercase",
            boxShadow: action.pulse ? `0 0 10px ${action.color}40` : "none",
          }}>
            {action.pulse && (
              <span style={{ width: 5, height: 5, borderRadius: 3, background: action.color, boxShadow: `0 0 5px ${action.color}`, animation: "crimePulse 1.4s ease-in-out infinite" }} />
            )}
            {action.label}
          </span>
          {inc._has_real_source && (
            <span style={{
              ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.6,
              color: GREEN, textTransform: "uppercase",
              padding: "2px 7px",
              background: `${GREEN}10`, border: `1px solid ${GREEN}38`,
              borderRadius: 3,
            }}>Live Source</span>
          )}
          <span style={{ marginLeft: "auto" }}>
            <RiskRing value={inc.scoring.targeting_priority} color={sevColor} />
          </span>
        </div>

        {/* Tier 2: address + neighborhood */}
        {inc.location.address && (
          <div style={{
            ...mono, fontSize: 13, color: "rgba(255,255,255,0.85)",
            letterSpacing: 0.3, fontWeight: 700, marginBottom: 4,
          }}>
            {inc.location.address}
          </div>
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8,
        }}>
          <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 800 }}>Neighborhood</span>
          <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.78)", letterSpacing: 0.6, fontWeight: 700 }}>
            {inc.location.neighborhood} · {inc.location.city} · {inc.location.state}
          </span>
        </div>

        {/* Operational scoring telemetry — 4-tile inline grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
          marginBottom: 8,
        }}>
          {[
            { label: "Cluster",    value: cluster,                                       color: clusterColor },
            { label: "Likelihood", value: `${inc.scoring.claim_likelihood}%`,           color: GREEN },
            { label: "Confidence", value: `${inc.scoring.confidence}%`,                 color: BLUE },
            { label: "At Risk",    value: fmtRisk(inc.zone_impact.properties_at_risk_est), color: COPPER },
          ].map(m => (
            <div key={m.label} style={{
              position: "relative",
              padding: "5px 8px",
              background: `${m.color}10`,
              border: `1px solid ${m.color}28`,
              borderRadius: 5,
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 1.5,
                background: m.color, boxShadow: `0 0 4px ${m.color}99`, pointerEvents: "none",
              }} />
              <div style={{
                ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.3,
                color: "rgba(255,255,255,0.40)", textTransform: "uppercase",
                marginBottom: 1,
              }}>{m.label}</div>
              <div style={{
                ...mono, fontSize: 12, fontWeight: 800, color: m.color,
                letterSpacing: 0.2, lineHeight: 1,
                textShadow: `0 0 6px ${m.color}30`,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Recommendation reason */}
        <div style={{
          ...mono, fontSize: 11, color: "rgba(255,255,255,0.62)",
          lineHeight: 1.55, letterSpacing: 0.2,
          paddingTop: 8, marginTop: 6,
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          <span style={{
            color: action.color, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", fontSize: 9,
            marginRight: 6,
          }}>Recommendation ·</span>
          {inc.recommendation.reason}
        </div>

        {/* Telemetry footer */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap",
          ...mono, fontSize: 10, color: "rgba(255,255,255,0.40)", letterSpacing: 0.8,
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: BLUE, boxShadow: `0 0 4px ${BLUE}` }} />
            Reported {inc.hours_ago}h ago
          </span>
          <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: PURPLE, boxShadow: `0 0 4px ${PURPLE}` }} />
            {inc.metrics.cluster_size} cluster · {inc.metrics.repeat_incidents_30d} repeat (30d)
          </span>
          <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: GOLD, boxShadow: `0 0 4px ${GOLD}` }} />
            Outreach {inc.zone_impact.recommended_outreach_radius_mi} mi
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Intelligence feed tile ───────────────────────────────────────────
function FeedTile({ feed }) {
  const isOnline  = feed.status === "ONLINE";
  const isSyncing = feed.status === "SYNCING";
  return (
    <div style={{
      position: "relative",
      padding: "12px 14px",
      background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: `0 4px 12px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: feed.color, boxShadow: `0 0 6px ${feed.color}99`, pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 17 }}>{feed.icon}</span>
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: 0.5, textTransform: "uppercase" }}>{feed.label}</span>
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
        color: feed.color, ...mono, textTransform: "uppercase",
        padding: "2px 7px",
        background: `${feed.color}10`,
        border: `1px solid ${feed.color}38`,
        borderRadius: 3,
      }}>
        <span style={{
          width: 4, height: 4, borderRadius: 2,
          background: feed.color,
          boxShadow: `0 0 4px ${feed.color}`,
          animation: (isOnline || isSyncing) ? "crimePulse 1.6s ease-in-out infinite" : "none",
        }} />
        {feed.status}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export default function CrimeIntel() {
  const [incidents, setIncidents] = useState([]);  // CrimeIncident[]
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    fetchActiveIncidents()
      .then(d => {
        if (cancelled) return;
        setIncidents(Array.isArray(d) ? d : []);
        setLoading(false);
        mountedAt.current = Date.now();
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  void tick;

  // Composite operational metrics from the scored incident list.
  const metrics = useMemo(() => aggregateMetrics(incidents), [incidents]);
  const minutesSinceCheck = Math.floor((Date.now() - mountedAt.current) / 60000);

  return (
    <div style={{ maxWidth: 1200 }}>
      <style>{`
        @keyframes crimePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.82); }
        }
        @keyframes crimeEdge {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes crimeScan {
          0% { left: -2px; }
          100% { left: 100%; }
        }
      `}</style>

      <PageHeader
        title="Crime Intel"
        subtitle="Neighborhood and property threat intelligence — burglary, auto crime, vandalism, arson activity, AI risk scoring."
        kicker="Threat Ops"
        accent={PURPLE}
      />

      {/* Operational Status strip — composite intelligence metrics */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        marginBottom: 22,
      }}>
        <StatusTile
          label="Active Incidents"
          value={loading ? "…" : metrics.total}
          sub={metrics.total === 0 ? "Feed clear" : "Threat intel feed"}
          color={metrics.total > 0 ? PURPLE : GREEN}
          pulse={metrics.total > 0}
        />
        <StatusTile
          label="Surge Clusters"
          value={loading ? "…" : metrics.surgeClusters}
          sub={metrics.surgeClusters > 0 ? "Active / Surging zones" : "No active clusters"}
          color={metrics.surgeClusters > 0 ? RED : GREEN}
          pulse={metrics.surgeClusters > 0}
        />
        <StatusTile
          label="Targeting Priority"
          value={loading ? "…" : (metrics.avgPriority || 0)}
          sub={metrics.avgPriority >= 75 ? "Operationally urgent" : metrics.avgPriority >= 50 ? "Active monitoring" : "Standby"}
          color={metrics.avgPriority >= 75 ? RED : metrics.avgPriority >= 50 ? COPPER : GREEN}
        />
        <StatusTile
          label="Properties at Risk"
          value={loading ? "…" : (metrics.totalAtRisk >= 1000
            ? (metrics.totalAtRisk / 1000).toFixed(1) + "k"
            : String(metrics.totalAtRisk))}
          sub={`${metrics.neighborhoods} neighborhood${metrics.neighborhoods === 1 ? "" : "s"} · outreach window`}
          color={GOLD}
          pulse={metrics.totalAtRisk > 0}
        />
      </div>

      {/* Threat Heat Map console */}
      <div style={{ marginBottom: 22 }}>
        <HeatMapConsole incidents={incidents} />
      </div>

      {/* Recent Incidents grid */}
      <SectionStrip
        label={`Recent Incidents · ${incidents.length}`}
        color={PURPLE}
        right={
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: COPPER, padding: "2px 8px",
            background: `${COPPER}10`, border: `1px solid ${COPPER}38`,
            borderRadius: 3, textTransform: "uppercase",
          }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: COPPER, boxShadow: `0 0 4px ${COPPER}` }} />
            Sorted by Targeting Priority
          </span>
        }
      />

      {loading ? (
        <div style={{
          padding: "40px 20px", textAlign: "center",
          background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          ...mono, fontSize: 12, color: "rgba(255,255,255,0.50)",
          letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
          marginBottom: 24,
        }}>
          ● Scanning Incident Feed…
        </div>
      ) : incidents.length === 0 ? (
        <div style={{
          padding: "44px 24px", textAlign: "center", marginBottom: 24,
          position: "relative",
          background: `linear-gradient(180deg, ${GREEN}05 0%, rgba(255,255,255,0.005) 100%)`,
          border: `1px solid ${GREEN}25`,
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 22px ${GREEN}0d`,
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: GREEN, boxShadow: `0 0 8px ${GREEN}aa`, pointerEvents: "none",
          }} />
          <div style={{ fontSize: 38, marginBottom: 12 }}>🛡️</div>
          <div style={{ ...mono, fontSize: 14, color: "rgba(255,255,255,0.78)", fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase" }}>
            Threat Feed Clear
          </div>
          <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 8, letterSpacing: 0.6, lineHeight: 1.55, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            No qualifying incidents detected. Surfacing automatically when neighborhood activity meets operational threshold.
          </div>
        </div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12,
          marginBottom: 24,
        }}>
          {incidents.map(inc => <IncidentCard key={inc.id} inc={inc} />)}
        </div>
      )}

      {/* Intelligence Layers */}
      <SectionStrip label="Intelligence Layers" color={BLUE} />

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
        marginBottom: 24,
      }}>
        {FEEDS.map(f => <FeedTile key={f.id} feed={f} />)}
      </div>

      {/* Telemetry footer */}
      <div style={{
        marginTop: 4,
        padding: "12px 16px",
        background: "linear-gradient(90deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 50%, rgba(255,255,255,0.025) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        ...mono, fontSize: 10, color: "rgba(255,255,255,0.55)",
        letterSpacing: 1.2, fontWeight: 700, textTransform: "uppercase",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 5, height: 5, borderRadius: 3,
            background: PURPLE, boxShadow: `0 0 6px ${PURPLE}`,
            animation: "crimePulse 1.6s ease-in-out infinite",
          }} />
          Threat Monitoring Online
        </span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>Crime Feed Streaming</span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>Last Sync: {minutesSinceCheck === 0 ? "just now" : `${minutesSinceCheck}m ago`}</span>
        <span style={{
          marginLeft: "auto",
          display: "inline-flex", alignItems: "center", gap: 6,
          color: COPPER, padding: "2px 8px",
          background: `${COPPER}10`, border: `1px solid ${COPPER}38`, borderRadius: 3,
        }}>
          UPA Intelligence Network
        </span>
      </div>
    </div>
  );
}
