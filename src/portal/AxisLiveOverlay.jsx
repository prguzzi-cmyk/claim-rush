import { useState, useEffect, useRef } from "react";
import { C } from "./theme";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";
const INNER_GOLD = "#D4A853";

// ── PROMPT BANKS ─────────────────────────────────────────────────────────────

const IDLE_PROMPTS = [
  "Select a lead. Get in control before acting.",
  "Review the board. Identify your highest-confidence target.",
  "Preparation is the edge. Use it.",
  "Stillness before action. Choose your next move.",
  "The system is ready. Are you?",
];

const ACTIVE_PROMPTS = {
  high: [
    "High confidence. Move to close. Don't over-talk.",
    "This lead is ready. Ask, don't explain.",
    "Assume the enrollment. Ask for logistics.",
    "The damage is real. The value is clear. Close.",
    "One question. Then silence. Let them decide.",
  ],
  mid: [
    "Slow down. Lead the conversation.",
    "Build the case with one stat. Then ask.",
    "They're aware but haven't acted. Make inaction expensive.",
    "Ask what hasn't been handled yet. Listen.",
    "Control the tempo. Pause before you respond.",
  ],
  low: [
    "Build trust first. Slow the pace.",
    "Reference their specific damage. Earn credibility.",
    "Don't pitch. Diagnose. Ask about their situation.",
    "Early stage. Be the informed expert, not the salesman.",
    "Specificity builds trust. Use their address and damage type.",
  ],
};

const OUTREACH_PROMPTS = [
  "Let them speak first. Don't rush.",
  "Outreach is active. Monitor responses.",
  "Persistence is professionalism. Follow the sequence.",
  "If they respond, lead with concern — not product.",
  "Every touchpoint adds information. Don't repeat the pitch.",
];

const RESET_PROMPTS = [
  "Breathe. You are in control.",
  "Release the last call. It's done.",
  "Feet on the floor. Come back to center.",
  "One breath. Clear the slate.",
  "You are the steady presence. Reset.",
];

const NEXT_MOVE_PROMPTS = [
  "Ask the next question. Don't explain.",
  "Move forward. The case is built.",
  "What hasn't been addressed? Go there.",
  "Advance the conversation by one step.",
  "Don't repeat. Add new information.",
];

const CLOSE_PROMPTS = [
  "Stop building. Start closing.",
  "\"Here's what happens next —\" Keep going.",
  "Ask for the email. Not the permission.",
  "Silence after the ask. Count to five.",
  "The close is a service, not a pressure move.",
];

// State-lock message (shown when pre-call / outreach / script opened)
const STATE_LOCK_MESSAGE = "You are in control.\nSlow the pace.\nThey follow your lead.";

// Timed micro-prompts for active leads
const MICRO_PROMPTS = [
  { minSec: 0, maxSec: 3, text: "Ask first. Don't explain." },
  { minSec: 10, maxSec: 15, text: "Let them talk. Do not interrupt." },
];

const OBJECTION_MICRO = "Do not defend. Slow down.";
const HIGH_CONF_MICRO = "Silence after the ask.";

// ── AGREEMENT URGENCY ────────────────────────────────────────────────────────

// For demo: use compressed time (8s = 1 day)
const AGR_DEMO_DAY = 8000;

function getAgreementUrgency(sentAt) {
  const elapsed = Date.now() - sentAt;
  const days = elapsed / AGR_DEMO_DAY;
  if (days >= 2) return { level: "high", label: "URGENT", color: "#E05050", action: "Call now", detail: "48h+ unsigned" };
  if (days >= 1) return { level: "mid", label: "FOLLOW UP", color: C.gold, action: "Send reminder", detail: "24h+ unsigned" };
  return { level: "low", label: "PENDING", color: PURPLE, action: "Monitor", detail: "Recently sent" };
}

function getAutoReminderSms(name) {
  const first = name.split(" ")[0];
  return `Hi ${first}, just wanted to make sure you received the enrollment agreement. It only takes 60 seconds to sign — and locks in your coverage immediately. Any questions, I'm a text away.`;
}

function PendingAgreementsPanel({ agreements }) {
  const [expanded, setExpanded] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Re-render every 4s to update urgency labels
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const handleAction = (action, name) => {
    setActionFeedback(`✓ ${action} — ${name.split(" ")[0]}`);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const sorted = [...agreements].sort((a, b) => a.sentAt - b.sentAt); // oldest first
  const urgent = sorted.filter(a => getAgreementUrgency(a.sentAt).level !== "low");

  return (
    <div style={{
      padding: "8px 14px 6px",
      borderTop: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", marginBottom: expanded ? 8 : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: 3,
            background: urgent.length > 0 ? "#E05050" : C.gold,
            boxShadow: urgent.length > 0 ? "0 0 8px rgba(224,80,80,0.5)" : `0 0 6px ${C.gold}60`,
            animation: "axlPulse 2s ease infinite",
          }} />
          <span style={{
            fontSize: 12, fontWeight: 600, letterSpacing: 0.5, ...mono,
            color: urgent.length > 0 ? "#E05050" : C.gold,
          }}>
            {agreements.length} AGREEMENT{agreements.length !== 1 ? "S" : ""} PENDING
          </span>
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", ...mono }}>
          {expanded ? "▾" : "▸"}
        </span>
      </div>

      {/* Feedback toast */}
      {actionFeedback && (
        <div style={{
          padding: "6px 10px", marginBottom: 6,
          background: "rgba(0,230,168,0.10)",
          border: "1px solid rgba(0,230,168,0.20)",
          borderRadius: 5,
          fontSize: 11, color: "#00E6A8", fontWeight: 600, ...mono,
          animation: "axlSlideUp 0.2s ease both",
        }}>
          {actionFeedback}
        </div>
      )}

      {/* Expanded: per-lead details */}
      {expanded && sorted.map(agr => {
        const urgency = getAgreementUrgency(agr.sentAt);
        return (
          <div key={agr.id} style={{
            padding: "8px 10px",
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${urgency.color}20`,
            borderRadius: 6,
            marginBottom: 6,
          }}>
            {/* Lead info */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#FFFFFF", fontWeight: 600, ...mono }}>
                {agr.name}
              </span>
              <span style={{
                padding: "1px 6px", borderRadius: 3,
                background: `${urgency.color}18`, border: `1px solid ${urgency.color}35`,
                fontSize: 10, color: urgency.color, fontWeight: 700, letterSpacing: 0.5, ...mono,
              }}>
                {urgency.label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8, ...mono }}>
              {urgency.detail} · {agr.program}
            </div>

            {/* One-click actions */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => handleAction("SMS reminder sent", agr.name)} style={{
                padding: "3px 8px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)", borderRadius: 4,
                color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: 600,
                cursor: "pointer", ...mono, transition: "all 0.2s",
              }}>📱 SMS</button>
              <button onClick={() => handleAction("Email reminder sent", agr.name)} style={{
                padding: "3px 8px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)", borderRadius: 4,
                color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: 600,
                cursor: "pointer", ...mono, transition: "all 0.2s",
              }}>📧 Email</button>
              {urgency.level !== "low" && (
                <button onClick={() => handleAction("AI call triggered", agr.name)} style={{
                  padding: "3px 8px", background: "rgba(224,80,80,0.08)",
                  border: "1px solid rgba(224,80,80,0.25)", borderRadius: 4,
                  color: "#E05050", fontSize: 10, fontWeight: 600,
                  cursor: "pointer", ...mono, transition: "all 0.2s",
                }}>📞 Call</button>
              )}
              <button onClick={() => handleAction("Agreement resent", agr.name)} style={{
                padding: "3px 8px", background: `${C.gold}08`,
                border: `1px solid ${C.gold}25`, borderRadius: 4,
                color: C.gold, fontSize: 10, fontWeight: 600,
                cursor: "pointer", ...mono, transition: "all 0.2s",
              }}>📄 Resend</button>
            </div>
          </div>
        );
      })}

      {/* Collapsed: smart suggestion */}
      {!expanded && urgent.length > 0 && (
        <div style={{
          marginTop: 4, fontSize: 11,
          color: urgent[0] ? getAgreementUrgency(urgent[0].sentAt).color : C.gold,
          fontWeight: 600, ...mono,
        }}>
          → {urgent[0].name.split(" ")[0]}: {getAgreementUrgency(urgent[0].sentAt).action}
        </div>
      )}
    </div>
  );
}

// ── STATUS LOGIC ─────────────────────────────────────────────────────────────

function getStatus(context) {
  if (context.outreachActive) return { label: "OUTREACH", color: PURPLE };
  if (context.activeLead) return { label: "ACTIVE", color: C.green };
  if (context.pendingAgreements?.length > 0) return { label: "WATCHING", color: C.gold };
  return { label: "STANDBY", color: INNER_GOLD };
}

function getMonitorLine(context) {
  if (context.outreachActive) return "AXIS Mode: Execution";
  if (context.activeLead) return "AXIS Monitoring: Active";
  if (context.pendingAgreements?.length > 0) return "AXIS Tracking Agreements";
  return "AXIS Standing By";
}

const AGREEMENT_PROMPTS = [
  "Agreements pending. Follow up before they go cold.",
  "Unsigned agreements lose momentum every hour. Act now.",
  "Check the pending list. One SMS can close the deal.",
  "The agreement is sent. Your job isn't done until it's signed.",
  "Revenue is one signature away. Don't let it sit.",
];

function getPromptBank(context, trigger) {
  if (trigger === "reset") return RESET_PROMPTS;
  if (trigger === "next") return NEXT_MOVE_PROMPTS;
  if (trigger === "close") return CLOSE_PROMPTS;
  if (context.outreachActive) return OUTREACH_PROMPTS;
  if (context.activeLead) {
    const conf = context.confidence || 80;
    if (conf >= 90) return ACTIVE_PROMPTS.high;
    if (conf >= 85) return ACTIVE_PROMPTS.mid;
    return ACTIVE_PROMPTS.low;
  }
  if (context.pendingAgreements?.length > 0) return AGREEMENT_PROMPTS;
  return IDLE_PROMPTS;
}

// ── COMPONENT ────────────────────────────────────────────────────────────────

export default function AxisLiveOverlay({ context = {}, onSessionEnd }) {
  const [promptIdx, setPromptIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [trigger, setTrigger] = useState(null);
  const [minimized, setMinimized] = useState(false);

  // State lock: freezes prompt when modal opens
  const [locked, setLocked] = useState(false);
  const lockTimerRef = useRef(null);

  // Micro-prompt override
  const [microOverride, setMicroOverride] = useState(null);
  const microTimerRef = useRef(null);

  // Track when a lead became active (for timed micro-prompts)
  const [leadActiveTime, setLeadActiveTime] = useState(null);
  const prevActiveLead = useRef(null);

  // Dynamic confidence score
  const [scoreBoost, setScoreBoost] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const feedbackTimerRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const lastActionRef = useRef(Date.now());

  // Session summary
  const [sessionSummary, setSessionSummary] = useState(null);
  const sessionTimerRef = useRef(null);
  const sessionStartScore = useRef(0);

  const timerRef = useRef(null);
  const triggerTimeoutRef = useRef(null);

  const bank = getPromptBank(context, trigger);
  const status = getStatus(context);
  const monitorLine = getMonitorLine(context);

  // Dynamic score = base confidence + action boosts (capped 0-100)
  const baseConf = context.activeLead ? (context.confidence || 75) : 0;
  const liveScore = context.activeLead ? Math.min(100, Math.max(0, baseConf + scoreBoost)) : 0;
  const scoreLabel = liveScore >= 90 ? "Closing Range" : liveScore >= 75 ? "Control Range" : "Build Trust";
  const scoreColor = liveScore >= 90 ? C.green : liveScore >= 75 ? INNER_GOLD : "#E05050";

  // Determine displayed prompt
  const displayPrompt = locked
    ? STATE_LOCK_MESSAGE
    : microOverride
    ? microOverride
    : bank[promptIdx % bank.length];

  // ── STATE LOCK: trigger on modal open (activeLead changes) ───────────────
  useEffect(() => {
    const cur = context.activeLead;
    const prev = prevActiveLead.current;

    if (cur && cur !== prev) {
      // New lead just became active — lock state
      setLocked(true);
      setMicroOverride(null);
      setSessionSummary(null);
      setLeadActiveTime(Date.now());
      lastActionRef.current = Date.now();
      sessionStartScore.current = scoreBoost;
      setScoreBoost(prev => Math.min(12, prev + 5));
      setFeedback("+5 Control Gained");
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 4000);
      setVisible(false);
      setTimeout(() => setVisible(true), 80);

      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        setLocked(false);
        setMicroOverride(MICRO_PROMPTS[0].text);
        setTimeout(() => setMicroOverride(null), 15000);
      }, 22000 + Math.random() * 6000);
    }

    if (!cur && prev) {
      // Lead deactivated — generate session summary
      const finalScore = baseConf + scoreBoost;
      const earned = Math.max(0, scoreBoost - sessionStartScore.current) + 5; // min 5 points per session
      const controlLevel = finalScore >= 90 ? "High" : finalScore >= 75 ? "Medium" : "Low";
      const messages = {
        High: "Elite execution. Maintain this standard.",
        Medium: "Solid control. Sharpen the close next time.",
        Low: "Trust the process. The reps build the results.",
      };

      const summary = {
        lead: prev,
        score: finalScore,
        points: earned,
        level: controlLevel,
        message: messages[controlLevel],
      };

      setSessionSummary(summary);
      if (onSessionEnd) onSessionEnd(summary);

      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = setTimeout(() => setSessionSummary(null), 8000);

      setLocked(false);
      setMicroOverride(null);
      setLeadActiveTime(null);
      clearTimeout(lockTimerRef.current);
    }

    prevActiveLead.current = cur;
  }, [context.activeLead]);

  // ── TIMED MICRO-PROMPTS (10-15s after lead active) ───────────────────────
  useEffect(() => {
    if (!leadActiveTime || locked) return;

    const elapsed = (Date.now() - leadActiveTime) / 1000;
    const secondMicro = MICRO_PROMPTS[1];

    if (elapsed < secondMicro.maxSec) {
      const delay = Math.max(0, (secondMicro.minSec - elapsed) * 1000);
      microTimerRef.current = setTimeout(() => {
        if (!locked) {
          setMicroOverride(secondMicro.text);
          setVisible(false);
          setTimeout(() => setVisible(true), 80);
          setTimeout(() => setMicroOverride(null), 18000);
        }
      }, delay);
    }

    return () => clearTimeout(microTimerRef.current);
  }, [leadActiveTime, locked]);

  // ── ROTATE PROMPTS (paused during lock/micro) ───────────────────────────
  useEffect(() => {
    if (locked || microOverride) {
      clearInterval(timerRef.current);
      return;
    }

    const interval = 7000 + Math.random() * 3000;
    timerRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPromptIdx(prev => (prev + 1) % bank.length);
        setVisible(true);
      }, 500);
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [bank, locked, microOverride]);

  // ── TRIGGER TIMEOUT ────────────────────────────────────────────────────────
  useEffect(() => {
    if (trigger) {
      // Triggers also inject a micro-prompt for objection/close
      if (trigger === "close" && context.confidence >= 90) {
        setMicroOverride(HIGH_CONF_MICRO);
        setTimeout(() => setMicroOverride(null), 18000);
      }
      clearTimeout(triggerTimeoutRef.current);
      triggerTimeoutRef.current = setTimeout(() => setTrigger(null), 20000);
    }
    return () => clearTimeout(triggerTimeoutRef.current);
  }, [trigger, context.confidence]);

  // Reset prompt index when bank changes
  useEffect(() => {
    if (!locked && !microOverride) {
      setPromptIdx(0);
      setVisible(true);
    }
  }, [context.activeLead, context.outreachActive, trigger, locked, microOverride]);

  // ── CONFIDENCE SCORE: reset on lead change ─────────────────────────────
  useEffect(() => {
    setScoreBoost(0);
    setFeedback(null);
    lastActionRef.current = Date.now();
  }, [context.activeLead]);

  // ── CONFIDENCE SCORE: inactivity detection ─────────────────────────────
  useEffect(() => {
    if (!context.activeLead) {
      clearInterval(inactivityTimerRef.current);
      return;
    }
    inactivityTimerRef.current = setInterval(() => {
      const idle = (Date.now() - lastActionRef.current) / 1000;
      if (idle > 25 && scoreBoost > -5) {
        setScoreBoost(prev => Math.max(-5, prev - 2));
        setFeedback("Pace slipping — regain control");
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 5000);
      }
    }, 10000);
    return () => clearInterval(inactivityTimerRef.current);
  }, [context.activeLead, scoreBoost]);

  // ── CONFIDENCE SCORE: boost helper ──────────────────────────────────────
  const applyBoost = (amount) => {
    lastActionRef.current = Date.now();
    setScoreBoost(prev => Math.min(12, prev + amount));
    setFeedback(`+${amount} Control Gained`);
    clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 4000);
  };

  const handleTrigger = (t) => {
    // Boost confidence on action
    if (context.activeLead) {
      const boosts = { reset: 3, next: 2, close: 4 };
      applyBoost(boosts[t] || 2);
    }
    setLocked(false);
    setMicroOverride(t === "reset" ? null : t === "close" ? null : null);

    // Objection trigger injects micro-prompt
    if (t === "next" && context.activeLead) {
      setMicroOverride(OBJECTION_MICRO);
      setVisible(false);
      setTimeout(() => setVisible(true), 80);
      setTimeout(() => {
        setMicroOverride(null);
        setTrigger(t);
      }, 15000);
      return;
    }

    setTrigger(t);
    setPromptIdx(0);
    setVisible(false);
    setTimeout(() => setVisible(true), 100);
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{
          position: "fixed",
          bottom: 86, right: 24,
          width: 36, height: 36,
          borderRadius: 10,
          background: `${C.navy}ee`,
          border: `1px solid ${PURPLE}30`,
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 899,
          transition: "all 0.2s",
        }}
      >
        <div style={{
          width: 6, height: 6, borderRadius: 3,
          background: status.color,
          boxShadow: `0 0 8px ${status.color}60`,
          animation: "axlPulse 2.5s ease infinite",
        }} />
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed",
      bottom: 86, right: 24,
      width: 320,
      background: "rgba(12, 16, 28, 0.98)",
      border: `1px solid ${locked ? `${PURPLE}40` : "rgba(255,255,255,0.08)"}`,
      borderRadius: 14,
      backdropFilter: "blur(20px)",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.08)",
      zIndex: 899,
      overflow: "hidden",
      animation: "axlSlideUp 0.3s ease both",
      transition: "border-color 0.5s ease",
    }}>
      <style>{`
        @keyframes axlSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes axlPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px currentColor; }
          50% { opacity: 0.5; box-shadow: 0 0 4px currentColor; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "10px 14px 8px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 5,
            background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE}88)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 900, color: "#fff", ...mono,
          }}>AX</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", ...mono, letterSpacing: 1.5 }}>
            AXIS LIVE
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: 3,
              background: status.color,
              boxShadow: `0 0 8px ${status.color}60`,
              animation: "axlPulse 2.5s ease infinite",
            }} />
            <span style={{ fontSize: 12, color: status.color, ...mono, fontWeight: 600, letterSpacing: 1 }}>
              {status.label}
            </span>
          </div>
          <button
            onClick={() => setMinimized(true)}
            style={{
              background: "none", border: "none", color: "#FFFFFF",
              fontSize: 13, cursor: "pointer", padding: "0 2px", lineHeight: 1,
              ...mono,
            }}
          >—</button>
        </div>
      </div>

      {/* Prompt / Session Summary */}
      {sessionSummary ? (
        <div style={{
          padding: "14px 16px 10px",
          animation: "axlSlideUp 0.3s ease both",
        }}>
          <div style={{ fontSize: 12, color: "#FFFFFF", letterSpacing: 2, textTransform: "uppercase", ...mono, fontWeight: 700, marginBottom: 8 }}>
            SESSION COMPLETE
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: sessionSummary.level === "High" ? C.green : sessionSummary.level === "Medium" ? INNER_GOLD : "#E05050", ...mono }}>
              {sessionSummary.score}
            </span>
            <span style={{ fontSize: 13, color: "#FFFFFF", ...mono, letterSpacing: 1, fontWeight: 600 }}>
              {sessionSummary.level.toUpperCase()} CONTROL
            </span>
            <span style={{ fontSize: 13, color: C.green, ...mono, fontWeight: 700 }}>
              +{sessionSummary.points} pts
            </span>
          </div>
          <div style={{ fontSize: 14, color: "#FFFFFF", ...mono, lineHeight: 1.5, fontWeight: 500 }}>
            {sessionSummary.message}
          </div>
        </div>
      ) : (
        <div style={{
          padding: locked ? "18px 16px 14px" : "16px 16px 12px",
          minHeight: 48,
          display: "flex", alignItems: locked ? "flex-start" : "center",
        }}>
          <div style={{
            fontSize: locked ? 16 : 15,
            color: "#FFFFFF",
            lineHeight: locked ? 1.8 : 1.6,
            ...mono,
            fontWeight: locked ? 600 : 500,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(6px)",
            transition: "all 0.5s ease",
            whiteSpace: "pre-line",
          }}>
            {displayPrompt}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{
        padding: "6px 14px 6px",
        display: "flex", gap: 6,
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        {[
          { key: "reset", label: "Reset" },
          { key: "next", label: "Next move" },
          { key: "close", label: "Close" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => handleTrigger(t.key)}
            style={{
              flex: 1,
              padding: "7px 0",
              background: trigger === t.key ? `${PURPLE}25` : "rgba(255,255,255,0.04)",
              border: `1px solid ${trigger === t.key ? `${PURPLE}50` : "rgba(255,255,255,0.10)"}`,
              borderRadius: 8,
              color: "#FFFFFF",
              fontSize: 13, fontWeight: 600, letterSpacing: 0.6,
              cursor: "pointer", ...mono, transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Monitoring Line */}
      <div style={{
        padding: "5px 14px 3px",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <div style={{
          width: 4, height: 4, borderRadius: 2,
          background: status.color,
        }} />
        <span style={{
          fontSize: 13, color: "#FFFFFF", ...mono,
          letterSpacing: 1, fontWeight: 500,
        }}>
          {monitorLine}
        </span>
      </div>

      {/* Pending Agreements Tracker */}
      {context.pendingAgreements?.length > 0 && !context.activeLead && (
        <PendingAgreementsPanel agreements={context.pendingAgreements} />
      )}

      {/* Confidence Score — always visible */}
      <div style={{
        padding: "6px 14px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        {context.activeLead ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: 18, fontWeight: 700, color: scoreColor, ...mono,
                transition: "color 0.4s ease",
              }}>
                {liveScore}
              </span>
              <span style={{
                fontSize: 13, color: "#FFFFFF", ...mono,
                letterSpacing: 1, fontWeight: 600,
                transition: "color 0.4s ease",
              }}>
                {scoreLabel.toUpperCase()}
              </span>
            </div>
            {feedback && (
              <span style={{
                fontSize: 13, ...mono, fontWeight: 700, letterSpacing: 0.5,
                color: feedback.startsWith("+") ? C.green : "#E05050",
                animation: "axlSlideUp 0.3s ease both",
              }}>
                {feedback}
              </span>
            )}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.85)", ...mono,
            }}>
              —
            </span>
            <span style={{
              fontSize: 13, color: "rgba(255,255,255,0.85)", ...mono,
              letterSpacing: 1, fontWeight: 600,
            }}>
              SELECT A LEAD
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
