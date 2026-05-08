import { useState, useMemo, useRef, useEffect } from "react";
import PageHeader from "./shared/PageHeader";
import { analyzeAddress, saveTarget, loadTargets, removeTarget } from "./services/roofIntel";

/**
 * Roof Intel — flagship satellite-grade operational targeting environment.
 *
 * Today this module renders an investor-demo-ready intelligence surface
 * with sample property targets. The shell is fully wired to receive live
 * data when the backend ships — `targets`, `feedStatus`, `metrics` are
 * the data hooks. No backend / API / routing changes required to swap
 * sample data for live.
 */

const COPPER = "#FF6D00";
const GOLD   = "#C9A84C";
const GREEN  = "#00E6A8";
const RED    = "#E05050";
const BLUE   = "#3B82F6";
const PURPLE = "#A855F7";
const mono = { fontFamily: "'Courier New', monospace" };

// ── Demo property targets — clearly tagged as demo in the grid header.
// Replace via backend hook when the roof-intelligence service ships.
const DEMO_TARGETS = [
  { id: "p1", address: "4521 Palm Creek Dr",   city: "Miami",     state: "FL", score: 94, hailStrikes: 7, roofAge: 18, replacement: 24800, status: "TARGETED",   confidence: 92 },
  { id: "p2", address: "2200 S Colorado Blvd",  city: "Denver",    state: "CO", score: 89, hailStrikes: 12, roofAge: 14, replacement: 19400, status: "QUALIFIED",  confidence: 87 },
  { id: "p3", address: "7744 E Camelback Rd",   city: "Phoenix",   state: "AZ", score: 86, hailStrikes: 4, roofAge: 22, replacement: 21600, status: "SCANNED",    confidence: 84 },
  { id: "p4", address: "1200 Peachtree Industrial", city: "Atlanta", state: "GA", score: 82, hailStrikes: 8, roofAge: 16, replacement: 32100, status: "QUALIFIED",  confidence: 81 },
  { id: "p5", address: "889 Westpark Blvd",     city: "Houston",   state: "TX", score: 78, hailStrikes: 9, roofAge: 12, replacement: 17800, status: "SCANNED",    confidence: 79 },
  { id: "p6", address: "15602 Ventura Blvd",    city: "Los Angeles", state: "CA", score: 71, hailStrikes: 2, roofAge: 24, replacement: 28900, status: "NEW",        confidence: 73 },
];

// Status → color encoding for property targets.
const STATUS_META = {
  TARGETED:  { color: COPPER, glow: true,  description: "Operator-locked target" },
  QUALIFIED: { color: GREEN,  glow: false, description: "Passed AI thresholds" },
  SCANNED:   { color: BLUE,   glow: false, description: "Initial intelligence scan complete" },
  NEW:       { color: GOLD,   glow: false, description: "Awaiting analysis" },
};

// Intelligence feed catalog — what Roof Intel surfaces.
const FEEDS = [
  { id: "hail",     icon: "🧊", label: "Hail Strike History",     status: "ONLINE",  color: GREEN  },
  { id: "age",      icon: "📅", label: "Roof Age Estimation",     status: "ONLINE",  color: GREEN  },
  { id: "value",    icon: "💰", label: "Replacement Cost Model",  status: "ONLINE",  color: GREEN  },
  { id: "imagery",  icon: "🛰️", label: "Satellite Imagery",        status: "SYNCING", color: BLUE   },
  { id: "material", icon: "🏗️", label: "Material Detection",       status: "ONLINE",  color: GREEN  },
  { id: "damage",   icon: "⚠️", label: "Damage Probability",       status: "ONLINE",  color: GREEN  },
];

// ── Operational Status tile (mirrors StormAlerts pattern) ────────────
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
        background: color, boxShadow: `0 0 8px ${color}aa`, pointerEvents: "none",
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
        textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
        marginBottom: 4,
      }}>
        {pulse && (
          <span style={{
            width: 5, height: 5, borderRadius: 3,
            background: color, boxShadow: `0 0 6px ${color}aa`,
            animation: "roofPulse 1.6s ease-in-out infinite",
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
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 3,
        background: color, boxShadow: `0 0 6px ${color}cc`,
        display: "inline-block",
      }} />
      <span style={{
        ...mono, fontSize: 11, color: "rgba(255,255,255,0.78)",
        fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase",
      }}>{label}</span>
      <span style={{
        flex: 1, height: 1,
        background: `linear-gradient(90deg, ${color}28 0%, rgba(255,255,255,0.04) 60%, transparent 100%)`,
      }} />
      {right}
    </div>
  );
}

// ── Satellite Console — hero panel ───────────────────────────────────
function SatelliteConsole({ scanning, onScan, address, setAddress, targets = [], activeId = null, error = null }) {
  // Static parcel-cluster dot positions for the scan canvas. Aesthetic
  // arrangement that suggests a built-up urban grid; replaced by real
  // parcel clustering when the backend ships.
  const PARCELS = useMemo(() => [
    [22, 30], [27, 32], [32, 28], [37, 35], [42, 30],
    [25, 45], [33, 47], [40, 43], [48, 49], [55, 45],
    [30, 60], [38, 62], [46, 58], [54, 64], [62, 60],
    [35, 75], [44, 73], [52, 78], [60, 74], [68, 72],
    [45, 88], [55, 90], [65, 86],
  ], []);
  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
      border: `1px solid ${COPPER}26`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 6px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 26px ${COPPER}10`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: COPPER, boxShadow: `0 0 10px ${COPPER}aa`, pointerEvents: "none",
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
          background: COPPER, boxShadow: `0 0 6px ${COPPER}cc`,
          animation: "roofPulse 1.6s ease-in-out infinite",
        }} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          Satellite Console
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, ...mono, fontWeight: 800, letterSpacing: 1.5, color: scanning ? COPPER : GREEN, padding: "2px 8px", background: scanning ? `${COPPER}10` : `${GREEN}10`, border: `1px solid ${scanning ? `${COPPER}40` : `${GREEN}40`}`, borderRadius: 3, textTransform: "uppercase" }}>
          <span style={{ width: 4, height: 4, borderRadius: 2, background: scanning ? COPPER : GREEN, boxShadow: `0 0 5px ${scanning ? COPPER : GREEN}`, animation: "roofPulse 1.6s ease-in-out infinite" }} />
          {scanning ? "Scanning · Active" : "Standby · Ready"}
        </span>
      </div>
      {/* Body — split: lookup form left, scan canvas right */}
      <div style={{
        display: "grid", gridTemplateColumns: "300px 1fr",
        minHeight: 360,
      }}>
        {/* Lookup form — left rail */}
        <div style={{
          padding: "20px 18px",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.012)",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div>
            <div style={{
              ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
              color: "rgba(255,255,255,0.55)", textTransform: "uppercase",
              marginBottom: 6, display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: COPPER, boxShadow: `0 0 5px ${COPPER}` }} />
              Property Lookup
            </div>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Enter address or APN"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${COPPER}30`,
                borderRadius: 6,
                color: "#fff",
                fontSize: 12,
                ...mono, letterSpacing: 0.4,
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.18s, box-shadow 0.18s",
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = `${COPPER}80`;
                e.currentTarget.style.boxShadow = `0 0 14px ${COPPER}30`;
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = `${COPPER}30`;
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          <button
            onClick={() => onScan(address)}
            disabled={scanning || !address.trim()}
            onMouseEnter={(scanning || !address.trim()) ? undefined : (e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = `0 6px 18px rgba(0,0,0,0.40), 0 0 22px ${COPPER}45`;
            }}
            onMouseLeave={(scanning || !address.trim()) ? undefined : (e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = `0 0 16px ${COPPER}25, inset 0 1px 0 rgba(255,255,255,0.06)`;
            }}
            style={{
              padding: "10px 14px",
              background: scanning ? `${COPPER}30` : !address.trim() ? "rgba(255,255,255,0.05)" : `${COPPER}18`,
              border: `1px solid ${!address.trim() ? "rgba(255,255,255,0.10)" : `${COPPER}55`}`,
              borderRadius: 6,
              color: !address.trim() ? "rgba(255,255,255,0.35)" : COPPER,
              fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
              textTransform: "uppercase",
              cursor: (scanning || !address.trim()) ? "default" : "pointer",
              ...mono,
              transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
              boxShadow: !address.trim() ? "none" : `0 0 16px ${COPPER}25, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            {scanning ? "● Scanning Region…" : "Analyze Roof Intelligence"}
          </button>
          {/* Capability summary */}
          <div style={{
            marginTop: 6, padding: "10px 12px",
            background: "rgba(0,0,0,0.20)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6,
            ...mono, fontSize: 10, color: "rgba(255,255,255,0.55)",
            lineHeight: 1.7, letterSpacing: 0.3,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: GREEN, boxShadow: `0 0 4px ${GREEN}` }} />
              <span style={{ color: "rgba(255,255,255,0.78)", fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", fontSize: 9 }}>Capability</span>
            </div>
            Hail history, roof age, replacement cost, and damage probability surfaced from satellite imagery + parcel records.
          </div>
          <div style={{
            display: "inline-flex", alignSelf: "flex-start",
            alignItems: "center", gap: 5,
            fontSize: 8, fontWeight: 800, letterSpacing: 1.6,
            color: GOLD, ...mono, textTransform: "uppercase",
            padding: "2px 7px",
            background: `${GOLD}10`,
            border: `1px solid ${GOLD}38`,
            borderRadius: 3,
          }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: GOLD, boxShadow: `0 0 4px ${GOLD}` }} />
            Local Intel · Backend Pending
          </div>
          {error && (
            <div style={{
              padding: "8px 10px",
              background: `${RED}10`,
              border: `1px solid ${RED}40`,
              borderRadius: 6,
              ...mono, fontSize: 10, color: RED,
              letterSpacing: 0.6, lineHeight: 1.5,
            }}>
              ✗ {error}
            </div>
          )}
        </div>
        {/* Scan canvas — right side */}
        <div style={{
          position: "relative",
          background: "radial-gradient(ellipse at center, rgba(255,109,0,0.06) 0%, rgba(0,0,0,0.30) 60%, rgba(0,0,0,0.45) 100%)",
          overflow: "hidden",
        }}>
          {/* Grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `
              linear-gradient(0deg, rgba(255,109,0,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,109,0,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
            pointerEvents: "none",
          }} />
          {/* Crosshairs */}
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "rgba(255,109,0,0.10)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "rgba(255,109,0,0.10)" }} />
          {/* Concentric reticle */}
          {[120, 200, 280].map((s, i) => (
            <div key={i} style={{
              position: "absolute", left: "50%", top: "50%",
              transform: "translate(-50%, -50%)",
              width: s, height: s, borderRadius: "50%",
              border: `1px solid ${COPPER}${i === 0 ? "30" : i === 1 ? "18" : "0c"}`,
              pointerEvents: "none",
            }} />
          ))}
          {/* Center reticle marker */}
          <div style={{
            position: "absolute", left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            width: 14, height: 14, borderRadius: "50%",
            border: `1.5px solid ${COPPER}`,
            boxShadow: `0 0 12px ${COPPER}aa, inset 0 0 6px ${COPPER}40`,
            pointerEvents: "none",
          }} />
          {/* Vertical sweep line (only when scanning) */}
          {scanning && (
            <div style={{
              position: "absolute",
              top: 0, bottom: 0, width: 2,
              background: `linear-gradient(180deg, transparent 0%, ${COPPER} 50%, transparent 100%)`,
              boxShadow: `0 0 16px ${COPPER}aa`,
              animation: "roofScan 2.6s linear infinite",
              pointerEvents: "none",
            }} />
          )}
          {/* Parcel cluster dots — atmospheric backdrop */}
          {PARCELS.map(([x, y], i) => (
            <div key={`p-${i}`} style={{
              position: "absolute",
              left: `${x}%`, top: `${y}%`,
              transform: "translate(-50%, -50%)",
              width: 5, height: 5, borderRadius: "50%",
              background: COPPER,
              boxShadow: `0 0 6px ${COPPER}aa`,
              opacity: 0.30,
              pointerEvents: "none",
            }} />
          ))}
          {/* Live target overlays — score-encoded dots positioned at the
              intel result's canvas coords. Active scan target gets a
              prominent glowing reticle. */}
          {targets.map(t => {
            const cx = t.canvas?.x ?? 50;
            const cy = t.canvas?.y ?? 50;
            const score = t.scoring?.opportunity_score ?? 0;
            const dotColor = score >= 90 ? COPPER : score >= 80 ? GOLD : score >= 70 ? GREEN : BLUE;
            const isActive = t.id === activeId;
            return (
              <div key={`t-${t.id}`} style={{
                position: "absolute",
                left: `${cx}%`, top: `${cy}%`,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                zIndex: 2,
              }}>
                <span style={{
                  width: isActive ? 14 : 9, height: isActive ? 14 : 9,
                  borderRadius: "50%",
                  background: dotColor,
                  border: isActive ? `2px solid ${dotColor}` : "none",
                  boxShadow: isActive
                    ? `0 0 18px ${dotColor}, 0 0 32px ${dotColor}80, inset 0 0 6px rgba(255,255,255,0.30)`
                    : `0 0 10px ${dotColor}, 0 0 18px ${dotColor}66`,
                  animation: isActive ? "roofPulse 1.4s ease-in-out infinite" : "none",
                }} />
                <span style={{
                  ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                  color: dotColor, textShadow: `0 0 6px ${dotColor}aa`,
                }}>
                  {score}
                </span>
              </div>
            );
          })}
          {/* Standby caption (when idle) */}
          {!scanning && (
            <div style={{
              position: "absolute", left: "50%", bottom: 16,
              transform: "translateX(-50%)",
              ...mono, fontSize: 9, color: "rgba(255,255,255,0.40)",
              letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 800,
              padding: "3px 10px",
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 3,
            }}>
              Reticle locked · Awaiting target
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Confidence ring (radial visual) ──────────────────────────────────
function ConfidenceRing({ value, color }) {
  // Render a circular gauge using conic-gradient. Cheap, no SVG.
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
      }}>
        {safe}
      </div>
    </div>
  );
}

// ── Roof target card — tactical intel panel ──────────────────────────
function RoofTargetCard({ t }) {
  const meta = STATUS_META[t.status] || STATUS_META.NEW;
  const scoreColor = t.score >= 90 ? COPPER : t.score >= 80 ? GOLD : t.score >= 70 ? GREEN : BLUE;
  const fmt$ = v => `$${(v / 1000).toFixed(1)}k`;
  return (
    <div style={{
      position: "relative",
      padding: 0,
      background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
      border: `1px solid ${scoreColor}30`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 6px 18px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px ${scoreColor}14`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: scoreColor, boxShadow: `0 0 10px ${scoreColor}aa`, pointerEvents: "none",
        animation: meta.glow ? "roofEdge 2.4s ease-in-out infinite" : "none",
      }} />
      {/* Satellite tile placeholder — atmospheric, replace with real
          imagery when available. */}
      <div style={{
        position: "relative",
        height: 92,
        background: `linear-gradient(135deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.20) 50%, rgba(255,109,0,0.10) 100%)`,
        overflow: "hidden",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Pseudo grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(0deg, rgba(255,109,0,0.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,109,0,0.10) 1px, transparent 1px)
          `,
          backgroundSize: "16px 16px",
          opacity: 0.6,
          pointerEvents: "none",
        }} />
        {/* Center reticle */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          width: 36, height: 36, borderRadius: "50%",
          border: `1.5px solid ${scoreColor}`,
          boxShadow: `0 0 14px ${scoreColor}80, inset 0 0 8px ${scoreColor}40`,
        }} />
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          width: 4, height: 4, borderRadius: 2,
          background: scoreColor,
          boxShadow: `0 0 8px ${scoreColor}`,
          animation: meta.glow ? "roofPulse 1.5s ease-in-out infinite" : "none",
        }} />
        {/* Status chip top-right */}
        <div style={{
          position: "absolute", top: 8, right: 8,
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "2px 8px",
          background: `${meta.color}1f`,
          border: `1px solid ${meta.color}55`,
          borderRadius: 3,
          fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          color: meta.color, ...mono,
          boxShadow: meta.glow ? `0 0 10px ${meta.color}40` : "none",
        }}>
          {meta.glow && (
            <span style={{
              width: 4, height: 4, borderRadius: 2, background: meta.color,
              boxShadow: `0 0 4px ${meta.color}`,
              animation: "roofPulse 1.4s ease-in-out infinite",
            }} />
          )}
          {t.status}
        </div>
      </div>
      {/* Body — address + score ring + metrics */}
      <div style={{ padding: "14px 14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <ConfidenceRing value={t.score} color={scoreColor} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              ...mono, fontSize: 13, fontWeight: 800, color: "#fff",
              letterSpacing: 0.3, lineHeight: 1.25,
              textShadow: `0 0 12px ${scoreColor}30`,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {t.address}
            </div>
            <div style={{
              ...mono, fontSize: 10, color: "rgba(255,255,255,0.55)",
              letterSpacing: 1, textTransform: "uppercase", fontWeight: 700,
              marginTop: 4,
            }}>
              {t.city} · {t.state}
            </div>
            <div style={{
              ...mono, fontSize: 9, color: "rgba(255,255,255,0.40)",
              letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700,
              marginTop: 6,
            }}>
              AI Confidence · {t.confidence}%
            </div>
          </div>
        </div>
        {/* Metric grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
          padding: "8px 10px",
          background: "rgba(0,0,0,0.20)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 6,
          marginBottom: 12,
        }}>
          {[
            { k: "HAIL", v: t.hailStrikes, color: t.hailStrikes >= 6 ? RED : t.hailStrikes >= 3 ? GOLD : GREEN, suf: "" },
            { k: "AGE",  v: `${t.roofAge}y`, color: t.roofAge >= 18 ? COPPER : GREEN, suf: "" },
            { k: "VAL",  v: fmt$(t.replacement), color: BLUE, suf: "" },
          ].map(m => (
            <div key={m.k} style={{ textAlign: "center" }}>
              <div style={{
                ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.4,
                color: "rgba(255,255,255,0.40)", textTransform: "uppercase",
                marginBottom: 2,
              }}>{m.k}</div>
              <div style={{
                ...mono, fontSize: 13, fontWeight: 800, color: m.color,
                letterSpacing: 0.2, lineHeight: 1,
                textShadow: `0 0 6px ${m.color}30`,
              }}>{m.v}</div>
            </div>
          ))}
        </div>
        {/* TARGET CTA */}
        <button
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = `0 6px 18px rgba(0,0,0,0.40), 0 0 22px ${COPPER}45`;
            e.currentTarget.style.background = `${COPPER}24`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = `0 0 14px ${COPPER}22, inset 0 1px 0 rgba(255,255,255,0.06)`;
            e.currentTarget.style.background = `${COPPER}14`;
          }}
          style={{
            width: "100%",
            padding: "9px 0",
            background: `${COPPER}14`,
            border: `1px solid ${COPPER}55`,
            borderRadius: 6,
            color: COPPER,
            fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
            textTransform: "uppercase",
            cursor: "pointer", ...mono,
            transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
            boxShadow: `0 0 14px ${COPPER}22, inset 0 1px 0 rgba(255,255,255,0.06)`,
          }}
        >
          ▸ Target Property
        </button>
      </div>
    </div>
  );
}

// ── Live intel target card — for IntelResult shape (real analyses) ───
function IntelTargetCard({ intel, onRemove }) {
  const score = intel.scoring.opportunity_score;
  const conf = intel.scoring.confidence;
  const scoreColor = score >= 90 ? COPPER : score >= 80 ? GOLD : score >= 70 ? GREEN : BLUE;
  const action = intel.recommendation.action;
  const actionColor = action === "TARGET_NOW" ? COPPER : action === "WATCH" ? GOLD : "rgba(255,255,255,0.45)";
  const fmt$ = v => `$${(v / 1000).toFixed(1)}k`;
  return (
    <div style={{
      position: "relative",
      padding: 0,
      background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
      border: `1px solid ${scoreColor}30`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 6px 18px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px ${scoreColor}14`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: scoreColor, boxShadow: `0 0 10px ${scoreColor}aa`, pointerEvents: "none",
        animation: action === "TARGET_NOW" ? "roofEdge 2.4s ease-in-out infinite" : "none",
      }} />
      {/* Status header strip with action chip + remove */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px",
        background: "rgba(255,255,255,0.025)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "2px 8px",
          background: `${actionColor}1f`,
          border: `1px solid ${actionColor}55`,
          borderRadius: 3,
          fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          color: actionColor, ...mono, textTransform: "uppercase",
          boxShadow: action === "TARGET_NOW" ? `0 0 10px ${actionColor}40` : "none",
        }}>
          {action === "TARGET_NOW" && (
            <span style={{
              width: 4, height: 4, borderRadius: 2,
              background: actionColor, boxShadow: `0 0 4px ${actionColor}`,
              animation: "roofPulse 1.4s ease-in-out infinite",
            }} />
          )}
          {action.replace("_", " ")}
        </span>
        <button
          onClick={onRemove}
          aria-label="Remove target"
          style={{
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.40)", fontSize: 12, cursor: "pointer",
            padding: "0 4px", lineHeight: 1, ...mono,
          }}
          onMouseEnter={e => e.currentTarget.style.color = RED}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.40)"}
        >×</button>
      </div>
      {/* Body */}
      <div style={{ padding: "14px 14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <ConfidenceRing value={score} color={scoreColor} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              ...mono, fontSize: 13, fontWeight: 800, color: "#fff",
              letterSpacing: 0.3, lineHeight: 1.25,
              textShadow: `0 0 12px ${scoreColor}30`,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {intel.address}
            </div>
            <div style={{
              ...mono, fontSize: 10, color: "rgba(255,255,255,0.55)",
              letterSpacing: 1, textTransform: "uppercase", fontWeight: 700,
              marginTop: 4,
            }}>
              {intel.city} · {intel.state}
            </div>
            <div style={{
              ...mono, fontSize: 9, color: "rgba(255,255,255,0.40)",
              letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700,
              marginTop: 6,
            }}>
              AI Confidence · {conf}%
            </div>
          </div>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
          padding: "8px 10px",
          background: "rgba(0,0,0,0.20)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 6,
          marginBottom: 12,
        }}>
          {[
            { k: "HAIL", v: intel.hail.events_5yr, color: intel.hail.events_5yr >= 6 ? RED : intel.hail.events_5yr >= 3 ? GOLD : GREEN },
            { k: "AGE",  v: `${intel.roof.age_estimated_years}y`, color: intel.roof.age_estimated_years >= 18 ? COPPER : GREEN },
            { k: "VAL",  v: fmt$(intel.financial.replacement_cost_estimate), color: BLUE },
          ].map(m => (
            <div key={m.k} style={{ textAlign: "center" }}>
              <div style={{
                ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.4,
                color: "rgba(255,255,255,0.40)", textTransform: "uppercase",
                marginBottom: 2,
              }}>{m.k}</div>
              <div style={{
                ...mono, fontSize: 13, fontWeight: 800, color: m.color,
                letterSpacing: 0.2, lineHeight: 1,
                textShadow: `0 0 6px ${m.color}30`,
              }}>{m.v}</div>
            </div>
          ))}
        </div>
        {/* Recommendation reason */}
        <div style={{
          padding: "7px 10px",
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 5,
          ...mono, fontSize: 10, color: "rgba(255,255,255,0.62)",
          lineHeight: 1.5, letterSpacing: 0.2,
        }}>
          <span style={{ color: actionColor, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", fontSize: 9 }}>Recommendation · </span>
          {intel.recommendation.reason}
        </div>
      </div>
    </div>
  );
}

// ── Active Analysis panel — surfaces the latest scan result ───────────
function ActiveAnalysisPanel({ intel, onDismiss, onRemove }) {
  const score = intel.scoring.opportunity_score;
  const scoreColor = score >= 90 ? COPPER : score >= 80 ? GOLD : score >= 70 ? GREEN : BLUE;
  const action = intel.recommendation.action;
  const actionColor = action === "TARGET_NOW" ? COPPER : action === "WATCH" ? GOLD : "rgba(255,255,255,0.45)";
  const fmt$ = v => `$${(v / 1000).toFixed(1)}k`;
  const fmtFull$ = v => `$${v.toLocaleString("en-US")}`;
  const sevColor = (sev) => sev === "extreme" ? RED : sev === "high" ? COPPER : sev === "moderate" ? GOLD : GREEN;
  return (
    <div style={{
      position: "relative",
      marginBottom: 22,
      background: "linear-gradient(180deg, rgba(255,255,255,0.028) 0%, rgba(255,255,255,0.005) 100%)",
      border: `1px solid ${scoreColor}30`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 8px 26px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 26px ${scoreColor}18`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: scoreColor, boxShadow: `0 0 12px ${scoreColor}cc`, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 220, height: 220,
        background: `radial-gradient(circle, ${scoreColor}1c 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
      {/* Header strip */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "rgba(255,255,255,0.025)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        gap: 12, flexWrap: "wrap",
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "3px 9px",
          background: `${scoreColor}14`, border: `1px solid ${scoreColor}45`,
          borderRadius: 3,
          fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
          color: scoreColor, ...mono, textTransform: "uppercase",
          boxShadow: `0 0 10px ${scoreColor}25`,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: 3,
            background: scoreColor, boxShadow: `0 0 6px ${scoreColor}`,
            animation: "roofPulse 1.6s ease-in-out infinite",
          }} />
          Active Analysis · Result Ready
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onRemove}
            onMouseEnter={(e) => { e.currentTarget.style.color = RED; e.currentTarget.style.borderColor = `${RED}55`; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
            style={{
              padding: "5px 11px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 4,
              color: "rgba(255,255,255,0.55)",
              fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
              cursor: "pointer", ...mono, textTransform: "uppercase",
              transition: "all 0.18s",
            }}
          >Discard</button>
          <button
            onClick={onDismiss}
            aria-label="Close"
            style={{
              background: "none", border: "none",
              color: "rgba(255,255,255,0.55)",
              fontSize: 16, cursor: "pointer", padding: "2px 6px", lineHeight: 1, ...mono,
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#fff"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.55)"}
          >×</button>
        </div>
      </div>
      {/* Body — score gauge + property identity + scoring telemetry + recommendation */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "grid", gridTemplateColumns: "auto 1fr", gap: 18,
        padding: "16px 18px",
      }}>
        {/* Score column */}
        <div style={{
          position: "relative",
          width: 144, height: 144, borderRadius: "50%",
          background: `conic-gradient(${scoreColor} ${score * 3.6}deg, rgba(255,255,255,0.06) 0)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 30px ${scoreColor}30`,
          flexShrink: 0,
        }}>
          <div style={{
            position: "absolute", inset: 8, borderRadius: "50%",
            background: "linear-gradient(135deg, #131A2A 0%, #0C1220 100%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 2,
          }}>
            <div style={{
              ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
              color: "rgba(255,255,255,0.50)", textTransform: "uppercase",
            }}>Opportunity</div>
            <div style={{
              ...mono, fontSize: 38, fontWeight: 800, color: scoreColor,
              letterSpacing: -0.5, lineHeight: 1,
              textShadow: `0 0 14px ${scoreColor}66, 0 0 4px ${scoreColor}30`,
            }}>{score}</div>
            <div style={{
              ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
              color: "rgba(255,255,255,0.50)", textTransform: "uppercase",
            }}>{intel.scoring.urgency}</div>
          </div>
        </div>

        {/* Right side: identity + telemetry + recommendation */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{
              ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
              color: "rgba(255,255,255,0.55)", textTransform: "uppercase",
              marginBottom: 4, display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{
                width: 4, height: 4, borderRadius: 2,
                background: scoreColor, boxShadow: `0 0 4px ${scoreColor}`,
              }} />
              Property · Parcel {intel.parcel.parcel_id}
            </div>
            <div style={{
              ...mono, fontSize: 16, fontWeight: 800, color: "#fff",
              letterSpacing: 0.3, lineHeight: 1.25,
              textShadow: `0 0 12px ${scoreColor}28`,
            }}>
              {intel.address}
            </div>
            <div style={{
              ...mono, fontSize: 10, color: "rgba(255,255,255,0.55)",
              letterSpacing: 1, textTransform: "uppercase", fontWeight: 700,
              marginTop: 3,
            }}>
              {intel.city} · {intel.state} {intel.zip}
            </div>
          </div>

          {/* Telemetry grid — 4-stat row */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
          }}>
            {[
              {
                label: "Hail · 5yr",
                value: intel.hail.events_5yr,
                sub: intel.hail.max_severity.toUpperCase(),
                color: sevColor(intel.hail.max_severity),
              },
              {
                label: "Roof Age",
                value: `${intel.roof.age_estimated_years}y`,
                sub: intel.roof.condition_estimate.toUpperCase(),
                color: intel.roof.age_estimated_years >= 20 ? COPPER : intel.roof.age_estimated_years >= 12 ? GOLD : GREEN,
              },
              {
                label: "Storm Overlap",
                value: `${intel.storm.overlap_score}%`,
                sub: `${intel.storm.major_events_5yr} EVENTS`,
                color: intel.storm.overlap_score >= 60 ? RED : intel.storm.overlap_score >= 30 ? COPPER : GREEN,
              },
              {
                label: "Replacement",
                value: fmt$(intel.financial.replacement_cost_estimate),
                sub: `${fmt$(intel.financial.claim_potential_low)}–${fmt$(intel.financial.claim_potential_high)}`,
                color: BLUE,
              },
            ].map(m => (
              <div key={m.label} style={{
                position: "relative",
                padding: "8px 10px",
                background: `${m.color}10`,
                border: `1px solid ${m.color}30`,
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)`,
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 1.5,
                  background: m.color, boxShadow: `0 0 5px ${m.color}aa`, pointerEvents: "none",
                }} />
                <div style={{
                  ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.4,
                  color: "rgba(255,255,255,0.40)", textTransform: "uppercase",
                  marginBottom: 2,
                }}>{m.label}</div>
                <div style={{
                  ...mono, fontSize: 14, fontWeight: 800, color: m.color,
                  letterSpacing: 0.2, lineHeight: 1,
                  textShadow: `0 0 6px ${m.color}30`,
                }}>{m.value}</div>
                <div style={{
                  ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.2,
                  color: "rgba(255,255,255,0.40)", textTransform: "uppercase",
                  marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Claim Likelihood + Confidence — secondary scoring telemetry */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
            ...mono, fontSize: 10, color: "rgba(255,255,255,0.55)",
            letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
            paddingTop: 4,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: scoreColor, boxShadow: `0 0 4px ${scoreColor}` }} />
              Claim Likelihood · <span style={{ color: scoreColor, marginLeft: 2, fontWeight: 800, letterSpacing: 0.3 }}>{intel.scoring.claim_likelihood}%</span>
            </span>
            <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: BLUE, boxShadow: `0 0 4px ${BLUE}` }} />
              AI Confidence · <span style={{ color: "#fff", marginLeft: 2, fontWeight: 800, letterSpacing: 0.3 }}>{intel.scoring.confidence}%</span>
            </span>
            <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: GREEN, boxShadow: `0 0 4px ${GREEN}` }} />
              Replacement · <span style={{ color: "#fff", marginLeft: 2, fontWeight: 800, letterSpacing: 0.3 }}>{fmtFull$(intel.financial.replacement_cost_estimate)}</span>
            </span>
          </div>

          {/* Recommendation block */}
          <div style={{
            position: "relative",
            padding: "10px 12px",
            background: `linear-gradient(135deg, ${actionColor}14 0%, ${actionColor}03 100%)`,
            border: `1px solid ${actionColor}45`,
            borderRadius: 6,
            overflow: "hidden",
            boxShadow: `0 0 14px ${actionColor}1a`,
          }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
              background: actionColor, boxShadow: `0 0 6px ${actionColor}aa`,
              animation: action === "TARGET_NOW" ? "roofEdge 2.4s ease-in-out infinite" : "none",
            }} />
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              ...mono, fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
              color: actionColor, textTransform: "uppercase",
              marginBottom: 4, paddingLeft: 8,
            }}>
              {action === "TARGET_NOW" && (
                <span style={{
                  width: 5, height: 5, borderRadius: 3,
                  background: actionColor, boxShadow: `0 0 5px ${actionColor}`,
                  animation: "roofPulse 1.4s ease-in-out infinite",
                }} />
              )}
              Recommendation · {action.replace("_", " ")}
            </div>
            <div style={{
              ...mono, fontSize: 12, color: "rgba(255,255,255,0.85)",
              letterSpacing: 0.2, lineHeight: 1.55, paddingLeft: 8,
            }}>
              {intel.recommendation.reason}
            </div>
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
        <span style={{
          ...mono, fontSize: 11, fontWeight: 800, color: "#fff",
          letterSpacing: 0.5, textTransform: "uppercase",
        }}>{feed.label}</span>
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
          animation: (isOnline || isSyncing) ? "roofPulse 1.6s ease-in-out infinite" : "none",
        }} />
        {feed.status}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export default function RoofIntel() {
  const [address, setAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [lastAnalysis, setLastAnalysis] = useState(null);    // most recent IntelResult
  const [targets, setTargets] = useState(() => loadTargets()); // persisted IntelResult[]
  const [tick, setTick] = useState(0);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  void tick;

  async function startScan(addr) {
    if (!addr.trim() || scanning) return;
    setScanning(true);
    setScanError(null);
    try {
      const result = await analyzeAddress(addr);
      setLastAnalysis(result);
      setTargets(saveTarget(result));
      setAddress("");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[RoofIntel] analyzeAddress failed:", e);
      setScanError(e?.message || "Analysis failed.");
    } finally {
      setScanning(false);
    }
  }

  function dismissTarget(id) {
    setTargets(removeTarget(id));
    if (lastAnalysis?.id === id) setLastAnalysis(null);
  }

  // Real intel takes precedence over demo data once the operator has
  // analyzed at least one address.
  const hasLiveTargets = targets.length > 0;
  const displayTargets = hasLiveTargets ? targets : null;

  const metrics = useMemo(() => {
    if (hasLiveTargets) {
      const high = targets.filter(t => t.scoring.opportunity_score >= 85).length;
      const avg = Math.round(
        targets.reduce((s, t) => s + t.scoring.opportunity_score, 0) / targets.length
      );
      return { analyzed: targets.length, high, avg };
    }
    const high = DEMO_TARGETS.filter(t => t.score >= 85).length;
    const avg = Math.round(
      DEMO_TARGETS.reduce((s, t) => s + t.score, 0) / DEMO_TARGETS.length
    );
    return { analyzed: DEMO_TARGETS.length, high, avg };
  }, [hasLiveTargets, targets]);

  const minutesSinceCheck = Math.floor((Date.now() - mountedAt.current) / 60000);

  return (
    <div style={{ maxWidth: 1200 }}>
      <style>{`
        @keyframes roofPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.82); }
        }
        @keyframes roofEdge {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes roofScan {
          0% { left: -2px; }
          100% { left: 100%; }
        }
      `}</style>

      <PageHeader
        title="Roof Intel"
        subtitle="Satellite-driven property intelligence — hail strike history, roof age estimation, replacement cost modeling, AI opportunity scoring."
        kicker="Targeting Ops"
        accent={COPPER}
      />

      {/* Operational Status strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        marginBottom: 22,
      }}>
        <StatusTile
          label="Properties Analyzed"
          value={metrics.analyzed}
          sub="Sample dataset"
          color={COPPER}
          pulse
        />
        <StatusTile
          label="High-Value Targets"
          value={metrics.high}
          sub="Score ≥ 85"
          color={metrics.high > 0 ? GREEN : GOLD}
          pulse={metrics.high > 0}
        />
        <StatusTile
          label="Avg Opportunity Score"
          value={metrics.avg}
          sub="0–100 AI scale"
          color={GOLD}
        />
        <StatusTile
          label="Intelligence Feeds"
          value={`${FEEDS.filter(f => f.status === "ONLINE").length}/${FEEDS.length}`}
          sub="Live data sources"
          color={GREEN}
          pulse
        />
      </div>

      {/* Satellite Console — hero panel with live target overlay */}
      <div style={{ marginBottom: 22 }}>
        <SatelliteConsole
          scanning={scanning}
          onScan={startScan}
          address={address}
          setAddress={setAddress}
          targets={targets}
          activeId={lastAnalysis?.id || null}
          error={scanError}
        />
      </div>

      {/* Active Analysis — surfaced when a real scan completes. Operator
          sees the full intel result before continuing to the targeting grid. */}
      {lastAnalysis && (
        <ActiveAnalysisPanel
          intel={lastAnalysis}
          onDismiss={() => setLastAnalysis(null)}
          onRemove={() => dismissTarget(lastAnalysis.id)}
        />
      )}

      {/* Operational Targeting Grid — switches between live targets and
          sample data depending on whether the operator has analyzed any
          properties yet. */}
      <SectionStrip
        label={hasLiveTargets
          ? `Live Targets · ${targets.length}`
          : `Operational Targets · ${DEMO_TARGETS.length}`}
        color={COPPER}
        right={
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: hasLiveTargets ? GREEN : GOLD,
            padding: "2px 8px",
            background: `${hasLiveTargets ? GREEN : GOLD}10`,
            border: `1px solid ${hasLiveTargets ? GREEN : GOLD}38`,
            borderRadius: 3, textTransform: "uppercase",
          }}>
            <span style={{
              width: 4, height: 4, borderRadius: 2,
              background: hasLiveTargets ? GREEN : GOLD,
              boxShadow: `0 0 4px ${hasLiveTargets ? GREEN : GOLD}`,
              animation: hasLiveTargets ? "roofPulse 1.6s ease-in-out infinite" : "none",
            }} />
            {hasLiveTargets ? "Live · Persisted" : "Demo Mode · Sample Targets"}
          </span>
        }
      />

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14,
        marginBottom: 24,
      }}>
        {hasLiveTargets
          ? targets.map(t => <IntelTargetCard key={t.id} intel={t} onRemove={() => dismissTarget(t.id)} />)
          : DEMO_TARGETS.map(t => <RoofTargetCard key={t.id} t={t} />)
        }
      </div>

      {/* Intelligence Layers panel */}
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
            background: COPPER, boxShadow: `0 0 6px ${COPPER}`,
            animation: "roofPulse 1.6s ease-in-out infinite",
          }} />
          Targeting System Online
        </span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>Satellite Feed Streaming</span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>Last Sync: {minutesSinceCheck === 0 ? "just now" : `${minutesSinceCheck}m ago`}</span>
        <span style={{
          marginLeft: "auto",
          display: "inline-flex", alignItems: "center", gap: 6,
          color: PURPLE, padding: "2px 8px",
          background: `${PURPLE}10`, border: `1px solid ${PURPLE}38`, borderRadius: 3,
        }}>
          UPA Intelligence Network
        </span>
      </div>
    </div>
  );
}
