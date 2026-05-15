import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./shared/PageHeader";
import PreviewDataBanner from "./PreviewDataBanner";
import GeneratedLeadsPanel from "./shared/GeneratedLeadsPanel";
import { apiJson } from "../lib/api";
import { loadTargets as loadRoofTargets } from "./services/roofIntel";
import { fetchActiveEvents as fetchStormEvents } from "./services/stormIntel";
import { fetchActiveIncidents as fetchCrimeIncidents } from "./services/crimeIntel";
import {
  aggregateUnifiedTargets,
  aggregateNetworkMetrics,
  SOURCE_COLOR,
  SOURCE_LABEL,
  RECOMMENDATION_COLOR,
} from "./services/intelligenceFusion";
import {
  convertUnifiedTarget,
  saveLead,
  isAlreadyConverted,
  describeConversion,
  loadLeads,
} from "./services/leadConversion";
import {
  recordScan,
  getMemoryAnnotations,
  getSignalLearnings,
  getOperatorEffectiveness,
  getNetworkSnapshot,
  _exportMemoryRaw,
} from "./services/intelligenceMemory";

/**
 * UnifiedOps — Opportunity Network surface.
 *
 * The flagship cross-module intelligence feed. Fuses roof, storm,
 * crime and fire signals into a single ranked opportunity list. This
 * surface is the operator's "I see what competitors don't" view —
 * everything below it is module-specific drilldown.
 *
 * Existing module UIs are preserved; this only adds a new aggregate
 * route. If any source feed fails (e.g. fire backend offline), we
 * still render the surface using the available signals — graceful
 * degradation matters more than completeness here.
 */

const RED    = "#E05050";
const COPPER = "#FF6D00";
const GOLD   = "#C9A84C";
const GREEN  = "#00E6A8";
const BLUE   = "#3B82F6";
const PURPLE = "#A855F7";
const INNER_GOLD = "#D4A853";
const mono = { fontFamily: "'Courier New', monospace" };

// Optional: load fire incidents from the RIN backend if reachable.
// Wrapped in try/catch — backend offline must not break the whole feed.
async function fetchFireIncidentsSafe() {
  try {
    const r = await apiJson("/fire-incidents?size=50");
    return Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
  } catch {
    // backend unreachable / not authed → silent fallthrough
    return [];
  }
}

function urgencyColor(u) {
  return u === "critical" ? RED
       : u === "high"     ? COPPER
       : u === "medium"   ? GOLD
       : "rgba(255,255,255,0.55)";
}

// ── KPI tile — matches the operational status tiles used elsewhere. ──
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
            animation: "uoPulse 1.6s ease-in-out infinite",
          }} />
        )}
        {label}
      </div>
      <div style={{
        position: "relative", zIndex: 1,
        ...mono, fontSize: 24, fontWeight: 800, color: "#fff",
        letterSpacing: -0.2, lineHeight: 1.05,
        textShadow: `0 0 12px ${color}40`,
      }}>{value}</div>
      <div style={{
        position: "relative", zIndex: 1,
        marginTop: 2, ...mono, fontSize: 9, fontWeight: 700,
        letterSpacing: 0.7, color: "rgba(255,255,255,0.45)",
      }}>{sub}</div>
    </div>
  );
}

// ── Section strip — same cinematic header as the other intel modules.
function SectionStrip({ label, color = GREEN, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 3,
        background: color, boxShadow: `0 0 6px ${color}cc`,
      }} />
      <span style={{
        ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.8,
        color: "rgba(255,255,255,0.85)", textTransform: "uppercase",
      }}>{label}</span>
      <span style={{
        flex: 1, height: 1,
        background: `linear-gradient(90deg, ${color}28 0%, rgba(255,255,255,0.04) 60%, transparent 100%)`,
      }} />
      {right}
    </div>
  );
}

// ── Source-signal chip ──────────────────────────────────────────────
//
// The "[STORM] [ROOF] [CRIME] [FIRE]" tag row that makes multi-signal
// convergence visible at a glance. Promoted (state-level) signals are
// rendered slightly dimmed so the operator can see which signals are
// hyper-local vs broadcast.
function SignalChip({ src, strength, promoted }) {
  const color = SOURCE_COLOR[src] || GREEN;
  const label = SOURCE_LABEL[src] || src;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px",
      background: promoted ? `${color}10` : `${color}1f`,
      border: `1px solid ${color}${promoted ? "33" : "55"}`,
      borderRadius: 3,
      ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
      color, textTransform: "uppercase",
      opacity: promoted ? 0.78 : 1,
      boxShadow: promoted ? "none" : `0 0 8px ${color}26`,
    }}>
      <span style={{
        width: 4, height: 4, borderRadius: 2,
        background: color, boxShadow: `0 0 4px ${color}`,
      }} />
      {label}{strength >= 75 ? " ●" : ""}
    </span>
  );
}

// ── Unified opportunity card ─────────────────────────────────────────
//
// One per ranked region. Lead-with-score gauge pattern matches the
// ActiveAnalysisPanel from RoofIntel so the language stays coherent
// across surfaces.
function OpportunityCard({ target, onConvert, alreadyConverted, annotation }) {
  const score = target.opportunityScore;
  const u = target.urgency;
  const uColor = urgencyColor(u);
  const action = target.recommendation.action;
  const actionColor = RECOMMENDATION_COLOR[action] || GOLD;
  const isPulse = ["TARGET_NOW", "SURGE_ZONE", "DEPLOY"].includes(action);
  const ageStr = target.most_recent_hours == null ? "—"
    : target.most_recent_hours <= 0 ? "just now"
    : target.most_recent_hours < 1 ? "<1h ago"
    : `${target.most_recent_hours}h ago`;

  return (
    <div style={{
      position: "relative",
      padding: 0,
      background: `linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)`,
      border: `1px solid ${uColor}30`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 6px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 22px ${uColor}14`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: uColor, boxShadow: `0 0 10px ${uColor}aa`, pointerEvents: "none",
        animation: isPulse ? "uoEdge 2.4s ease-in-out infinite" : "none",
      }} />
      <div style={{
        position: "absolute", top: -50, right: -50,
        width: 180, height: 180,
        background: `radial-gradient(circle, ${uColor}1c 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      {/* Header strip — region label + recommendation pill + age */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", gap: 10, flexWrap: "wrap",
        background: "rgba(255,255,255,0.025)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{
            ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
            color: "rgba(255,255,255,0.55)", textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              width: 4, height: 4, borderRadius: 2,
              background: uColor, boxShadow: `0 0 4px ${uColor}`,
            }} />
            Opportunity Region
          </span>
          <span style={{
            ...mono, fontSize: 14, fontWeight: 800, color: "#fff",
            letterSpacing: 0.3, lineHeight: 1,
            textShadow: `0 0 10px ${uColor}30`,
          }}>{target.label}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Recommendation pill */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "2px 8px",
            background: `${actionColor}1f`,
            border: `1px solid ${actionColor}55`,
            borderRadius: 3,
            ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: actionColor, textTransform: "uppercase",
            boxShadow: isPulse ? `0 0 10px ${actionColor}40` : "none",
          }}>
            {isPulse && (
              <span style={{
                width: 4, height: 4, borderRadius: 2,
                background: actionColor, boxShadow: `0 0 4px ${actionColor}`,
                animation: "uoPulse 1.4s ease-in-out infinite",
              }} />
            )}
            {action.replace(/_/g, " ")}
          </span>
          <span style={{
            ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
            color: "rgba(255,255,255,0.45)", textTransform: "uppercase",
          }}>
            Last signal · {ageStr}
          </span>
        </div>
      </div>

      {/* Body — score gauge + signals + reasoning + convert */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "grid", gridTemplateColumns: "auto 1fr",
        gap: 18, padding: "16px 18px",
      }}>
        {/* Score gauge */}
        <div style={{
          position: "relative",
          width: 120, height: 120, borderRadius: "50%",
          background: `conic-gradient(${uColor} ${score * 3.6}deg, rgba(255,255,255,0.06) 0)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 24px ${uColor}30`,
          flexShrink: 0,
        }}>
          <div style={{
            position: "absolute", inset: 7, borderRadius: "50%",
            background: "linear-gradient(135deg, #131A2A 0%, #0C1220 100%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 1,
          }}>
            <div style={{
              ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.4,
              color: "rgba(255,255,255,0.50)", textTransform: "uppercase",
            }}>Opportunity</div>
            <div style={{
              ...mono, fontSize: 32, fontWeight: 800, color: uColor,
              letterSpacing: -0.5, lineHeight: 1,
              textShadow: `0 0 12px ${uColor}66`,
            }}>{score}</div>
            <div style={{
              ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.4,
              color: "rgba(255,255,255,0.50)", textTransform: "uppercase",
            }}>{u}</div>
          </div>
        </div>

        {/* Right column: signals + reasoning + telemetry + convert */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Signals contributing */}
          <div>
            <div style={{
              ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
              color: "rgba(255,255,255,0.55)", textTransform: "uppercase",
              marginBottom: 6, display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{
                width: 4, height: 4, borderRadius: 2,
                background: INNER_GOLD, boxShadow: `0 0 4px ${INNER_GOLD}`,
              }} />
              Signals Contributing · {target.activeSignalCount} active
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {target.sourceSignals.map(s => (
                <SignalChip key={s.source} src={s.source} strength={s.strength} promoted={s.promoted} />
              ))}
            </div>
          </div>

          {/* Reasoning — operator-facing "why" */}
          {target.reasoning.length > 0 && (
            <div style={{
              padding: "8px 12px",
              background: `linear-gradient(135deg, ${actionColor}10 0%, ${actionColor}02 100%)`,
              border: `1px solid ${actionColor}38`,
              borderRadius: 6,
              ...mono, fontSize: 11, color: "rgba(255,255,255,0.78)",
              lineHeight: 1.55, letterSpacing: 0.1,
            }}>
              {target.reasoning.map((line, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  paddingTop: i === 0 ? 0 : 4,
                }}>
                  <span style={{
                    color: actionColor, fontWeight: 800, fontSize: 9, letterSpacing: 1, marginTop: 2,
                  }}>▸</span>
                  <span style={{ flex: 1 }}>{line}</span>
                </div>
              ))}
            </div>
          )}

          {/* Telemetry row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
            ...mono, fontSize: 10, color: "rgba(255,255,255,0.55)",
            letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: BLUE, boxShadow: `0 0 4px ${BLUE}` }} />
              AI Confidence · <span style={{ color: "#fff", marginLeft: 2, fontWeight: 800 }}>{target.confidence}%</span>
            </span>
            {target.population_est > 0 && (
              <>
                <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 4, height: 4, borderRadius: 2, background: GOLD, boxShadow: `0 0 4px ${GOLD}` }} />
                  Pop · <span style={{ color: "#fff", marginLeft: 2, fontWeight: 800 }}>
                    {target.population_est >= 1_000_000 ? (target.population_est / 1_000_000).toFixed(1) + "M"
                    : target.population_est >= 1_000     ? (target.population_est / 1_000).toFixed(0) + "k"
                    : target.population_est}
                  </span>
                </span>
              </>
            )}
            {target.prior_targeting_count > 0 && (
              <>
                <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 4, height: 4, borderRadius: 2, background: PURPLE, boxShadow: `0 0 4px ${PURPLE}` }} />
                  Prior · <span style={{ color: "#fff", marginLeft: 2, fontWeight: 800 }}>{target.prior_targeting_count}</span>
                </span>
              </>
            )}
          </div>

          {/* Memory chip row — only renders when the platform has prior
              context for this target. Stays hidden on first sighting so
              new operators don't see a "Scanned 1×" stub everywhere. */}
          {annotation && (annotation.scanCount > 1 || annotation.priorLeadsInRegion > 0 || annotation.recommendationPath.length > 1) && (
            <MemoryChips annotation={annotation} actionColor={actionColor} />
          )}

          {/* Convert CTA */}
          {action !== "ARCHIVE" && (
            <button
              onClick={() => !alreadyConverted && onConvert(target)}
              disabled={alreadyConverted}
              onMouseEnter={(e) => {
                if (alreadyConverted) return;
                e.currentTarget.style.background = `linear-gradient(135deg, ${INNER_GOLD}48 0%, ${INNER_GOLD}1c 100%)`;
                e.currentTarget.style.boxShadow = `0 0 24px ${INNER_GOLD}66, inset 0 0 0 1px ${INNER_GOLD}aa`;
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                if (alreadyConverted) return;
                e.currentTarget.style.background = `linear-gradient(135deg, ${INNER_GOLD}30 0%, ${INNER_GOLD}10 100%)`;
                e.currentTarget.style.boxShadow = `0 0 16px ${INNER_GOLD}40, inset 0 0 0 1px ${INNER_GOLD}66`;
                e.currentTarget.style.transform = "translateY(0)";
              }}
              style={{
                marginTop: 4,
                padding: "10px 14px",
                background: alreadyConverted
                  ? "rgba(168,85,247,0.10)"
                  : `linear-gradient(135deg, ${INNER_GOLD}30 0%, ${INNER_GOLD}10 100%)`,
                border: `1px solid ${alreadyConverted ? "#A855F766" : INNER_GOLD + "66"}`,
                borderRadius: 6,
                ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.6,
                color: alreadyConverted ? "#A855F7" : INNER_GOLD,
                textTransform: "uppercase",
                cursor: alreadyConverted ? "default" : "pointer",
                boxShadow: alreadyConverted
                  ? "none"
                  : `0 0 16px ${INNER_GOLD}40, inset 0 0 0 1px ${INNER_GOLD}66`,
                transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}>
              {alreadyConverted ? (
                <>
                  <span style={{ width: 5, height: 5, borderRadius: 3, background: "#A855F7", boxShadow: "0 0 6px #A855F7" }} />
                  In Outreach Pipeline
                </>
              ) : (
                <>
                  <span style={{
                    width: 5, height: 5, borderRadius: 3,
                    background: INNER_GOLD, boxShadow: `0 0 6px ${INNER_GOLD}`,
                    animation: isPulse ? "uoPulse 1.4s ease-in-out infinite" : "none",
                  }} />
                  Engage Opportunity · Generate Outreach Lead
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Memory chips — per-target prior-context strip ────────────────────
//
// Renders inline on each opportunity card whenever the platform has
// remembered something useful: a rising score streak, prior leads in
// the region, a recommendation path, or an "ignored" pattern. The
// design rule is "only show a chip if it carries operational signal."
// Empty memory states stay quiet.
function MemoryChips({ annotation, actionColor }) {
  const a = annotation;
  const trendColor = a.scoreTrend === "rising"  ? GREEN
                   : a.scoreTrend === "falling" ? RED
                   : a.scoreTrend === "stable"  ? GOLD
                   : BLUE;
  const trendArrow = a.scoreTrend === "rising"  ? "↑"
                   : a.scoreTrend === "falling" ? "↓"
                   : a.scoreTrend === "stable"  ? "→"
                   : "•";

  return (
    <div style={{
      display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8,
      paddingTop: 4, paddingBottom: 2,
      borderTop: "1px dashed rgba(255,255,255,0.06)",
    }}>
      <span style={{
        ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
        color: "rgba(255,255,255,0.45)", textTransform: "uppercase",
      }}>
        Memory ·
      </span>

      {/* Sparkline + trend chip — only when we have ≥2 datapoints. */}
      {a.scoreSparkline.length >= 2 && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "2px 8px",
          background: `${trendColor}14`,
          border: `1px solid ${trendColor}45`,
          borderRadius: 3,
          ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          color: trendColor, textTransform: "uppercase",
        }}>
          <Sparkline values={a.scoreSparkline} color={trendColor} />
          <span>{trendArrow} {a.scoreTrend === "new" ? "New" : `${a.scoreDelta > 0 ? "+" : ""}${a.scoreDelta}`}</span>
        </span>
      )}

      {/* Consecutive rising streak — high-signal pattern. */}
      {a.consecutiveRising >= 3 && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "2px 8px",
          background: `${GREEN}14`, border: `1px solid ${GREEN}55`,
          borderRadius: 3,
          ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          color: GREEN, textTransform: "uppercase",
          boxShadow: `0 0 8px ${GREEN}30`,
        }}>
          <span style={{
            width: 4, height: 4, borderRadius: 2,
            background: GREEN, boxShadow: `0 0 4px ${GREEN}`,
            animation: "uoPulse 1.4s ease-in-out infinite",
          }} />
          Rising · {a.consecutiveRising} scans
        </span>
      )}

      {/* Recommendation path — only when there's been a transition. */}
      {a.recommendationPath.length > 1 && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "2px 8px",
          background: `${actionColor}14`, border: `1px solid ${actionColor}45`,
          borderRadius: 3,
          ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          color: actionColor, textTransform: "uppercase",
        }}>
          {a.recommendationPath.slice(-3).map(r => r.replace(/_/g, " ")).join(" → ")}
        </span>
      )}

      {/* Returning region indicator. */}
      {a.isReturning && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "2px 8px",
          background: `${PURPLE}14`, border: `1px solid ${PURPLE}45`,
          borderRadius: 3,
          ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          color: PURPLE, textTransform: "uppercase",
        }}>
          Returning · {a.scanCount} scans
        </span>
      )}

      {/* Prior leads converted in the same region — pure operational
          context. "We've already worked this zip" signal. */}
      {a.priorLeadsInRegion > 0 && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "2px 8px",
          background: `${BLUE}14`, border: `1px solid ${BLUE}45`,
          borderRadius: 3,
          ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          color: BLUE, textTransform: "uppercase",
        }}>
          Region · {a.priorLeadsInRegion} prior lead{a.priorLeadsInRegion === 1 ? "" : "s"}
        </span>
      )}

      {/* Ignored heuristic — high score sustained without conversion. */}
      {a.wasIgnored && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "2px 8px",
          background: `${COPPER}14`, border: `1px solid ${COPPER}55`,
          borderRadius: 3,
          ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          color: COPPER, textTransform: "uppercase",
        }}>
          ⚠ Ignored · revisit
        </span>
      )}
    </div>
  );
}

// ── Sparkline — inline mini score-trend chart ───────────────────────
//
// Pure SVG, no dep. ~80×16 box, last N opportunity scores. Renders
// inside the trend chip, so it inherits the chip's color.
function Sparkline({ values, color }) {
  if (!values || values.length < 2) return null;
  const W = 60, H = 14, P = 1;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = P + (i * (W - P * 2)) / (values.length - 1);
    const y = H - P - ((v - min) / span) * (H - P * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
        points={pts.join(" ")}
      />
    </svg>
  );
}

// ── Network Patterns — signal-pair learnings panel ──────────────────
function NetworkPatternsPanel({ insights }) {
  if (!insights || insights.length === 0) return null;
  // Operator-facing rule: only render this section when we have at
  // least one pattern with ≥3 conversions OR ≥5 appearances. Below
  // that threshold the surface is just noise.
  const visible = insights.filter(i => i.appearances >= 5 || i.conversions >= 3);
  if (visible.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: PURPLE, boxShadow: `0 0 6px ${PURPLE}cc` }} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.8, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          Network Patterns · Signal Learning
        </span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${PURPLE}28 0%, rgba(255,255,255,0.04) 60%, transparent 100%)` }} />
        <span style={{
          ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
          color: PURPLE, padding: "2px 8px",
          background: `${PURPLE}10`, border: `1px solid ${PURPLE}38`,
          borderRadius: 3, textTransform: "uppercase",
        }}>
          Engine · Learning
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.slice(0, 6).map(i => {
          const liftColor = i.lift >= 1.5 ? GREEN : i.lift >= 1 ? GOLD : i.lift > 0 ? COPPER : "rgba(255,255,255,0.45)";
          const sources = i.signature.split("+");
          return (
            <div key={i.signature} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto",
              alignItems: "center", gap: 12,
              padding: "10px 14px",
              background: "linear-gradient(135deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
              border: `1px solid ${liftColor}30`,
              borderRadius: 8,
              boxShadow: `0 4px 12px rgba(0,0,0,0.28), 0 0 12px ${liftColor}10`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                {sources.map(src => (
                  <SignalChip key={src} src={src} strength={100} />
                ))}
              </div>
              <div style={{
                ...mono, fontSize: 11, color: "rgba(255,255,255,0.78)",
                letterSpacing: 0.2, lineHeight: 1.5,
              }}>
                {i.message}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.4,
                  color: "rgba(255,255,255,0.40)", textTransform: "uppercase",
                }}>Lift</div>
                <div style={{
                  ...mono, fontSize: 16, fontWeight: 800, color: liftColor,
                  letterSpacing: 0.3, lineHeight: 1,
                  textShadow: `0 0 6px ${liftColor}40`,
                }}>{i.liftLabel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Operator Intelligence — per-operator effectiveness panel ────────
function OperatorIntelligencePanel({ ops }) {
  if (!ops || ops.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: BLUE, boxShadow: `0 0 6px ${BLUE}cc` }} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.8, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          Operator Intelligence
        </span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${BLUE}28 0%, rgba(255,255,255,0.04) 60%, transparent 100%)` }} />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(ops.length, 4)}, 1fr)`,
        gap: 10,
      }}>
        {ops.slice(0, 4).map(op => (
          <div key={op.operatorName} style={{
            position: "relative",
            padding: "12px 14px",
            background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
            border: `1px solid ${BLUE}26`,
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: `0 4px 12px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 12px ${BLUE}10`,
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: BLUE, boxShadow: `0 0 6px ${BLUE}aa`, pointerEvents: "none",
            }} />
            <div style={{
              ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
              color: "rgba(255,255,255,0.55)", textTransform: "uppercase",
              marginBottom: 4,
            }}>
              Operator
            </div>
            <div style={{
              ...mono, fontSize: 13, fontWeight: 800, color: "#fff",
              letterSpacing: 0.3, lineHeight: 1.2, marginBottom: 8,
              textShadow: `0 0 8px ${BLUE}30`,
            }}>
              {op.operatorName}
            </div>
            <div style={{
              ...mono, fontSize: 22, fontWeight: 800, color: BLUE,
              letterSpacing: -0.3, lineHeight: 1,
              textShadow: `0 0 10px ${BLUE}40`,
            }}>{op.leadsAssigned}</div>
            <div style={{
              ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.4,
              color: "rgba(255,255,255,0.45)", textTransform: "uppercase",
              marginTop: 2,
            }}>Leads Assigned</div>
            <div style={{
              marginTop: 8, display: "flex", flexDirection: "column", gap: 3,
              ...mono, fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
              color: "rgba(255,255,255,0.55)",
            }}>
              {op.topRegion && <span>★ Region · {op.topRegion.state} ({op.topRegion.count})</span>}
              {op.topSignal && <span>★ Signal · {op.topSignal.source} ({op.topSignal.count})</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Operational Memory Feed — recent network events ─────────────────
function MemoryFeedPanel({ snapshot }) {
  if (!snapshot || snapshot.events.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: INNER_GOLD, boxShadow: `0 0 6px ${INNER_GOLD}cc`, animation: "uoPulse 1.6s ease-in-out infinite" }} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.8, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          Operational Memory Feed
        </span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${INNER_GOLD}28 0%, rgba(255,255,255,0.04) 60%, transparent 100%)` }} />
        <span style={{
          ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
          color: "rgba(255,255,255,0.65)", padding: "2px 8px",
          background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 3, textTransform: "uppercase",
        }}>
          {snapshot.totalScans} scans · {snapshot.totalRegionsTracked} regions · {snapshot.memoryAgeDays}d memory
        </span>
      </div>
      <div style={{
        padding: "8px 0",
        background: "linear-gradient(180deg, rgba(255,255,255,0.012) 0%, rgba(255,255,255,0.003) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
      }}>
        {snapshot.events.map((e, i) => {
          const t = new Date(e.ts);
          const age = Math.max(0, Math.floor((Date.now() - t.getTime()) / 60000));
          const ageStr = age < 1 ? "just now" : age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
          const meta = describeEvent(e);
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto",
              alignItems: "center", gap: 14,
              padding: "6px 14px",
              borderBottom: i === snapshot.events.length - 1 ? "none" : "1px dashed rgba(255,255,255,0.05)",
            }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "2px 7px",
                background: `${meta.color}1a`,
                border: `1px solid ${meta.color}45`,
                borderRadius: 3,
                ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.3,
                color: meta.color, textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>
                {meta.label}
              </span>
              <span style={{
                ...mono, fontSize: 11, color: "rgba(255,255,255,0.78)",
                letterSpacing: 0.2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {meta.line}
              </span>
              <span style={{
                ...mono, fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                color: "rgba(255,255,255,0.45)", textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>
                {ageStr}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function describeEvent(e) {
  switch (e.kind) {
    case "FIRST_SEEN":
      return { label: "First Seen", color: BLUE, line: `${e.label || e.targetId} · score ${e.score}` };
    case "RECOMMENDATION_CHANGE":
      return { label: "Rec Δ", color: GOLD, line: `${e.targetId} · ${e.from || "—"} → ${e.to}` };
    case "CONVERSION":
      return { label: "Converted", color: GREEN, line: `${e.classification?.replace(/_/g, " ") || "Lead"} · ${e.region || "—"}${e.operator ? ` · ${e.operator}` : ""}` };
    default:
      return { label: e.kind || "Event", color: "rgba(255,255,255,0.55)", line: e.line || JSON.stringify(e).slice(0, 80) };
  }
}

// ── Conversion toast ────────────────────────────────────────────────
function ConversionToast({ feedback, accent = GREEN, onClose }) {
  if (!feedback) return null;
  return (
    <div style={{
      position: "relative",
      marginBottom: 18,
      padding: "12px 16px 12px 18px",
      background: `linear-gradient(135deg, ${accent}1c 0%, rgba(0,0,0,0.20) 100%)`,
      border: `1px solid ${accent}55`,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: `0 6px 20px rgba(0,0,0,0.32), inset 0 0 0 1px ${accent}28, 0 0 22px ${accent}24`,
    }}>
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: accent, boxShadow: `0 0 10px ${accent}cc`,
        animation: "uoEdge 2.4s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: 3,
              background: accent, boxShadow: `0 0 6px ${accent}`,
              animation: "uoPulse 1.6s ease-in-out infinite",
            }} />
            <span style={{
              ...mono, fontSize: 10, fontWeight: 800, letterSpacing: 1.6,
              color: accent, textTransform: "uppercase",
            }}>{feedback.title}</span>
          </div>
          <div style={{
            ...mono, fontSize: 12, color: "rgba(255,255,255,0.80)",
            letterSpacing: 0.2, lineHeight: 1.5,
          }}>{feedback.line}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Dismiss"
            onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
            onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.55)"}
            style={{
              background: "none", border: "none",
              color: "rgba(255,255,255,0.55)",
              fontSize: 16, cursor: "pointer", padding: "2px 6px", lineHeight: 1, ...mono,
              flexShrink: 0,
            }}
          >×</button>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export default function UnifiedOps() {
  const [roofTargets, setRoofTargets] = useState([]);
  const [stormEvents, setStormEvents] = useState([]);
  const [crimeIncidents, setCrimeIncidents] = useState([]);
  const [fireIncidents, setFireIncidents] = useState([]);
  const [priorLeads, setPriorLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conversionFeedback, setConversionFeedback] = useState(null);
  const [pipelineRefresh, setPipelineRefresh] = useState(0);
  const [tick, setTick] = useState(0);
  const mountedAt = useRef(Date.now());
  const feedbackTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [storm, crime, fire] = await Promise.all([
          fetchStormEvents().catch(() => []),
          fetchCrimeIncidents().catch(() => []),
          fetchFireIncidentsSafe(),
        ]);
        if (cancelled) return;
        setStormEvents(Array.isArray(storm) ? storm : []);
        setCrimeIncidents(Array.isArray(crime) ? crime : []);
        setFireIncidents(Array.isArray(fire) ? fire : []);
        setRoofTargets(loadRoofTargets() || []);
        setPriorLeads(loadLeads() || []);
        mountedAt.current = Date.now();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  void tick;

  const targets = useMemo(() => aggregateUnifiedTargets({
    roofTargets, stormEvents, crimeIncidents, fireIncidents, priorLeads,
  }), [roofTargets, stormEvents, crimeIncidents, fireIncidents, priorLeads]);

  const metrics = useMemo(() => aggregateNetworkMetrics(targets), [targets]);
  const minutesSinceCheck = Math.floor((Date.now() - mountedAt.current) / 60000);

  // Memory layer — every fusion run is a "scan" we persist into the
  // memory store. The store dedupes consecutive scans within 60s.
  // After the snapshot we re-read derived insights so the surface
  // reflects the just-recorded data.
  const [memorySnapshot, setMemorySnapshot] = useState(() => _exportMemoryRaw());
  useEffect(() => {
    if (loading) return;
    if (targets.length === 0) {
      setMemorySnapshot(_exportMemoryRaw());
      return;
    }
    recordScan(targets);
    setMemorySnapshot(_exportMemoryRaw());
    // Run after fusion settles. We intentionally exclude pipelineRefresh
    // — conversion already records itself via saveLead → recordConversion.
  }, [targets, loading]);

  const annotationsByTargetId = useMemo(() => {
    const out = {};
    targets.forEach(t => {
      const a = getMemoryAnnotations(t, { memory: memorySnapshot });
      if (a) out[t.id] = a;
    });
    return out;
  }, [targets, memorySnapshot]);

  const signalLearnings    = useMemo(() => getSignalLearnings(),       [memorySnapshot]);
  const operatorEffectiveness = useMemo(() => getOperatorEffectiveness(), [memorySnapshot]);
  const networkSnapshot    = useMemo(() => getNetworkSnapshot(8),      [memorySnapshot]);

  async function handleEngage(target) {
    if (!target) return;
    if (isAlreadyConverted("unified_intel", target.id)) return;
    // Route through the dominant signal's source converter when
    // possible — falls back to a unified region lead otherwise.
    const lead = convertUnifiedTarget(target);
    if (!lead) return;
    await saveLead(lead);
    const desc = describeConversion(lead);
    setConversionFeedback(desc);
    setPriorLeads(loadLeads() || []);
    setPipelineRefresh(x => x + 1);
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setConversionFeedback(null), 6000);
  }

  // The UI marks an opportunity "already converted" if *either* a
  // unified-conversion lead exists for this target id, *or* the
  // dominant-signal source has already been converted by another
  // module. Avoids double-counting across surfaces.
  function isTargetConverted(target) {
    if (isAlreadyConverted("unified_intel", target.id)) return true;
    const dom = target.dominant_signal;
    if (!dom?.raw) return false;
    if (dom.source === "ROOF")  return isAlreadyConverted("roof_intel",  dom.raw.id);
    if (dom.source === "STORM") return isAlreadyConverted("storm_intel", dom.raw.id);
    if (dom.source === "CRIME") return isAlreadyConverted("crime_intel", dom.raw.id);
    return false;
  }

  return (
    <div style={{ maxWidth: 1180 }}>
      <style>{`
        @keyframes uoPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.82); }
        }
        @keyframes uoEdge {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
      `}</style>

      <PreviewDataBanner label="Opportunity feed includes Roof + Crime demo signals — live integration pending" />

      <PageHeader
        title="Opportunity Network"
        subtitle="Unified intelligence — Roof, Storm, Crime and Fire signals fused into a single ranked claim-opportunity feed. Multi-signal convergence wins."
        kicker="Cross-Signal Intelligence"
        accent={INNER_GOLD}
      />

      {conversionFeedback && (
        <ConversionToast feedback={conversionFeedback} accent={GREEN} onClose={() => setConversionFeedback(null)} />
      )}

      {/* KPI strip — composite network metrics */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        marginBottom: 22,
      }}>
        <StatusTile
          label="Opportunity Targets"
          value={loading ? "…" : metrics.total}
          sub={metrics.total === 0 ? "Network quiet" : "Cross-signal feed"}
          color={metrics.total > 0 ? INNER_GOLD : GREEN}
          pulse={metrics.total > 0}
        />
        <StatusTile
          label="Surge Opportunities"
          value={loading ? "…" : metrics.surge}
          sub={metrics.surge > 0 ? "Target / Deploy now" : "No surge activity"}
          color={metrics.surge > 0 ? RED : GREEN}
          pulse={metrics.surge > 0}
        />
        <StatusTile
          label="Multi-Signal Convergence"
          value={loading ? "…" : metrics.multiSig}
          sub={metrics.multiSig > 0 ? "≥3 sources stacked" : "No convergence yet"}
          color={metrics.multiSig > 0 ? COPPER : GREEN}
          pulse={metrics.multiSig > 0}
        />
        <StatusTile
          label="Network Coverage"
          value={loading ? "…" : metrics.statesCovered}
          sub={`Avg score · ${metrics.avgScore} · ${metrics.statesCovered} state${metrics.statesCovered === 1 ? "" : "s"}`}
          color={GOLD}
          pulse={false}
        />
      </div>

      {/* Source feed status row — at-a-glance: which signal feeds are
          contributing right now. Reads as a wiring diagram rather than
          a list so the operator sees the network shape. */}
      <div style={{
        marginBottom: 22, padding: "10px 16px",
        background: "linear-gradient(90deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 50%, rgba(255,255,255,0.025) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        ...mono, fontSize: 10, color: "rgba(255,255,255,0.55)",
        letterSpacing: 1.2, fontWeight: 700, textTransform: "uppercase",
      }}>
        <span style={{
          ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
          color: "rgba(255,255,255,0.85)", textTransform: "uppercase",
        }}>
          Active Sources ·
        </span>
        {[
          { src: "STORM", count: stormEvents.length },
          { src: "ROOF",  count: roofTargets.length },
          { src: "CRIME", count: crimeIncidents.length },
          { src: "FIRE",  count: fireIncidents.length },
        ].map(s => {
          const live = s.count > 0;
          const color = SOURCE_COLOR[s.src];
          return (
            <span key={s.src} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 9px",
              background: live ? `${color}1a` : "rgba(255,255,255,0.025)",
              border: `1px solid ${live ? `${color}55` : "rgba(255,255,255,0.06)"}`,
              borderRadius: 3,
              color: live ? color : "rgba(255,255,255,0.40)",
              ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.3,
              textTransform: "uppercase",
            }}>
              <span style={{
                width: 4, height: 4, borderRadius: 2,
                background: live ? color : "rgba(255,255,255,0.30)",
                boxShadow: live ? `0 0 5px ${color}` : "none",
                animation: live ? "uoPulse 1.6s ease-in-out infinite" : "none",
              }} />
              {SOURCE_LABEL[s.src]} · {s.count}
            </span>
          );
        })}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 4, height: 4, borderRadius: 2,
            background: GREEN, boxShadow: `0 0 5px ${GREEN}`,
            animation: "uoPulse 1.6s ease-in-out infinite",
          }} />
          Fusion Engine · Online
          <span style={{ color: "rgba(255,255,255,0.20)", marginLeft: 6 }}>·</span>
          Last sync · {minutesSinceCheck === 0 ? "just now" : `${minutesSinceCheck}m ago`}
        </span>
      </div>

      {/* Unified opportunity feed */}
      <SectionStrip
        label={`Unified Opportunities${targets.length > 0 ? ` · ${targets.length}` : ""}`}
        color={INNER_GOLD}
        right={
          <span style={{
            ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: COPPER, padding: "2px 8px",
            background: `${COPPER}10`, border: `1px solid ${COPPER}38`,
            borderRadius: 3, textTransform: "uppercase",
          }}>
            Sorted · Opportunity Score
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
        }}>
          ● Fusing Cross-Module Intelligence Feeds…
        </div>
      ) : targets.length === 0 ? (
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
          <div style={{ fontSize: 38, marginBottom: 12 }}>🛰️</div>
          <div style={{ ...mono, fontSize: 14, color: "rgba(255,255,255,0.78)", fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase" }}>
            Network Quiet
          </div>
          <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 8, letterSpacing: 0.6, lineHeight: 1.55, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
            No active cross-signal opportunities. Run a roof analysis or wait for storm/crime feeds to register signal — the engine fuses automatically.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {targets.map(t => (
            <OpportunityCard
              key={t.id}
              target={t}
              onConvert={handleEngage}
              alreadyConverted={isTargetConverted(t)}
              annotation={annotationsByTargetId[t.id] || null}
            />
          ))}
        </div>
      )}

      {/* Memory layer surfaces — only render when there's something
          worth showing. Empty memory stays quiet; the platform never
          looks like it's pretending to know things it doesn't. */}
      <NetworkPatternsPanel insights={signalLearnings} />
      <OperatorIntelligencePanel ops={operatorEffectiveness} />
      <MemoryFeedPanel snapshot={networkSnapshot} />

      {/* Generated Leads pipeline — same shared panel as the per-module
          feeds. Surfaces unified leads keyed by source="unified_intel". */}
      <GeneratedLeadsPanel source="unified_intel" accent={INNER_GOLD} refreshKey={pipelineRefresh} />

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
            background: INNER_GOLD,
            boxShadow: `0 0 6px ${INNER_GOLD}`,
            animation: "uoPulse 1.6s ease-in-out infinite",
          }} />
          Fusion Network Online
        </span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>Cross-Module Scoring Engine v1</span>
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
