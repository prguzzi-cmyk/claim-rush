import { useState, useMemo, useRef, useEffect } from "react";
import PageHeader from "./shared/PageHeader";

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
  // Place incident "hot zones" on a normalized 100×100 canvas. Cluster
  // around 4 fixed regions to suggest city-scale neighborhoods. Severity
  // drives dot color + glow.
  const HOT_ZONES = useMemo(() => {
    const seeds = [
      { cx: 28, cy: 28 },
      { cx: 72, cy: 32 },
      { cx: 30, cy: 70 },
      { cx: 70, cy: 72 },
    ];
    const pts = [];
    incidents.forEach((inc, i) => {
      const seed = seeds[i % seeds.length];
      // Cluster jitter — keep dots near the seed but visibly grouped.
      const ax = seed.cx + ((i * 13) % 18 - 9);
      const ay = seed.cy + ((i * 17) % 18 - 9);
      pts.push({
        x: ax, y: ay,
        color: SEVERITY_META[inc.severity]?.color || GOLD,
        sev: inc.severity,
        label: inc.type,
      });
    });
    return pts;
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
        {/* Incident dots */}
        {HOT_ZONES.map((p, i) => {
          const sev = SEVERITY_META[p.sev] || { color: GOLD, pulse: false };
          return (
            <div key={i} style={{
              position: "absolute",
              left: `${p.x}%`, top: `${p.y}%`,
              transform: "translate(-50%, -50%)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              pointerEvents: "none",
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: 5,
                background: p.color,
                boxShadow: `0 0 14px ${p.color}, 0 0 24px ${p.color}80`,
                animation: sev.pulse ? "crimePulse 1.4s ease-in-out infinite" : "none",
              }} />
              <span style={{
                ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.2,
                color: p.color, textShadow: `0 0 6px ${p.color}aa`,
                textTransform: "uppercase",
              }}>
                {p.label}
              </span>
            </div>
          );
        })}
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

// ── Incident card — tactical intel panel ─────────────────────────────
function IncidentCard({ inc }) {
  const sev = SEVERITY_META[inc.severity] || SEVERITY_META.MODERATE;
  const stat = STATUS_META[inc.status] || STATUS_META.LOGGED;
  const icon = TYPE_ICONS[inc.type] || "⚠️";
  return (
    <div style={{
      position: "relative",
      padding: "16px 18px 16px 22px",
      background: `linear-gradient(135deg, ${sev.color}10 0%, ${sev.color}02 60%, rgba(255,255,255,0.012) 100%)`,
      border: `1px solid ${sev.color}30`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 6px 18px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.03), 0 0 20px ${sev.color}14`,
    }}>
      {/* Severity-encoded left edge */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 4,
        background: sev.color,
        boxShadow: `0 0 14px ${sev.color}cc, 0 0 24px ${sev.color}55`,
        pointerEvents: "none",
        animation: sev.pulse ? "crimeEdge 2.4s ease-in-out infinite" : "none",
      }} />
      {/* Ambient corner glow */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 160, height: 160,
        background: `radial-gradient(circle, ${sev.color}1c 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", gap: 14 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Tier 1: severity chip + type */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
              color: sev.color, padding: "2px 8px",
              background: `${sev.color}1a`, border: `1px solid ${sev.color}55`,
              borderRadius: 3, ...mono, textTransform: "uppercase",
              boxShadow: sev.pulse ? `0 0 10px ${sev.color}40` : "none",
            }}>
              {sev.pulse && (
                <span style={{ width: 5, height: 5, borderRadius: 3, background: sev.color, boxShadow: `0 0 5px ${sev.color}`, animation: "crimePulse 1.4s ease-in-out infinite" }} />
              )}
              {inc.severity}
            </span>
            <span style={{
              fontSize: 16, fontWeight: 800, color: "#fff",
              ...mono, letterSpacing: 0.5, textTransform: "uppercase",
              textShadow: `0 0 10px ${sev.color}40`,
            }}>{inc.type}</span>
            <span style={{ marginLeft: "auto" }}>
              <RiskRing value={inc.riskScore} color={sev.color} />
            </span>
          </div>
          {/* Tier 2: address + neighborhood */}
          <div style={{
            ...mono, fontSize: 13, color: "rgba(255,255,255,0.85)",
            letterSpacing: 0.3, fontWeight: 700, marginBottom: 4,
          }}>
            {inc.address}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6,
          }}>
            <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 800 }}>Neighborhood</span>
            <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.78)", letterSpacing: 0.6, fontWeight: 700 }}>
              {inc.neighborhood} · {inc.city} · {inc.state}
            </span>
          </div>
          {/* Telemetry footer */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginTop: 8,
            ...mono, fontSize: 10, color: "rgba(255,255,255,0.40)", letterSpacing: 0.8,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: BLUE, boxShadow: `0 0 4px ${BLUE}` }} />
              Reported {inc.hours}h ago
            </span>
            <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 7px",
              background: `${stat.color}10`,
              border: `1px solid ${stat.color}38`,
              borderRadius: 3,
              color: stat.color, fontWeight: 800, letterSpacing: 1.2,
              textTransform: "uppercase",
            }}>
              {stat.pulse && (
                <span style={{ width: 4, height: 4, borderRadius: 2, background: stat.color, boxShadow: `0 0 4px ${stat.color}`, animation: "crimePulse 1.4s ease-in-out infinite" }} />
              )}
              {inc.status}
            </span>
          </div>
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
  const [tick, setTick] = useState(0);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  void tick;

  // Derived ops metrics from demo data; live from `apiFetch` later.
  const metrics = useMemo(() => {
    const critical = DEMO_INCIDENTS.filter(i => i.severity === "CRITICAL").length;
    const neighborhoods = new Set(DEMO_INCIDENTS.map(i => i.neighborhood)).size;
    const avgRisk = Math.round(
      DEMO_INCIDENTS.reduce((s, i) => s + i.riskScore, 0) / DEMO_INCIDENTS.length
    );
    return {
      total: DEMO_INCIDENTS.length,
      critical,
      neighborhoods,
      avgRisk,
    };
  }, []);

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

      {/* Operational Status strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        marginBottom: 22,
      }}>
        <StatusTile
          label="Active Incidents"
          value={metrics.total}
          sub="Sample dataset"
          color={metrics.total > 0 ? PURPLE : GREEN}
          pulse={metrics.total > 0}
        />
        <StatusTile
          label="Critical Threats"
          value={metrics.critical}
          sub={metrics.critical > 0 ? "Immediate priority" : "All clear"}
          color={metrics.critical > 0 ? RED : GREEN}
          pulse={metrics.critical > 0}
        />
        <StatusTile
          label="Neighborhoods Tracked"
          value={metrics.neighborhoods}
          sub="Active threat zones"
          color={GOLD}
        />
        <StatusTile
          label="Avg Risk Score"
          value={metrics.avgRisk}
          sub="0–100 AI scale"
          color={metrics.avgRisk >= 80 ? RED : metrics.avgRisk >= 60 ? COPPER : GREEN}
        />
      </div>

      {/* Threat Heat Map console */}
      <div style={{ marginBottom: 22 }}>
        <HeatMapConsole incidents={DEMO_INCIDENTS} />
      </div>

      {/* Recent Incidents grid */}
      <SectionStrip
        label={`Recent Incidents · ${DEMO_INCIDENTS.length}`}
        color={PURPLE}
        right={
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: GOLD, padding: "2px 8px",
            background: `${GOLD}10`, border: `1px solid ${GOLD}38`,
            borderRadius: 3, textTransform: "uppercase",
          }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: GOLD, boxShadow: `0 0 4px ${GOLD}` }} />
            Demo Mode · Sample Incidents
          </span>
        }
      />

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12,
        marginBottom: 24,
      }}>
        {DEMO_INCIDENTS.map(inc => <IncidentCard key={inc.id} inc={inc} />)}
      </div>

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
