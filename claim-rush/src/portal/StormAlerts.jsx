import { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "../lib/api";
import PageHeader from "./shared/PageHeader";

/**
 * Phase 17e — Storm Alerts for CP/RVP/Agent.
 * Shows active storm triggers in their territory with one-click seminar scheduling.
 *
 * Phase 24 — Storm Intel command-center upgrade. Same backend data
 * (`/seminars/storm-triggers/alerts/me`), now presented as an operational
 * intelligence environment: ops status strip + national radar panel +
 * active threats grid + telemetry footer. No backend / API / routing
 * changes — purely visual evolution.
 */

const GOLD = "#C9A84C";
const GREEN = "#00E6A8";
const RED = "#E05050";
const BLUE = "#3B82F6";
const PURPLE = "#A855F7";
const ORANGE = "#FF6D00";
const mono = { fontFamily: "'Courier New', monospace" };

const EVENT_ICONS = { tornado: "🌪️", hail: "🧊", hurricane: "🌀", flooding: "💧", fire: "🔥", wind: "💨" };
const SEVERITY_COLORS = { extreme: RED, severe: RED, high: ORANGE, moderate: GOLD, low: "rgba(255,255,255,0.40)" };

// Approximate US state centroids on a 100×100 normalized grid. Used by the
// National Intelligence Radar to place threat dots roughly where the
// affected regions sit on a continental map. Not geographically precise —
// just enough positional intelligence for at-a-glance regional scan.
const STATE_COORDS = {
  AL: [62, 72], AK: [10, 92], AZ: [22, 62], AR: [50, 65], CA: [8, 48],
  CO: [30, 50], CT: [88, 30], DE: [84, 40], FL: [75, 84], GA: [70, 70],
  HI: [18, 90], ID: [22, 28], IL: [56, 45], IN: [62, 45], IA: [50, 38],
  KS: [42, 55], KY: [64, 53], LA: [50, 78], ME: [92, 16], MD: [82, 42],
  MA: [88, 25], MI: [64, 32], MN: [50, 25], MS: [56, 72], MO: [50, 52],
  MT: [28, 20], NE: [40, 42], NV: [16, 43], NH: [88, 20], NJ: [86, 34],
  NM: [30, 63], NY: [82, 26], NC: [76, 58], ND: [40, 20], OH: [68, 42],
  OK: [44, 62], OR: [12, 26], PA: [78, 35], RI: [90, 28], SC: [74, 65],
  SD: [40, 30], TN: [62, 60], TX: [42, 78], UT: [22, 46], VT: [86, 20],
  VA: [78, 50], WA: [16, 16], WV: [74, 47], WI: [56, 30], WY: [30, 34],
};

// ── Operational Status tile ────────────────────────────────────────────
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
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: color,
        boxShadow: `0 0 8px ${color}aa`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: -30, right: -30,
        width: 110, height: 110,
        background: `radial-gradient(circle, ${color}20 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", gap: 6,
        ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.55)",
        marginBottom: 4,
      }}>
        {pulse && (
          <span style={{
            width: 5, height: 5, borderRadius: 3,
            background: color,
            boxShadow: `0 0 6px ${color}aa`,
            animation: "stormPulse 1.6s ease-in-out infinite",
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
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          position: "relative", zIndex: 1,
          ...mono, fontSize: 9, color: "rgba(255,255,255,0.40)",
          letterSpacing: 1.2, textTransform: "uppercase",
          marginTop: 6, fontWeight: 700,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Cinematic section strip header ────────────────────────────────────
function SectionStrip({ label, color = "#00E6A8", right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      marginBottom: 12,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 3,
        background: color,
        boxShadow: `0 0 6px ${color}cc`,
        display: "inline-block",
      }} />
      <span style={{
        ...mono, fontSize: 11, color: "rgba(255,255,255,0.78)",
        fontWeight: 800, letterSpacing: 1.8,
        textTransform: "uppercase",
      }}>{label}</span>
      <span style={{
        flex: 1, height: 1,
        background: `linear-gradient(90deg, ${color}28 0%, rgba(255,255,255,0.04) 60%, transparent 100%)`,
      }} />
      {right}
    </div>
  );
}

// ── National Intelligence Radar — atmospheric map placeholder ─────────
function NationalRadar({ alerts }) {
  // Collect all (state, severity) pairs across alerts. Same state hit by
  // multiple events gets the most-severe color; duplicates dropped.
  const sevRank = { extreme: 5, severe: 4, high: 3, moderate: 2, low: 1 };
  const stateEntries = useMemo(() => {
    const m = new Map();
    for (const a of alerts) {
      const states = a.affected_states || [];
      const sev = a.severity || "moderate";
      for (const s of states) {
        const code = (s || "").toUpperCase().slice(0, 2);
        if (!STATE_COORDS[code]) continue;
        const prev = m.get(code);
        if (!prev || sevRank[sev] > sevRank[prev.sev]) {
          m.set(code, { sev, eventType: a.event_type });
        }
      }
    }
    return [...m.entries()].map(([code, v]) => ({
      code,
      x: STATE_COORDS[code][0],
      y: STATE_COORDS[code][1],
      color: SEVERITY_COLORS[v.sev] || GOLD,
      sev: v.sev,
      eventType: v.eventType,
    }));
  }, [alerts]);

  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
      border: `1px solid ${RED}26`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 6px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 26px ${RED}10`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: RED, boxShadow: `0 0 10px ${RED}aa`, pointerEvents: "none",
      }} />
      {/* Header strip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "10px 16px",
        background: "rgba(255,255,255,0.025)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: RED,
          boxShadow: `0 0 6px ${RED}cc`,
          animation: "stormPulse 1.6s ease-in-out infinite",
        }} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          National Intelligence Grid
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, ...mono, fontWeight: 800, letterSpacing: 1.5, color: GREEN, padding: "2px 8px", background: `${GREEN}10`, border: `1px solid ${GREEN}40`, borderRadius: 3, textTransform: "uppercase" }}>
          <span style={{ width: 4, height: 4, borderRadius: 2, background: GREEN, boxShadow: `0 0 5px ${GREEN}`, animation: "stormPulse 1.6s ease-in-out infinite" }} />
          Monitoring · Live
        </span>
      </div>
      {/* Radar canvas */}
      <div style={{
        position: "relative",
        height: 320,
        background: "radial-gradient(ellipse at center, rgba(0,230,168,0.04) 0%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0.4) 100%)",
        overflow: "hidden",
      }}>
        {/* Subtle grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(0deg, rgba(0,230,168,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,230,168,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }} />
        {/* Center crosshairs */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "rgba(0,230,168,0.10)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "rgba(0,230,168,0.10)", pointerEvents: "none" }} />
        {/* Sweeping scan line */}
        <div style={{
          position: "absolute",
          top: 0, bottom: 0, width: 2,
          background: `linear-gradient(90deg, transparent 0%, ${GREEN} 50%, transparent 100%)`,
          boxShadow: `0 0 16px ${GREEN}80`,
          animation: "stormScan 6s linear infinite",
          pointerEvents: "none",
        }} />
        {/* Concentric rings */}
        {[120, 240, 360].map((s, i) => (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            width: s, height: s, borderRadius: "50%",
            border: "1px solid rgba(0,230,168,0.06)",
            pointerEvents: "none",
          }} />
        ))}
        {/* Threat dots — positioned by state coords */}
        {stateEntries.map(({ code, x, y, color, sev, eventType }) => (
          <div key={code} style={{
            position: "absolute",
            left: `${x}%`, top: `${y}%`,
            transform: "translate(-50%, -50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            pointerEvents: "none",
          }}>
            <span style={{
              width: 9, height: 9, borderRadius: 5,
              background: color,
              boxShadow: `0 0 12px ${color}, 0 0 22px ${color}80`,
              animation: (sev === "extreme" || sev === "severe") ? "stormPulse 1.3s ease-in-out infinite" : "none",
              display: "inline-block",
            }} />
            <span style={{
              ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1,
              color, textShadow: `0 0 6px ${color}aa`,
            }}>
              {code}
            </span>
          </div>
        ))}
        {/* Empty-state center label */}
        {stateEntries.length === 0 && (
          <div style={{
            position: "absolute", left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            ...mono, fontSize: 10, color: "rgba(255,255,255,0.40)",
            letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700,
          }}>
            <span style={{ fontSize: 28 }}>☀️</span>
            All Regions Clear
          </div>
        )}
      </div>
      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px",
        background: "rgba(255,255,255,0.015)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        ...mono, fontSize: 10, color: "rgba(255,255,255,0.45)",
        letterSpacing: 0.8,
      }}>
        <span>● {stateEntries.length} STATE{stateEntries.length === 1 ? "" : "S"} TRACKED</span>
        <span style={{ color: "rgba(255,255,255,0.30)" }}>SCAN INTERVAL: 6s</span>
      </div>
    </div>
  );
}

// ── Active Threat card ────────────────────────────────────────────────
function ThreatCard({ alert, scheduling, onSchedule }) {
  const meta = alert.metadata_json ? JSON.parse(alert.metadata_json) : {};
  const icon = EVENT_ICONS[alert.event_type] || "⛈️";
  const sevColor = SEVERITY_COLORS[alert.severity] || GOLD;
  const counties = (alert.affected_counties || []).join(", ");
  const states = (alert.affected_states || []).join(" · ");
  const age = Math.round((Date.now() - new Date(alert.triggered_at).getTime()) / 3600000);
  const isPulse = alert.severity === "extreme" || alert.severity === "severe";

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
      {/* Severity-encoded left edge accent */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 4,
        background: sevColor,
        boxShadow: `0 0 14px ${sevColor}cc, 0 0 24px ${sevColor}55`,
        pointerEvents: "none",
        animation: isPulse ? "stormEdge 2.4s ease-in-out infinite" : "none",
      }} />
      {/* Ambient corner glow */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 160, height: 160,
        background: `radial-gradient(circle, ${sevColor}1c 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        gap: 14,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Tier 1: severity chip + event type + states */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
              color: sevColor,
              padding: "2px 8px",
              background: `${sevColor}1a`,
              border: `1px solid ${sevColor}55`,
              borderRadius: 3,
              ...mono, textTransform: "uppercase",
              boxShadow: isPulse ? `0 0 10px ${sevColor}40` : "none",
            }}>
              {isPulse && (
                <span style={{
                  width: 5, height: 5, borderRadius: 3,
                  background: sevColor,
                  boxShadow: `0 0 5px ${sevColor}`,
                  animation: "stormPulse 1.4s ease-in-out infinite",
                }} />
              )}
              {alert.severity}
            </span>
            <span style={{
              fontSize: 16, fontWeight: 800, color: "#fff",
              ...mono, letterSpacing: 0.5, textTransform: "uppercase",
              textShadow: `0 0 10px ${sevColor}40`,
            }}>
              {alert.event_type}
            </span>
          </div>
          {/* Tier 2: states + counties */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            marginBottom: 6,
          }}>
            <span style={{
              ...mono, fontSize: 10, color: "rgba(255,255,255,0.45)",
              letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 800,
            }}>States</span>
            <span style={{
              ...mono, fontSize: 12, color: "rgba(255,255,255,0.85)",
              letterSpacing: 0.6, fontWeight: 700,
            }}>
              {states || "—"}
            </span>
          </div>
          {counties && (
            <div style={{
              ...mono, fontSize: 11, color: "rgba(255,255,255,0.55)",
              letterSpacing: 0.3, lineHeight: 1.55,
              padding: "4px 0",
            }}>
              <span style={{ color: "rgba(255,255,255,0.40)", letterSpacing: 1.2, textTransform: "uppercase", fontSize: 9, fontWeight: 800, marginRight: 6 }}>Counties</span>
              {counties}
            </div>
          )}
          {/* Telemetry footer */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginTop: 8,
            ...mono, fontSize: 10, color: "rgba(255,255,255,0.40)",
            letterSpacing: 0.8,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: BLUE, boxShadow: `0 0 4px ${BLUE}` }} />
              Detected {age}h ago
            </span>
            <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: PURPLE, boxShadow: `0 0 4px ${PURPLE}` }} />
              {meta.total_events || "?"} EVENTS TRACKED
            </span>
          </div>
        </div>
        {/* Schedule Seminar CTA */}
        <button
          onClick={() => !alert.alert_sent && onSchedule(alert.id)}
          disabled={scheduling === alert.id || alert.alert_sent}
          onMouseEnter={(alert.alert_sent || scheduling === alert.id) ? undefined : (e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.background = `${GREEN}26`;
            e.currentTarget.style.boxShadow = `0 6px 18px rgba(0,0,0,0.40), 0 0 18px ${GREEN}40`;
          }}
          onMouseLeave={(alert.alert_sent || scheduling === alert.id) ? undefined : (e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.background = `${GREEN}14`;
            e.currentTarget.style.boxShadow = `0 0 14px ${GREEN}25, inset 0 1px 0 rgba(255,255,255,0.06)`;
          }}
          style={{
            position: "relative",
            padding: "9px 16px",
            background: alert.alert_sent ? "rgba(255,255,255,0.04)" : `${GREEN}14`,
            border: `1px solid ${alert.alert_sent ? "rgba(255,255,255,0.10)" : `${GREEN}55`}`,
            borderRadius: 6,
            color: alert.alert_sent ? "rgba(255,255,255,0.40)" : GREEN,
            fontSize: 11, fontWeight: 800, letterSpacing: 1.1,
            textTransform: "uppercase",
            cursor: (alert.alert_sent || scheduling === alert.id) ? "default" : "pointer",
            ...mono, flexShrink: 0,
            transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
            boxShadow: alert.alert_sent ? "none" : `0 0 14px ${GREEN}25, inset 0 1px 0 rgba(255,255,255,0.06)`,
          }}
        >
          {alert.alert_sent ? "Seminar Requested" : scheduling === alert.id ? "Scheduling..." : "Schedule Seminar"}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function StormAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(null);
  const [tick, setTick] = useState(0);
  const mountedAt = useRef(Date.now());

  useEffect(() => { load(); }, []);
  useEffect(() => {
    // Drives the "last check" telemetry display. Re-renders every minute
    // — does not refire the API.
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  function load() {
    setLoading(true);
    apiFetch("/seminars/storm-triggers/alerts/me")
      .then(r => r.ok ? r.json() : [])
      .then(d => { setAlerts(Array.isArray(d) ? d : []); setLoading(false); mountedAt.current = Date.now(); })
      .catch(() => setLoading(false));
  }

  function scheduleSeminar(triggerId) {
    setScheduling(triggerId);
    apiFetch(`/seminars/storm-triggers/${triggerId}/schedule-seminar`, { method: "POST" })
      .then(r => r.json())
      .then(() => { setScheduling(null); load(); })
      .catch(() => setScheduling(null));
  }

  // Derived ops metrics — live from the same alerts payload.
  const metrics = useMemo(() => {
    const extremeCount = alerts.filter(a => a.severity === "extreme" || a.severity === "severe").length;
    const allStates = new Set();
    for (const a of alerts) for (const s of (a.affected_states || [])) allStates.add(s);
    return {
      total: alerts.length,
      extreme: extremeCount,
      regions: allStates.size,
    };
  }, [alerts]);

  const minutesSinceCheck = Math.floor((Date.now() - mountedAt.current) / 60000);
  // tick is read by minutesSinceCheck implicitly via render; reference it
  // so the linter doesn't flag the unused state.
  void tick;

  return (
    <div style={{ maxWidth: 1100 }}>
      <style>{`
        @keyframes stormPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.82); }
        }
        @keyframes stormEdge {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes stormScan {
          0% { left: -2px; }
          100% { left: 100%; }
        }
      `}</style>

      <PageHeader
        title="Storm Intel"
        subtitle="Live national storm intelligence — track severe weather across your territory and capture impacted homeowner leads."
        kicker="Storm Intel"
        accent="#E05050"
      />

      {/* Operational Status strip — derived KPIs */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        marginBottom: 22,
      }}>
        <StatusTile
          label="Active Threats"
          value={loading ? "…" : metrics.total}
          sub={metrics.total === 0 ? "No active alerts" : "Real-time feed"}
          color={metrics.total > 0 ? RED : GREEN}
          pulse={metrics.total > 0}
        />
        <StatusTile
          label="Extreme · Severe"
          value={loading ? "…" : metrics.extreme}
          sub={metrics.extreme > 0 ? "Critical priority" : "All clear"}
          color={metrics.extreme > 0 ? RED : GREEN}
          pulse={metrics.extreme > 0}
        />
        <StatusTile
          label="Impacted Regions"
          value={loading ? "…" : metrics.regions}
          sub="States with active threats"
          color={metrics.regions > 0 ? GOLD : GREEN}
        />
        <StatusTile
          label="Systems Online"
          value="8/8"
          sub="All sensors operational"
          color={GREEN}
          pulse
        />
      </div>

      {/* National Intelligence Radar */}
      <div style={{ marginBottom: 22 }}>
        <NationalRadar alerts={alerts} />
      </div>

      {/* Active Threats panel */}
      <SectionStrip
        label={`Active Threats${alerts.length > 0 ? ` · ${alerts.length}` : ""}`}
        color={alerts.length > 0 ? RED : GREEN}
        right={alerts.length > 0 ? (
          <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1.2 }}>
            SCROLLING FEED
          </span>
        ) : null}
      />

      {loading ? (
        <div style={{
          padding: "40px 20px", textAlign: "center",
          background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          ...mono, fontSize: 12, color: "rgba(255,255,255,0.50)",
          letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
        }}>
          ● Scanning Storm Trigger Feed…
        </div>
      ) : alerts.length === 0 ? (
        <div style={{
          padding: "44px 24px", textAlign: "center",
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
          <div style={{ fontSize: 38, marginBottom: 12 }}>☀️</div>
          <div style={{ ...mono, fontSize: 14, color: "rgba(255,255,255,0.78)", fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase" }}>
            All Clear
          </div>
          <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 8, letterSpacing: 0.6, lineHeight: 1.55, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            No active storm alerts in your territory. Alerts appear automatically when severe weather is detected in your assigned states.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alerts.map(alert => (
            <ThreatCard
              key={alert.id}
              alert={alert}
              scheduling={scheduling}
              onSchedule={scheduleSeminar}
            />
          ))}
        </div>
      )}

      {/* Telemetry footer */}
      <div style={{
        marginTop: 24,
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
            background: GREEN,
            boxShadow: `0 0 6px ${GREEN}`,
            animation: "stormPulse 1.6s ease-in-out infinite",
          }} />
          Monitoring Active
        </span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>Storm Trigger Feed Online</span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>Last Check: {minutesSinceCheck === 0 ? "just now" : `${minutesSinceCheck}m ago`}</span>
        <span style={{
          marginLeft: "auto",
          display: "inline-flex", alignItems: "center", gap: 6,
          color: BLUE, padding: "2px 8px",
          background: `${BLUE}10`, border: `1px solid ${BLUE}35`, borderRadius: 3,
        }}>
          UPA Intelligence Network
        </span>
      </div>
    </div>
  );
}
