import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./shared/PageHeader";
import PreviewDataBanner from "./PreviewDataBanner";
import { apiJson } from "../lib/api";
import { loadTargets as loadRoofTargets } from "./services/roofIntel";
import { fetchActiveEvents as fetchStormEvents } from "./services/stormIntel";
import { fetchActiveIncidents as fetchCrimeIncidents } from "./services/crimeIntel";
import { aggregateUnifiedTargets } from "./services/intelligenceFusion";
import { loadLeads } from "./services/leadConversion";
import { _exportMemoryRaw } from "./services/intelligenceMemory";
import {
  generateActions,
  mergeAndPersist,
  loadActions,
  setActionState,
  recordOutcome,
  aggregateOpsMetrics,
  sortActionsForQueue,
  ACTION_STATE,
  STATE_TRANSITIONS,
  KIND_META,
  STATE_META,
  URGENCY_COLOR,
} from "./services/operationsEngine";
import {
  recordOutcomesSweep,
  aggregateEffectiveness,
  applyLearningWeights,
} from "./services/operationsLearning";

/**
 * OperationsCommand — Operations Command Queue surface.
 *
 * The platform's tactical orchestration view. Reads the same fusion +
 * memory the operator already trusts, and emits operational actions —
 * what the deployment network should *do* next, not just what it sees.
 *
 * The "Deploy" button advances state. Real voice / SMS / campaign API
 * calls land in `executeAction(action)` once the backend ships; until
 * then state transitions are the contract.
 */

const RED    = "#E05050";
const COPPER = "#FF6D00";
const GOLD   = "#C9A84C";
const GREEN  = "#00E6A8";
const BLUE   = "#3B82F6";
const PURPLE = "#A855F7";
const INNER_GOLD = "#D4A853";
const mono = { fontFamily: "'Courier New', monospace" };

async function fetchFireIncidentsSafe() {
  try {
    const r = await apiJson("/fire-incidents?size=50");
    return Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
  } catch { return []; }
}

// ── KPI tile (matches operational-status-tile language) ─────────────
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
        ...mono, fontSize: 12, fontWeight: 800, letterSpacing: 1.5,
        textTransform: "uppercase", color: "rgba(255,255,255,0.70)",
        marginBottom: 6,
      }}>
        {pulse && (
          <span style={{
            width: 6, height: 6, borderRadius: 3,
            background: color, boxShadow: `0 0 6px ${color}aa`,
            animation: "ocPulse 1.6s ease-in-out infinite",
          }} />
        )}
        {label}
      </div>
      <div style={{
        position: "relative", zIndex: 1,
        ...mono, fontSize: 30, fontWeight: 800, color: "#fff",
        letterSpacing: -0.2, lineHeight: 1.05,
        textShadow: `0 0 12px ${color}40`,
      }}>{value}</div>
      <div style={{
        position: "relative", zIndex: 1,
        marginTop: 5, fontSize: 13, fontWeight: 500,
        letterSpacing: 0.1, color: "rgba(255,255,255,0.66)",
        lineHeight: 1.35,
      }}>{sub}</div>
    </div>
  );
}

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

// ── Action card ─────────────────────────────────────────────────────
//
// Operational density first. Everything an operator needs to make a
// deploy/snooze/archive decision in one card: kind chip, state chip,
// urgency-encoded edge, AI title + reasoning, operator + workflow,
// confidence + priority + region, transition buttons.
function ActionCard({ action, onTransition, onOutcome }) {
  const km = KIND_META[action.kind] || { label: action.kind, color: GOLD, icon: "•" };
  const sm = STATE_META[action.state] || STATE_META.QUEUED;
  const uColor = URGENCY_COLOR[action.urgency] || GOLD;
  const allowed = STATE_TRANSITIONS[action.state] || [];

  const ageMin = Math.max(0, Math.floor((Date.now() - new Date(action.created_at).getTime()) / 60_000));
  const ageStr = ageMin < 1 ? "just now"
              : ageMin < 60 ? `${ageMin}m ago`
              : `${Math.round(ageMin / 60)}h ago`;

  return (
    <div style={{
      position: "relative",
      padding: 0,
      background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
      border: `1px solid ${uColor}30`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 6px 18px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 22px ${uColor}10`,
    }}>
      {/* Severity-encoded left edge */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: uColor,
        boxShadow: `0 0 12px ${uColor}aa`,
        pointerEvents: "none",
        animation: sm.pulse ? "ocEdge 2.4s ease-in-out infinite" : "none",
      }} />
      <div style={{
        position: "absolute", top: -50, right: -50,
        width: 180, height: 180,
        background: `radial-gradient(circle, ${km.color}1c 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      {/* Header strip — kind + state + region + age */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px 10px 18px", gap: 10, flexWrap: "wrap",
        background: "rgba(255,255,255,0.025)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          {/* Kind chip */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "2px 9px",
            background: `${km.color}1f`,
            border: `1px solid ${km.color}55`,
            borderRadius: 3,
            ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
            color: km.color, textTransform: "uppercase",
            boxShadow: `0 0 10px ${km.color}25`,
          }}>
            <span style={{ fontSize: 12 }}>{km.icon}</span>
            {km.label}
          </span>

          {/* State chip */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "2px 9px",
            background: `${sm.color}1f`,
            border: `1px solid ${sm.color}55`,
            borderRadius: 3,
            ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
            color: sm.color, textTransform: "uppercase",
            boxShadow: sm.pulse ? `0 0 10px ${sm.color}40` : "none",
          }}>
            {sm.pulse && (
              <span style={{
                width: 4, height: 4, borderRadius: 2,
                background: sm.color, boxShadow: `0 0 4px ${sm.color}`,
                animation: "ocPulse 1.4s ease-in-out infinite",
              }} />
            )}
            {sm.label}
          </span>

          {/* Region chip */}
          {(action.region?.state || action.region?.city) && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 8px",
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 3,
              ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4,
              color: "rgba(255,255,255,0.65)", textTransform: "uppercase",
            }}>
              <span style={{ width: 3, height: 3, borderRadius: 2, background: BLUE }} />
              {action.region.city ? `${action.region.city}, ${action.region.state}` : action.region.state}
            </span>
          )}
        </div>

        <span style={{
          ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
          color: "rgba(255,255,255,0.45)", textTransform: "uppercase",
        }}>
          Generated · {ageStr}
        </span>
      </div>

      {/* Body */}
      <div style={{
        position: "relative", zIndex: 1,
        padding: "14px 18px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{
          ...mono, fontSize: 14, fontWeight: 800, color: "#fff",
          letterSpacing: 0.3, lineHeight: 1.3,
          textShadow: `0 0 10px ${uColor}30`,
        }}>{action.title}</div>

        {/* AI reasoning block */}
        <div style={{
          padding: "10px 12px",
          background: `linear-gradient(135deg, ${km.color}10 0%, ${km.color}02 100%)`,
          border: `1px solid ${km.color}38`,
          borderRadius: 6,
          ...mono, fontSize: 11, color: "rgba(255,255,255,0.80)",
          lineHeight: 1.55, letterSpacing: 0.2,
          position: "relative", overflow: "hidden",
        }}>
          <span style={{
            color: km.color, fontWeight: 800, letterSpacing: 1.4,
            fontSize: 11, textTransform: "uppercase", marginRight: 6,
          }}>AI Reasoning ·</span>
          {action.reasoning}
        </div>

        {/* Telemetry row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          ...mono, fontSize: 12, color: "rgba(255,255,255,0.55)",
          letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
        }}>
          {action.proposed_operator && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: BLUE, boxShadow: `0 0 4px ${BLUE}` }} />
              Operator · <span style={{ color: "#fff", marginLeft: 2, fontWeight: 800 }}>{action.proposed_operator.name}</span>
            </span>
          )}
          {action.proposed_workflow && (
            <>
              <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: PURPLE, boxShadow: `0 0 4px ${PURPLE}` }} />
                Workflow · <span style={{ color: "#fff", marginLeft: 2, fontWeight: 800 }}>{action.proposed_workflow}</span>
              </span>
            </>
          )}
          <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: uColor, boxShadow: `0 0 4px ${uColor}` }} />
            Urgency · <span style={{ color: uColor, marginLeft: 2, fontWeight: 800 }}>{action.urgency}</span>
          </span>
          <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: GREEN, boxShadow: `0 0 4px ${GREEN}` }} />
            Confidence · <span style={{ color: "#fff", marginLeft: 2, fontWeight: 800 }}>{action.confidence}%</span>
            {typeof action.learned_lift === "number" && action.learned_lift !== 0 && (
              <span style={{
                marginLeft: 6,
                padding: "1px 6px",
                background: action.learned_lift > 0 ? `${GREEN}1a` : `${COPPER}1a`,
                border: `1px solid ${action.learned_lift > 0 ? GREEN : COPPER}55`,
                borderRadius: 3,
                color: action.learned_lift > 0 ? GREEN : COPPER,
                fontSize: 8, letterSpacing: 1.2,
              }}>
                {action.learned_lift > 0 ? "↑" : "↓"}{Math.abs(action.learned_lift)} learned
              </span>
            )}
          </span>
          <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: GOLD, boxShadow: `0 0 4px ${GOLD}` }} />
            Priority · <span style={{ color: "#fff", marginLeft: 2, fontWeight: 800 }}>{action.priority}</span>
          </span>
          {/* Phase 3 — composite priority_score (urgency + volume +
              recency + territory + outreach inactivity + intel
              confidence, normalized 0-100). Sits next to the legacy
              rule-author Priority hint so power users can see both;
              the queue sorts on priority_score. */}
          {typeof action.priority_score === "number" && (
            <>
              <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                    title={action.score_components
                      ? `Urgency ${action.score_components.urgency}/30 · `
                        + `Volume ${action.score_components.volume}/25 · `
                        + `Recency ${action.score_components.recency}/15 · `
                        + (action.score_components.territory !== undefined
                          ? `Territory ${action.score_components.territory}/10 · ` : "")
                        + `Inactivity ${action.score_components.inactivity}/10 · `
                        + `Confidence ${action.score_components.confidence}/20`
                      : ""}>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: "#A855F7", boxShadow: `0 0 4px #A855F7` }} />
                Score · <span style={{ color: "#A855F7", marginLeft: 2, fontWeight: 800 }}>{action.priority_score}</span>
              </span>
            </>
          )}
          {/* Phase 2 — reserve estimate chip. Estimate only; no debit
              happens at deploy time yet (gated until live execution
              wires through). Renders even for 0-cost actions so the
              operator can tell at a glance that the play is "free". */}
          {typeof action.reserve_estimate === "number" && (
            <>
              <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "1px 8px",
                background: action.reserve_estimate > 0 ? "rgba(0,229,255,0.08)" : "rgba(255,255,255,0.04)",
                border: action.reserve_estimate > 0
                  ? "1px solid rgba(0,229,255,0.45)"
                  : "1px solid rgba(255,255,255,0.12)",
                borderRadius: 3,
              }}>
                <span style={{
                  width: 4, height: 4, borderRadius: 2,
                  background: action.reserve_estimate > 0 ? "#00E5FF" : "rgba(255,255,255,0.4)",
                  boxShadow: action.reserve_estimate > 0 ? "0 0 4px #00E5FF" : "none",
                }} />
                Est. Reserve ·{" "}
                <span style={{
                  color: action.reserve_estimate > 0 ? "#00E5FF" : "rgba(255,255,255,0.55)",
                  marginLeft: 2, fontWeight: 800,
                }}>
                  {action.reserve_estimate > 0
                    ? `≈ ${action.reserve_estimate.toLocaleString()}`
                    : "No reserve cost"}
                </span>
              </span>
            </>
          )}
        </div>

        {/* State-transition buttons */}
        {allowed.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            paddingTop: 4, borderTop: "1px dashed rgba(255,255,255,0.06)",
            marginTop: 2,
          }}>
            {/* Primary action — first allowed transition that isn't archive */}
            {allowed.filter(s => s !== "ARCHIVED").slice(0, 2).map(targetState => {
              const sMeta = STATE_META[targetState];
              const isPrimary = targetState === "DEPLOYED" || targetState === "EXECUTED" || targetState === "MONITORING";
              return (
                <button
                  key={targetState}
                  onClick={() => onTransition(action.id, targetState)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${sMeta.color}48 0%, ${sMeta.color}1c 100%)`;
                    e.currentTarget.style.boxShadow = `0 0 18px ${sMeta.color}55, inset 0 0 0 1px ${sMeta.color}aa`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isPrimary
                      ? `linear-gradient(135deg, ${sMeta.color}30 0%, ${sMeta.color}10 100%)`
                      : "rgba(255,255,255,0.04)";
                    e.currentTarget.style.boxShadow = isPrimary
                      ? `0 0 14px ${sMeta.color}40, inset 0 0 0 1px ${sMeta.color}55`
                      : "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  style={{
                    padding: "7px 13px",
                    background: isPrimary
                      ? `linear-gradient(135deg, ${sMeta.color}30 0%, ${sMeta.color}10 100%)`
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isPrimary ? `${sMeta.color}66` : "rgba(255,255,255,0.10)"}`,
                    borderRadius: 5,
                    color: isPrimary ? sMeta.color : "rgba(255,255,255,0.78)",
                    ...mono, fontSize: 12, fontWeight: 800, letterSpacing: 1.4,
                    textTransform: "uppercase",
                    cursor: "pointer",
                    transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
                    boxShadow: isPrimary
                      ? `0 0 14px ${sMeta.color}40, inset 0 0 0 1px ${sMeta.color}55`
                      : "none",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  {targetState === "DEPLOYED" ? "▶ Deploy"
                    : targetState === "MONITORING" ? "● Monitor"
                    : targetState === "EXECUTED" ? "✓ Executed"
                    : targetState === "ESCALATED" ? "▲ Escalate"
                    : targetState === "FAILED" ? "✕ Failed"
                    : sMeta.label}
                </button>
              );
            })}

            {/* Outcome micro-captures — only meaningful while in flight.
                These feed the learning service so future actions in
                similar buckets get confidence-adjusted automatically. */}
            {(action.state === "DEPLOYED" || action.state === "MONITORING") && onOutcome && (
              <>
                {!action.outcomes?.contacted && (
                  <button
                    onClick={() => onOutcome(action.id, { contacted: true })}
                    onMouseEnter={(e) => { e.currentTarget.style.color = GREEN; e.currentTarget.style.borderColor = `${GREEN}55`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
                    style={{
                      padding: "5px 10px",
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 4,
                      color: "rgba(255,255,255,0.65)",
                      ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4,
                      textTransform: "uppercase", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >Mark Contacted</button>
                )}
                {!action.outcomes?.responded && (
                  <button
                    onClick={() => onOutcome(action.id, { responded: true })}
                    onMouseEnter={(e) => { e.currentTarget.style.color = GREEN; e.currentTarget.style.borderColor = `${GREEN}55`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
                    style={{
                      padding: "5px 10px",
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 4,
                      color: "rgba(255,255,255,0.65)",
                      ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4,
                      textTransform: "uppercase", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >Mark Responded</button>
                )}
                {/* Show outcome chips that have already been captured. */}
                {action.outcomes?.contacted && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 8px",
                    background: `${GREEN}14`, border: `1px solid ${GREEN}55`,
                    borderRadius: 3,
                    ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.3,
                    color: GREEN, textTransform: "uppercase",
                  }}>✓ Contacted</span>
                )}
                {action.outcomes?.responded && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 8px",
                    background: `${GREEN}14`, border: `1px solid ${GREEN}55`,
                    borderRadius: 3,
                    ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.3,
                    color: GREEN, textTransform: "uppercase",
                  }}>✓ Responded</span>
                )}
              </>
            )}

            {/* Archive button — always available */}
            {allowed.includes("ARCHIVED") && (
              <button
                onClick={() => onTransition(action.id, "ARCHIVED")}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.30)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
                style={{
                  marginLeft: "auto",
                  padding: "5px 11px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 4,
                  color: "rgba(255,255,255,0.55)",
                  ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4,
                  textTransform: "uppercase", cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >Archive</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Active deployment row — compact list shown in the deployments strip
function DeploymentRow({ action, onTransition }) {
  const km = KIND_META[action.kind] || { label: action.kind, color: GOLD, icon: "•" };
  const sm = STATE_META[action.state] || STATE_META.DEPLOYED;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto auto",
      alignItems: "center", gap: 14,
      padding: "8px 14px",
      background: "linear-gradient(135deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
      border: `1px solid ${sm.color}30`,
      borderRadius: 6,
      boxShadow: `0 4px 12px rgba(0,0,0,0.28), 0 0 12px ${sm.color}10`,
    }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 8px",
        background: `${sm.color}1a`,
        border: `1px solid ${sm.color}55`,
        borderRadius: 3,
        ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4,
        color: sm.color, textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}>
        {sm.pulse && (
          <span style={{
            width: 4, height: 4, borderRadius: 2,
            background: sm.color, boxShadow: `0 0 4px ${sm.color}`,
            animation: "ocPulse 1.4s ease-in-out infinite",
          }} />
        )}
        {sm.label}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          ...mono, fontSize: 12, fontWeight: 800, color: "#fff",
          letterSpacing: 0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{action.title}</div>
        <div style={{
          ...mono, fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
          color: km.color, textTransform: "uppercase", marginTop: 2,
        }}>{km.label}{action.proposed_operator ? ` · ${action.proposed_operator.name}` : ""}</div>
      </div>
      <span style={{
        ...mono, fontSize: 12, fontWeight: 700, letterSpacing: 0.8,
        color: "rgba(255,255,255,0.55)", textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}>
        Conf {action.confidence}%
      </span>
      <button
        onClick={() => onTransition(action.id, "EXECUTED")}
        onMouseEnter={(e) => e.currentTarget.style.background = `${PURPLE}28`}
        onMouseLeave={(e) => e.currentTarget.style.background = `${PURPLE}14`}
        style={{
          padding: "4px 10px",
          background: `${PURPLE}14`,
          border: `1px solid ${PURPLE}55`,
          borderRadius: 4,
          color: PURPLE,
          ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4,
          textTransform: "uppercase", cursor: "pointer",
          transition: "all 0.15s",
        }}
      >Mark Executed</button>
    </div>
  );
}

// ── Operational Reserve hero counter ─────────────────────────────────
// Visible reserve balance + monthly allocation pulled from the same
// /v1/wallet/me + /v1/wallet/me/monthly-summary endpoints the Angular
// RIN portal uses. Pure read; no consumption happens on this page yet.
function ReserveHero({ wallet, monthly, walletError }) {
  const balance      = wallet?.token_balance ?? null;
  const allocation   = monthly?.monthly_reserve ?? wallet?.hard_limit_tokens ?? null;
  const earnedMonth  = monthly?.rewards_earned_month ?? 0;
  const spentMonth   = monthly?.usage_spent_month ?? 0;
  const utilizationPct = (allocation && allocation > 0 && typeof balance === "number")
    ? Math.min(100, Math.max(0, Math.round((balance / allocation) * 100)))
    : null;
  const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : "—");

  return (
    <div style={{
      marginBottom: 22,
      padding: "18px 22px",
      borderRadius: 12,
      background: `radial-gradient(circle at 0% 0%, ${GREEN}14, transparent 60%),
                   radial-gradient(circle at 100% 0%, ${BLUE}10, transparent 65%),
                   linear-gradient(180deg, rgba(13,19,32,0.92), rgba(13,19,32,0.78))`,
      border: `1px solid ${GREEN}28`,
      boxShadow: `0 18px 48px -28px rgba(0,0,0,0.85), 0 0 30px -10px ${GREEN}22`,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* top hairline */}
      <div style={{
        position: "absolute", top: 0, left: 18, right: 18, height: 2,
        background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)`,
        opacity: 0.55,
      }} />

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 22, alignItems: "stretch" }}>
        {/* primary balance */}
        <div>
          <div style={{
            ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.8,
            color: "rgba(255,255,255,0.55)", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            Operational Reserve Available
          </div>
          <div style={{
            ...mono, fontSize: 38, fontWeight: 300, letterSpacing: -0.5,
            color: "#fff",
            textShadow: `0 0 24px ${GREEN}66`,
            lineHeight: 1.05,
          }}>
            {walletError ? "—" : fmt(balance)}
          </div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 6,
            lineHeight: 1.4, maxWidth: "44ch",
          }}>
            <strong style={{ color: "#fff" }}>Intelligence Credits.</strong>
            {" "}Usage is only consumed when approved actions execute.
          </div>
        </div>

        {/* monthly allocation */}
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: 18 }}>
          <div style={{
            ...mono, fontSize: 10, fontWeight: 800, letterSpacing: 1.6,
            color: "rgba(255,255,255,0.50)", textTransform: "uppercase",
          }}>
            Monthly Allocation
          </div>
          <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 4 }}>
            {fmt(allocation)}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
            credits per cycle
          </div>
        </div>

        {/* utilization runway */}
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: 18 }}>
          <div style={{
            ...mono, fontSize: 10, fontWeight: 800, letterSpacing: 1.6,
            color: "rgba(255,255,255,0.50)", textTransform: "uppercase",
          }}>
            Capacity Remaining
          </div>
          <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: GREEN, marginTop: 4 }}>
            {utilizationPct === null ? "—" : `${utilizationPct}%`}
          </div>
          <div style={{
            height: 6, marginTop: 8, background: "rgba(255,255,255,0.06)",
            borderRadius: 3, overflow: "hidden",
          }}>
            <div style={{
              width: `${utilizationPct ?? 0}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${GREEN}, ${GREEN}80)`,
              boxShadow: `0 0 12px ${GREEN}55`,
              transition: "width 600ms ease",
            }} />
          </div>
        </div>

        {/* this-cycle activity */}
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: 18 }}>
          <div style={{
            ...mono, fontSize: 10, fontWeight: 800, letterSpacing: 1.6,
            color: "rgba(255,255,255,0.50)", textTransform: "uppercase",
          }}>
            This Cycle
          </div>
          <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: GREEN, marginTop: 6 }}>
            +{fmt(earnedMonth)} earned
          </div>
          <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: COPPER, marginTop: 2 }}>
            −{fmt(spentMonth)} consumed
          </div>
        </div>
      </div>

      {walletError && (
        <div style={{
          marginTop: 12, padding: "8px 12px",
          background: "rgba(255,109,0,0.08)",
          border: `1px solid ${COPPER}55`,
          borderRadius: 6,
          fontSize: 12, color: "rgba(255,255,255,0.78)",
        }}>
          Reserve balance unavailable right now ({walletError}). The console below still functions; consumption gates run on the backend.
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export default function OperationsCommand() {
  const [roofTargets, setRoofTargets]     = useState([]);
  const [stormEvents, setStormEvents]     = useState([]);
  const [crimeIncidents, setCrimeIncidents] = useState([]);
  const [fireIncidents, setFireIncidents] = useState([]);
  const [pipeline, setPipeline]           = useState([]);
  const [actions, setActions]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [tick, setTick] = useState(0);
  const mountedAt = useRef(Date.now());

  // Operational Reserve telemetry — pure read, no consumption from this
  // page. /v1/wallet/me lazily creates the wallet if missing; the
  // monthly-summary endpoint adds rollups. Either failure is non-fatal:
  // page still renders, hero shows "—" with an honest error chip.
  const [wallet,        setWallet]        = useState(null);
  const [monthly,       setMonthly]       = useState(null);
  const [walletError,   setWalletError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadReserve() {
      try {
        const w = await apiJson("/wallet/me");
        if (!cancelled) setWallet(w || null);
      } catch (e) {
        if (!cancelled) setWalletError(e?.detail || `HTTP ${e?.status || "?"}`);
      }
      try {
        const m = await apiJson("/wallet/me/monthly-summary");
        if (!cancelled) setMonthly(m || null);
      } catch {
        // monthly summary is supplementary — don't surface its
        // failure separately if /wallet/me succeeded.
      }
    }
    loadReserve();
    return () => { cancelled = true; };
  }, []);

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
        setPipeline(loadLeads() || []);
        mountedAt.current = Date.now();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  const unifiedTargets = useMemo(() => aggregateUnifiedTargets({
    roofTargets, stormEvents, crimeIncidents, fireIncidents, priorLeads: pipeline,
  }), [roofTargets, stormEvents, crimeIncidents, fireIncidents, pipeline]);

  // Run rules engine + learning sweep whenever inputs settle.
  // Pipeline:
  //   1. recordOutcomesSweep      — derive outcomes from current state
  //   2. aggregateEffectiveness   — synthesize learning signals
  //   3. generateActions          — emit fresh proposals
  //   4. applyLearningWeights     — scale confidence by learned lifts
  //   5. mergeAndPersist          — merge into the persisted store
  useEffect(() => {
    if (loading) return;
    recordOutcomesSweep(loadActions(), pipeline);
    const eff = aggregateEffectiveness({ actions: loadActions() });
    const generated = generateActions({
      unifiedTargets,
      pipeline,
      fireIncidents,    // Phase 2 — required by ruleUncontactedFireLeads
      memory: _exportMemoryRaw(),
      effectiveness: eff,
    });
    const adjusted = applyLearningWeights(generated, eff);
    const merged = mergeAndPersist(adjusted);
    setActions(merged);
  }, [unifiedTargets, pipeline, loading]);

  const sorted = useMemo(() => sortActionsForQueue(actions), [actions]);
  const metrics = useMemo(() => aggregateOpsMetrics(actions), [actions]);

  const live = sorted.filter(a => a.state === "DEPLOYED" || a.state === "MONITORING");
  const queue = sorted.filter(a => a.state !== "ARCHIVED" && a.state !== "EXECUTED" && a.state !== "DEPLOYED" && a.state !== "MONITORING");
  const history = sorted.filter(a => a.state === "EXECUTED" || a.state === "ARCHIVED" || a.state === "FAILED").slice(0, 8);

  function handleTransition(id, newState) {
    const updated = setActionState(id, newState);
    if (updated) setActions(loadActions());
  }

  function handleOutcome(id, partial) {
    const updated = recordOutcome(id, partial);
    if (updated) setActions(loadActions());
  }

  const minutesSinceCheck = Math.floor((Date.now() - mountedAt.current) / 60000);

  return (
    <div style={{ maxWidth: 1180 }}>
      <style>{`
        @keyframes ocPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.82); }
        }
        @keyframes ocEdge {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
      `}</style>

      <PreviewDataBanner label="Preview Data — sample deployment actions render below. Deploy button does NOT place real outbound calls, SMS, or AI voice yet; live execution is gated until wiring is verified." />

      <PageHeader
        title="Operations Command"
        subtitle="AI-orchestrated deployment network — operational actions auto-generated from cross-signal intelligence + memory. Deploy, monitor, escalate."
        kicker="Operations Command"
        accent={COPPER}
      />

      {/* Plain-English explainer — readable size, no jargon. Sits
          between the page header and the reserve hero so a first-time
          operator understands what this surface IS before staring at
          the reserve counter. */}
      <div style={{
        marginBottom: 18,
        padding: "12px 16px",
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        fontSize: 14,
        lineHeight: 1.55,
        color: "rgba(255,255,255,0.85)",
      }}>
        <strong style={{ color: "#fff" }}>What this page is.</strong>{" "}
        Operations Command coordinates automated deployment actions across
        leads, outreach, claims, and intelligence modules.{" "}
        <strong style={{ color: COPPER }}>
          Approved actions may consume Operational Reserve when executed.
        </strong>{" "}
        Pending actions surface below; nothing is sent until you deploy.
      </div>

      {/* Operational Reserve hero — live balance + monthly allocation +
          utilization. Same wallet endpoints the Angular RIN portal
          already uses. */}
      <ReserveHero wallet={wallet} monthly={monthly} walletError={walletError} />

      {/* KPI strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        marginBottom: 22,
      }}>
        <StatusTile
          label="Waiting for Approval"
          value={loading ? "…" : metrics.queued}
          sub={metrics.queued > 0
            ? "Suggested actions ready for you to review"
            : "Nothing waiting · engine will surface new actions here"}
          color={metrics.queued > 0 ? COPPER : GREEN}
          pulse={metrics.queued > 0}
        />
        <StatusTile
          label="Currently Deployed"
          value={loading ? "…" : metrics.activeWorkflows}
          sub={metrics.activeWorkflows > 0
            ? "In-flight workflows being monitored"
            : "No actions deployed right now"}
          color={metrics.activeWorkflows > 0 ? GREEN : "rgba(255,255,255,0.45)"}
          pulse={metrics.activeWorkflows > 0}
        />
        <StatusTile
          label="High-Priority Regions"
          value={loading ? "…" : metrics.surgeZones}
          sub={metrics.surgeZones > 0
            ? "Areas escalated above normal activity"
            : "All regions at normal levels"}
          color={metrics.surgeZones > 0 ? RED : GREEN}
          pulse={metrics.surgeZones > 0}
        />
        <StatusTile
          label="Completed This Cycle"
          value={loading ? "…" : metrics.executed}
          sub={`${metrics.total} total proposed · ${metrics.archived} archived`}
          color={GOLD}
          pulse={false}
        />
      </div>

      {/* Active deployments strip */}
      {live.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionStrip
            label={`Active Deployments · ${live.length}`}
            color={GREEN}
            right={
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
                color: GREEN, padding: "2px 8px",
                background: `${GREEN}10`, border: `1px solid ${GREEN}40`,
                borderRadius: 3, textTransform: "uppercase",
              }}>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: GREEN, boxShadow: `0 0 5px ${GREEN}`, animation: "ocPulse 1.6s ease-in-out infinite" }} />
                Live
              </span>
            }
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {live.map(a => <DeploymentRow key={a.id} action={a} onTransition={handleTransition} />)}
          </div>
        </div>
      )}

      {/* Action queue */}
      <SectionStrip
        label={`Suggested Actions${queue.length > 0 ? ` · ${queue.length} waiting` : ""}`}
        color={COPPER}
        right={
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
            color: PURPLE, padding: "2px 8px",
            background: `${PURPLE}10`, border: `1px solid ${PURPLE}38`,
            borderRadius: 3, textTransform: "uppercase",
          }}>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: PURPLE, boxShadow: `0 0 4px ${PURPLE}` }} />
            Engine · Always Watching
          </span>
        }
      />

      {loading ? (
        <div style={{
          padding: "40px 20px", textAlign: "center",
          background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.005) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          fontSize: 14, color: "rgba(255,255,255,0.70)",
          fontWeight: 600,
        }}>
          Synthesizing operational actions from network intelligence…
        </div>
      ) : queue.length === 0 ? (
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
          <div style={{ fontSize: 16, color: "#fff", fontWeight: 700, letterSpacing: 0.4 }}>
            Nothing to approve right now
          </div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.70)",
            marginTop: 8, lineHeight: 1.55,
            maxWidth: 540, marginLeft: "auto", marginRight: "auto",
          }}>
            The engine is monitoring the platform's intelligence signals continuously.
            New suggested actions — outreach plays, claim follow-ups, surge responses — will appear here automatically.
            <strong style={{ color: "#fff" }}> No reserve is consumed until you deploy an action.</strong>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {queue.map(a => (
            <ActionCard key={a.id} action={a} onTransition={handleTransition} onOutcome={handleOutcome} />
          ))}
        </div>
      )}

      {/* Execution history */}
      {history.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionStrip label="Execution History · Last 8" color={INNER_GOLD} />
          <div style={{
            padding: "8px 0",
            background: "linear-gradient(180deg, rgba(255,255,255,0.012) 0%, rgba(255,255,255,0.003) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
          }}>
            {history.map((a, i) => {
              const km = KIND_META[a.kind] || { label: a.kind, color: GOLD };
              const sm = STATE_META[a.state] || STATE_META.EXECUTED;
              const t = new Date(a.state_changed_at);
              const age = Math.max(0, Math.floor((Date.now() - t.getTime()) / 60000));
              const ageStr = age < 1 ? "just now" : age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
              return (
                <div key={a.id} style={{
                  display: "grid", gridTemplateColumns: "auto auto 1fr auto",
                  alignItems: "center", gap: 14,
                  padding: "6px 14px",
                  borderBottom: i === history.length - 1 ? "none" : "1px dashed rgba(255,255,255,0.05)",
                }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "2px 7px",
                    background: `${sm.color}1a`,
                    border: `1px solid ${sm.color}45`,
                    borderRadius: 3,
                    ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.3,
                    color: sm.color, textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}>
                    {sm.label}
                  </span>
                  <span style={{
                    ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.3,
                    color: km.color, textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}>
                    {km.label}
                  </span>
                  <span style={{
                    ...mono, fontSize: 11, color: "rgba(255,255,255,0.78)",
                    letterSpacing: 0.2,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {a.title}
                  </span>
                  <span style={{
                    ...mono, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
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
      )}

      {/* Telemetry footer */}
      <div style={{
        marginTop: 24,
        padding: "12px 16px",
        background: "linear-gradient(90deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 50%, rgba(255,255,255,0.025) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        ...mono, fontSize: 12, color: "rgba(255,255,255,0.55)",
        letterSpacing: 1.2, fontWeight: 700, textTransform: "uppercase",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 5, height: 5, borderRadius: 3,
            background: COPPER, boxShadow: `0 0 6px ${COPPER}`,
            animation: "ocPulse 1.6s ease-in-out infinite",
          }} />
          Operations Engine v1
        </span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>16 Rule Generators Active</span>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>Last Sync: {minutesSinceCheck === 0 ? "just now" : `${minutesSinceCheck}m ago`}</span>
        <span style={{
          marginLeft: "auto",
          display: "inline-flex", alignItems: "center", gap: 6,
          color: PURPLE, padding: "2px 8px",
          background: `${PURPLE}10`, border: `1px solid ${PURPLE}38`, borderRadius: 3,
        }}>
          UPA Deployment Network
        </span>
      </div>
    </div>
  );
}
