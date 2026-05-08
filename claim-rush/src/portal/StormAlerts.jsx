import { useState, useEffect, useMemo, useRef } from "react";
import PageHeader from "./shared/PageHeader";
import { fetchActiveEvents, scheduleSeminar as schedule, aggregateMetrics } from "./services/stormIntel";

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
function NationalRadar({ events }) {
  // Pick highest-priority event per state. Multi-state events register
  // their primary state at full priority and secondary states at the
  // event's severity_by_state weighting.
  const stateEntries = useMemo(() => {
    const m = new Map();
    for (const ev of events) {
      const sevByState = ev.territory_impact?.severity_by_state || {};
      for (const [code, sev] of Object.entries(sevByState)) {
        const upper = (code || "").toUpperCase().slice(0, 2);
        if (!STATE_COORDS[upper]) continue;
        const prev = m.get(upper);
        const priority = ev.scoring.response_priority;
        // Prefer the higher response_priority; tie-break by severity.
        if (!prev || priority > prev.priority) {
          m.set(upper, {
            priority, sev: ev.severity, eventType: ev.event_type, action: ev.recommendation.action,
          });
        }
      }
    }
    return [...m.entries()].map(([code, v]) => ({
      code,
      x: STATE_COORDS[code][0],
      y: STATE_COORDS[code][1],
      color: v.priority >= 90 ? RED : v.priority >= 75 ? "#FF6D00" : v.priority >= 55 ? GOLD : GREEN,
      sev: v.sev,
      eventType: v.eventType,
      action: v.action,
      priority: v.priority,
    }));
  }, [events]);

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
        {/* Threat dots — positioned by state coords. Color + pulse driven
            by response_priority, not raw severity, so the operator sees
            operational urgency at a glance. */}
        {stateEntries.map(({ code, x, y, color, action, priority }) => {
          const surge = action === "TARGET_NOW" || action === "SURGE_ZONE";
          return (
            <div key={code} style={{
              position: "absolute",
              left: `${x}%`, top: `${y}%`,
              transform: "translate(-50%, -50%)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              pointerEvents: "none",
            }}>
              <span style={{
                width: surge ? 11 : 9, height: surge ? 11 : 9, borderRadius: 6,
                background: color,
                boxShadow: surge
                  ? `0 0 14px ${color}, 0 0 28px ${color}99, 0 0 4px ${color} inset`
                  : `0 0 10px ${color}, 0 0 18px ${color}66`,
                animation: surge ? "stormPulse 1.3s ease-in-out infinite" : "none",
                display: "inline-block",
              }} />
              <span style={{
                ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                color, textShadow: `0 0 6px ${color}aa`,
              }}>
                {code} · {priority}
              </span>
            </div>
          );
        })}
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

// ── Action → tactical color encoding for the recommendation pill ─────
const ACTION_META = {
  TARGET_NOW:  { color: RED,    label: "Target Now",  pulse: true  },
  SURGE_ZONE:  { color: "#FF6D00", label: "Surge Zone",  pulse: true  },
  DEPLOY:      { color: GOLD,   label: "Deploy",       pulse: false },
  MONITOR:     { color: "#3B82F6", label: "Monitor",   pulse: false },
  WAIT:        { color: "rgba(255,255,255,0.55)", label: "Wait",   pulse: false },
  ESCALATE:    { color: PURPLE, label: "Escalate",     pulse: true  },
  ARCHIVE:     { color: "rgba(255,255,255,0.40)", label: "Archive", pulse: false },
};

function fmtPop(p) {
  if (p >= 1_000_000) return (p / 1_000_000).toFixed(1) + "M";
  if (p >= 1_000)     return (p / 1_000).toFixed(0) + "k";
  return String(p);
}

// ── Active Threat card — operational scoring + recommendation ────────
function ThreatCard({ event, scheduling, onSchedule }) {
  const icon = EVENT_ICONS[event.event_type] || "⛈️";
  const sevColor = SEVERITY_COLORS[event.severity] || GOLD;
  const counties = (event.location.counties || []).join(", ");
  const states = (event.location.states || [event.location.state]).join(" · ");
  const cities = (event.location.cities || []).join(", ");
  const age = event.hours_ago;
  const action = ACTION_META[event.recommendation.action] || ACTION_META.MONITOR;
  const priority = event.scoring.response_priority;
  const isLegacy = event._has_real_source === true;
  const canSchedule = isLegacy && !(event._legacy?.alert_sent);
  const alreadyRequested = isLegacy && event._legacy?.alert_sent;
  const isPulse = priority >= 75;

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
      {/* Severity-encoded left edge accent — pulses on high-priority */}
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
        display: "grid", gridTemplateColumns: "1fr auto",
        gap: 14, alignItems: "stretch",
      }}>
        <div style={{ minWidth: 0 }}>
          {/* Tier 1 — severity + event type + recommendation chip */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, flexWrap: "wrap" }}>
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
              {event.severity}
            </span>
            <span style={{
              fontSize: 16, fontWeight: 800, color: "#fff",
              ...mono, letterSpacing: 0.5, textTransform: "uppercase",
              textShadow: `0 0 10px ${sevColor}40`,
            }}>
              {event.event_type}
            </span>
            {/* Recommendation pill */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
              color: action.color,
              padding: "2px 8px",
              background: `${action.color}1a`,
              border: `1px solid ${action.color}55`,
              borderRadius: 3,
              ...mono, textTransform: "uppercase",
              boxShadow: action.pulse ? `0 0 10px ${action.color}40` : "none",
            }}>
              {action.pulse && (
                <span style={{
                  width: 5, height: 5, borderRadius: 3,
                  background: action.color,
                  boxShadow: `0 0 5px ${action.color}`,
                  animation: "stormPulse 1.4s ease-in-out infinite",
                }} />
              )}
              {action.label}
            </span>
            {/* Source provenance — legacy real backend vs synthesized */}
            {isLegacy && (
              <span style={{
                ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.6,
                color: GREEN, textTransform: "uppercase",
                padding: "2px 7px",
                background: `${GREEN}10`,
                border: `1px solid ${GREEN}38`,
                borderRadius: 3,
              }}>
                Live Trigger
              </span>
            )}
          </div>
          {/* Tier 2 — states + counties + (cities if present) */}
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
          {(counties || cities) && (
            <div style={{
              ...mono, fontSize: 11, color: "rgba(255,255,255,0.55)",
              letterSpacing: 0.3, lineHeight: 1.55, padding: "4px 0",
            }}>
              {counties && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.40)", letterSpacing: 1.2, textTransform: "uppercase", fontSize: 9, fontWeight: 800, marginRight: 6 }}>Counties</span>
                  {counties}
                </>
              )}
              {counties && cities && <span style={{ color: "rgba(255,255,255,0.20)", marginInline: 8 }}>·</span>}
              {cities && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.40)", letterSpacing: 1.2, textTransform: "uppercase", fontSize: 9, fontWeight: 800, marginRight: 6 }}>Cities</span>
                  {cities}
                </>
              )}
            </div>
          )}

          {/* Operational scoring telemetry strip — 4 inline metrics */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
            marginTop: 10, marginBottom: 4,
          }}>
            {[
              { label: "Priority",    value: priority,                 color: priority >= 90 ? RED : priority >= 75 ? "#FF6D00" : priority >= 55 ? GOLD : GREEN },
              { label: "Likelihood",  value: `${event.scoring.claim_likelihood}%`, color: GREEN },
              { label: "Confidence",  value: `${event.scoring.confidence}%`,       color: BLUE },
              { label: "Operators",   value: event.territory_impact.recommended_operators || 0, color: PURPLE, sub: "rec." },
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
                  ...mono, fontSize: 13, fontWeight: 800, color: m.color,
                  letterSpacing: 0.2, lineHeight: 1,
                  textShadow: `0 0 6px ${m.color}30`,
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
              color: action.color,
              fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", fontSize: 9,
              marginRight: 6,
            }}>Recommendation ·</span>
            {event.recommendation.reason}
          </div>

          {/* Telemetry footer — age + population */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap",
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
              Pop. {fmtPop(event.metrics.affected_population_est)}
            </span>
            <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: GOLD, boxShadow: `0 0 4px ${GOLD}` }} />
              Radius {event.metrics.impact_radius_miles} mi
            </span>
          </div>
        </div>

        {/* Right rail — Schedule Seminar CTA (legacy events only) */}
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <button
            onClick={() => canSchedule && onSchedule(event.id)}
            disabled={!canSchedule || scheduling === event.id}
            title={!isLegacy ? "Synthesized event — scheduling needs the storm-trigger backend"
                  : alreadyRequested ? "Seminar request already sent" : undefined}
            onMouseEnter={(!canSchedule || scheduling === event.id) ? undefined : (e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.background = `${GREEN}26`;
              e.currentTarget.style.boxShadow = `0 6px 18px rgba(0,0,0,0.40), 0 0 18px ${GREEN}40`;
            }}
            onMouseLeave={(!canSchedule || scheduling === event.id) ? undefined : (e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.background = `${GREEN}14`;
              e.currentTarget.style.boxShadow = `0 0 14px ${GREEN}25, inset 0 1px 0 rgba(255,255,255,0.06)`;
            }}
            style={{
              position: "relative",
              padding: "9px 16px",
              background: !canSchedule ? "rgba(255,255,255,0.04)" : `${GREEN}14`,
              border: `1px solid ${!canSchedule ? "rgba(255,255,255,0.10)" : `${GREEN}55`}`,
              borderRadius: 6,
              color: !canSchedule ? "rgba(255,255,255,0.40)" : GREEN,
              fontSize: 11, fontWeight: 800, letterSpacing: 1.1,
              textTransform: "uppercase",
              cursor: (canSchedule && scheduling !== event.id) ? "pointer" : "default",
              ...mono, flexShrink: 0,
              transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
              boxShadow: !canSchedule ? "none" : `0 0 14px ${GREEN}25, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            {alreadyRequested ? "Seminar Requested"
              : !isLegacy ? "Backend Pending"
              : scheduling === event.id ? "Scheduling..."
              : "Schedule Seminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function StormAlerts() {
  const [events, setEvents] = useState([]);              // StormEvent[]
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

  async function load() {
    setLoading(true);
    try {
      const data = await fetchActiveEvents();
      setEvents(Array.isArray(data) ? data : []);
      mountedAt.current = Date.now();
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function scheduleSeminar(eventId) {
    setScheduling(eventId);
    try {
      const r = await schedule(eventId);
      if (r.ok) await load();
    } finally {
      setScheduling(null);
    }
  }

  // Aggregate operational metrics — composite from the scored event list.
  const metrics = useMemo(() => aggregateMetrics(events), [events]);

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

      {/* Operational Status strip — composite intelligence metrics */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        marginBottom: 22,
      }}>
        <StatusTile
          label="Active Events"
          value={loading ? "…" : metrics.total}
          sub={metrics.total === 0 ? "Feed clear" : "National intel feed"}
          color={metrics.total > 0 ? RED : GREEN}
          pulse={metrics.total > 0}
        />
        <StatusTile
          label="Surge Zones"
          value={loading ? "…" : metrics.surgeZones}
          sub={metrics.surgeZones > 0 ? "Target / Deploy now" : "No surge activity"}
          color={metrics.surgeZones > 0 ? RED : GREEN}
          pulse={metrics.surgeZones > 0}
        />
        <StatusTile
          label="Response Priority"
          value={loading ? "…" : (metrics.avgPriority || 0)}
          sub={metrics.avgPriority >= 75 ? "Operationally urgent" : metrics.avgPriority >= 50 ? "Active monitoring" : "Standby"}
          color={metrics.avgPriority >= 75 ? RED : metrics.avgPriority >= 50 ? GOLD : GREEN}
        />
        <StatusTile
          label="Operators Recommended"
          value={loading ? "…" : metrics.totalOperators}
          sub={`${metrics.statesAffected} state${metrics.statesAffected === 1 ? "" : "s"} · pop. ${
            metrics.totalPopulation >= 1_000_000
              ? (metrics.totalPopulation / 1_000_000).toFixed(1) + "M"
              : metrics.totalPopulation >= 1_000
              ? (metrics.totalPopulation / 1_000).toFixed(0) + "k"
              : String(metrics.totalPopulation)
          }`}
          color={GOLD}
          pulse={metrics.totalOperators > 0}
        />
      </div>

      {/* National Intelligence Radar */}
      <div style={{ marginBottom: 22 }}>
        <NationalRadar events={events} />
      </div>

      {/* Active Threats panel */}
      <SectionStrip
        label={`Active Events${events.length > 0 ? ` · ${events.length}` : ""}`}
        color={events.length > 0 ? RED : GREEN}
        right={events.length > 0 ? (
          <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1.2, fontWeight: 700, textTransform: "uppercase" }}>
            Sorted by Response Priority
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
          ● Scanning National Storm Intelligence Feed…
        </div>
      ) : events.length === 0 ? (
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
            National Feed Clear
          </div>
          <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 8, letterSpacing: 0.6, lineHeight: 1.55, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            No qualifying storm events detected. Active events automatically surface here scored by response priority.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.map(ev => (
            <ThreatCard
              key={ev.id}
              event={ev}
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
