import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./shared/PageHeader";
import PreviewDataBanner from "./PreviewDataBanner";
import { loadActions, KIND_META } from "./services/operationsEngine";
import {
  recordOutcomesSweep,
  aggregateEffectiveness,
  generateOptimizationRecommendations,
  rankBucket,
} from "./services/operationsLearning";
import { loadLeads } from "./services/leadConversion";

/**
 * OperationsInsights — Operational Intelligence Insights surface.
 *
 * The platform's "the network is getting smarter every day" view.
 * Reads action outcomes + leads + memory, synthesizes effectiveness
 * across multiple dimensions, surfaces optimization recommendations.
 *
 * No proprietary data fetching here — this surface is a pure
 * read-and-render over what the operations engine has already
 * persisted. The cinematic shell stays consistent with the rest of
 * the intelligence network.
 */

const RED    = "#E05050";
const COPPER = "#FF6D00";
const GOLD   = "#C9A84C";
const GREEN  = "#00E6A8";
const BLUE   = "#3B82F6";
const PURPLE = "#A855F7";
const INNER_GOLD = "#D4A853";
const mono = { fontFamily: "'Courier New', monospace" };

const SOURCE_COLOR = {
  ROOF:  "#FF6D00",
  STORM: "#E05050",
  CRIME: "#A855F7",
  FIRE:  "#00E6A8",
};

function severityColor(s) {
  return s === "high" ? RED : s === "medium" ? COPPER : GOLD;
}

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
            animation: "oiPulse 1.6s ease-in-out infinite",
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

function SectionStrip({ label, color = GREEN, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color, boxShadow: `0 0 6px ${color}cc` }} />
      <span style={{
        ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.8,
        color: "rgba(255,255,255,0.85)", textTransform: "uppercase",
      }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}28 0%, rgba(255,255,255,0.04) 60%, transparent 100%)` }} />
      {right}
    </div>
  );
}

// ── Effectiveness row — compact, dense Bloomberg-style line ─────────
//
// `liftRef` lets us color the lift chip relative to a configurable
// baseline (network conversion rate). Above-baseline = green,
// at-baseline = gold, below = copper.
function EffRow({ keyLabel, b, baseline, accent, format = "rate" }) {
  const rate = b.conversionRate || 0;
  const lift = baseline > 0 ? (rate - baseline) / baseline : 0;
  const liftColor = lift >= 0.20 ? GREEN
                  : lift >= -0.20 ? GOLD
                  : COPPER;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto auto auto",
      alignItems: "center", gap: 14,
      padding: "8px 14px",
      background: "linear-gradient(135deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
      border: `1px solid ${accent || "rgba(255,255,255,0.08)"}30`,
      borderRadius: 6,
      boxShadow: `0 4px 12px rgba(0,0,0,0.22)`,
    }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 8px",
        background: `${accent || "rgba(255,255,255,0.10)"}1a`,
        border: `1px solid ${accent || "rgba(255,255,255,0.18)"}55`,
        borderRadius: 3,
        ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
        color: accent || "rgba(255,255,255,0.78)",
        textTransform: "uppercase", whiteSpace: "nowrap",
      }}>
        {format === "kind" ? (KIND_META[keyLabel]?.label || keyLabel) : keyLabel}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          ...mono, fontSize: 11, color: "rgba(255,255,255,0.78)",
          letterSpacing: 0.2,
        }}>
          {b.actions} action{b.actions === 1 ? "" : "s"} ·
          {" "}{b.contacts} contacted ·
          {" "}{b.responses} responded ·
          {" "}{b.conversions} converted
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.4, color: "rgba(255,255,255,0.40)", textTransform: "uppercase" }}>Conv</div>
        <div style={{ ...mono, fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: 0.3, lineHeight: 1 }}>
          {Math.round(rate * 100)}%
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ ...mono, fontSize: 8, fontWeight: 800, letterSpacing: 1.4, color: "rgba(255,255,255,0.40)", textTransform: "uppercase" }}>Resp</div>
        <div style={{ ...mono, fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: 0.3, lineHeight: 1 }}>
          {Math.round((b.responseRate || 0) * 100)}%
        </div>
      </div>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 9px",
        background: `${liftColor}1a`,
        border: `1px solid ${liftColor}55`,
        borderRadius: 3,
        ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.3,
        color: liftColor, textTransform: "uppercase",
        whiteSpace: "nowrap",
        boxShadow: `0 0 6px ${liftColor}25`,
      }}>
        {lift > 0 ? "↑" : lift < 0 ? "↓" : "→"}
        {" "}{Math.abs(Math.round(lift * 100))}%
      </span>
    </div>
  );
}

// ── Optimization recommendation row ─────────────────────────────────
function RecommendationRow({ rec }) {
  const sevColor = severityColor(rec.severity);
  const dimMeta = {
    operator: { label: "Operator", color: BLUE },
    region:   { label: "Region",   color: GOLD },
    signal:   { label: "Signal",   color: SOURCE_COLOR[rec.key] || PURPLE },
    kind:     { label: "Workflow", color: COPPER },
    hour:     { label: "Timing",   color: PURPLE },
  };
  const dim = dimMeta[rec.dimension] || { label: rec.dimension, color: "rgba(255,255,255,0.55)" };

  // Map rec.kind → operator-facing badge.
  const KIND_BADGE = {
    OPERATOR_LIFT:        { label: "Operator Lift",      icon: "▲" },
    OPERATOR_DROP:        { label: "Operator Drop",      icon: "▼" },
    REGION_LIFT:          { label: "Region Lift",        icon: "▲" },
    REGION_UNDERPERFORM:  { label: "Region Underperf.",  icon: "▼" },
    SIGNAL_LIFT:          { label: "Signal Lift",        icon: "▲" },
    SIGNAL_DROP:          { label: "Signal Drop",        icon: "▼" },
    KIND_LIFT:            { label: "Workflow Lift",      icon: "▲" },
    KIND_DROP:            { label: "Workflow Drop",      icon: "▼" },
    TIMING_LIFT:          { label: "Timing Lift",        icon: "◐" },
    SATURATION:           { label: "Saturation",         icon: "⚠" },
  }[rec.kind] || { label: rec.kind, icon: "•" };

  return (
    <div style={{
      position: "relative",
      display: "grid", gridTemplateColumns: "auto auto 1fr",
      alignItems: "center", gap: 14,
      padding: "10px 14px 10px 18px",
      background: "linear-gradient(135deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
      border: `1px solid ${sevColor}30`,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: `0 4px 12px rgba(0,0,0,0.28), 0 0 12px ${sevColor}12`,
    }}>
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: sevColor,
        boxShadow: `0 0 8px ${sevColor}80`,
        pointerEvents: "none",
      }} />
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 9px",
        background: `${sevColor}1f`,
        border: `1px solid ${sevColor}55`,
        borderRadius: 3,
        ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
        color: sevColor, textTransform: "uppercase",
        whiteSpace: "nowrap",
        boxShadow: `0 0 8px ${sevColor}30`,
      }}>
        {KIND_BADGE.icon} {KIND_BADGE.label}
      </span>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 8px",
        background: `${dim.color}14`,
        border: `1px solid ${dim.color}45`,
        borderRadius: 3,
        ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.3,
        color: dim.color, textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}>
        <span style={{ width: 3, height: 3, borderRadius: 2, background: dim.color }} />
        {dim.label}
      </span>
      <span style={{
        ...mono, fontSize: 11, color: "rgba(255,255,255,0.85)",
        letterSpacing: 0.2, lineHeight: 1.5,
      }}>
        {rec.message}
      </span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export default function OperationsInsights() {
  const [actions, setActions] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    setLoading(true);
    const leads = loadLeads() || [];
    setPipeline(leads);
    // Fold derived outcomes in before we score so the surface is
    // working with the freshest possible truth.
    recordOutcomesSweep(loadActions(), leads);
    setActions(loadActions());
    mountedAt.current = Date.now();
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  const eff = useMemo(() => aggregateEffectiveness({ actions }), [actions]);
  const recs = useMemo(() => generateOptimizationRecommendations(eff), [eff]);

  const baseline = eff.overall.baselineConvRate || 0.20;

  const topOperators = useMemo(() => rankBucket(eff.byOperator, "conversionRate", 5, 1), [eff]);
  const topSignals   = useMemo(() => rankBucket(eff.bySignal,   "conversionRate", 5, 1), [eff]);
  const topRegions   = useMemo(() => rankBucket(eff.byRegion,   "conversionRate", 5, 1), [eff]);
  const kindPerf     = useMemo(() => rankBucket(eff.byKind,     "conversionRate", 8, 1), [eff]);
  const campaigns    = useMemo(() => rankBucket(eff.byCampaign, "conversionRate", 5, 1), [eff]);

  const minutesSinceCheck = Math.floor((Date.now() - mountedAt.current) / 60000);

  // The shell renders even when there's no data — operators see "Network
  // Learning · Insufficient Data" instead of a blank page.
  const hasData = eff.overall.totalActions >= 3;

  return (
    <div style={{ maxWidth: 1180 }}>
      <style>{`
        @keyframes oiPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.82); }
        }
        @keyframes oiEdge {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
      `}</style>

      <PreviewDataBanner label="Sample insights — metrics synthesized from preview data, not live outcomes" />

      <PageHeader
        title="Operations Insights"
        subtitle="Self-improving deployment intelligence — the network learns from every outcome and adjusts confidence weighting in real time."
        kicker="Operations Insights"
        accent={GREEN}
      />

      {/* KPI strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        marginBottom: 22,
      }}>
        <StatusTile
          label="Total Actions Observed"
          value={loading ? "…" : eff.overall.totalActions}
          sub={`${eff.overall.totalContacts} contacted · ${eff.overall.totalResponses} responded`}
          color={GREEN}
          pulse={eff.overall.totalActions > 0}
        />
        <StatusTile
          label="Conversion Baseline"
          value={loading ? "…" : `${Math.round(baseline * 100)}%`}
          sub={`${eff.overall.totalConversions} conversions · network avg`}
          color={GOLD}
          pulse={false}
        />
        <StatusTile
          label="Response Rate"
          value={loading ? "…" : `${Math.round(eff.overall.baselineRespRate * 100)}%`}
          sub={eff.overall.baselineRespRate >= 0.30 ? "Healthy engagement" : "Watch for fatigue"}
          color={eff.overall.baselineRespRate >= 0.30 ? GREEN : COPPER}
          pulse={false}
        />
        <StatusTile
          label="Saturation Warnings"
          value={loading ? "…" : (eff.saturation || []).length}
          sub={(eff.saturation || []).length > 0 ? "Active throttling required" : "All territories healthy"}
          color={(eff.saturation || []).length > 0 ? RED : GREEN}
          pulse={(eff.saturation || []).length > 0}
        />
      </div>

      {/* Optimization recommendations — surfaces first because this is
          the most actionable feed. Empty state is operationally honest:
          we tell the operator we don't have enough data yet. */}
      <SectionStrip
        label={`Optimization Recommendations${recs.length > 0 ? ` · ${recs.length}` : ""}`}
        color={INNER_GOLD}
        right={
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            color: PURPLE, padding: "2px 8px",
            background: `${PURPLE}10`, border: `1px solid ${PURPLE}38`,
            borderRadius: 3, textTransform: "uppercase",
          }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: PURPLE, boxShadow: `0 0 4px ${PURPLE}` }} />
            Engine · Self-Improving
          </span>
        }
      />
      {recs.length === 0 ? (
        <div style={{
          padding: "32px 22px", textAlign: "center", marginBottom: 22,
          background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          ...mono, fontSize: 11, color: "rgba(255,255,255,0.55)",
          letterSpacing: 0.6, lineHeight: 1.6,
        }}>
          <span style={{ color: "rgba(255,255,255,0.78)", fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", marginRight: 6 }}>
            Network Learning ·
          </span>
          {hasData
            ? "No actionable patterns yet — keep deploying actions and the engine will surface optimizations."
            : "Insufficient outcome data. Engine begins recommending optimizations after ~5 deployed actions."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
          {recs.slice(0, 8).map((r, i) => <RecommendationRow key={`${r.kind}-${r.key}-${i}`} rec={r} />)}
        </div>
      )}

      {/* Top operators */}
      {topOperators.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionStrip label="Top Operators · By Conversion" color={BLUE} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topOperators.map(o => <EffRow key={`op-${o.key}`} keyLabel={o.key} b={o} baseline={baseline} accent={BLUE} />)}
          </div>
        </div>
      )}

      {/* Highest-converting signals */}
      {topSignals.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionStrip label="Highest-Converting Signals" color={PURPLE} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topSignals.map(s => (
              <EffRow key={`sig-${s.key}`} keyLabel={s.key} b={s} baseline={baseline} accent={SOURCE_COLOR[s.key] || PURPLE} />
            ))}
          </div>
        </div>
      )}

      {/* Best-performing regions */}
      {topRegions.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionStrip label="Best-Performing Regions" color={GOLD} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topRegions.map(r => <EffRow key={`reg-${r.key}`} keyLabel={r.key} b={r} baseline={baseline} accent={GOLD} />)}
          </div>
        </div>
      )}

      {/* Campaign performance */}
      {campaigns.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionStrip label="Campaign Performance" color={INNER_GOLD} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {campaigns.map(c => <EffRow key={`cmp-${c.key}`} keyLabel={c.key} b={c} baseline={baseline} accent={INNER_GOLD} />)}
          </div>
        </div>
      )}

      {/* Workflow effectiveness — by ACTION_KIND */}
      {kindPerf.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionStrip label="Deployment Efficiency · By Workflow" color={COPPER} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {kindPerf.map(k => (
              <EffRow key={`kind-${k.key}`} keyLabel={k.key} b={k} baseline={baseline} accent={KIND_META[k.key]?.color || COPPER} format="kind" />
            ))}
          </div>
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
            background: GREEN, boxShadow: `0 0 6px ${GREEN}`,
            animation: "oiPulse 1.6s ease-in-out infinite",
          }} />
          Learning Engine v1
        </span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>Confidence Weighting · Adaptive</span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>Last Sync: {minutesSinceCheck === 0 ? "just now" : `${minutesSinceCheck}m ago`}</span>
        <span style={{
          marginLeft: "auto",
          display: "inline-flex", alignItems: "center", gap: 6,
          color: PURPLE, padding: "2px 8px",
          background: `${PURPLE}10`, border: `1px solid ${PURPLE}38`, borderRadius: 3,
        }}>
          UPA Optimization Network
        </span>
      </div>
    </div>
  );
}
