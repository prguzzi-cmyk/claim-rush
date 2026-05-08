import { useState, useEffect } from "react";

/**
 * Phase 18 — Retention & Engagement Widgets.
 *
 * "Your ACI This Week" panel showing activity streaks, milestones,
 * weekly summary, and network position. Designed to keep CPs/RVPs/Agents
 * engaged and reduce churn by making progress visible.
 */

const GOLD = "#C9A84C";
const GREEN = "#00E6A8";
const PURPLE = "#A855F7";
const NAVY = "#0A1628";
const mono = { fontFamily: "'Courier New', monospace" };

function getToken() {
  const raw = localStorage.getItem("access_token");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

// ── Weekly Activity Summary ──

function WeeklyActivity({ role }) {
  // In production, these pull from real API. For now, derived from dashboard data.
  const activities = {
    agent: [
      { label: "Leads Worked", value: "—", icon: "🔥", target: "10/week" },
      { label: "Calls Made", value: "—", icon: "📞", target: "25/week" },
      { label: "Clients Signed", value: "—", icon: "✍️", target: "2/week" },
      { label: "Claims Filed", value: "—", icon: "📄", target: "1/week" },
    ],
    RVP: [
      { label: "Team Leads", value: "—", icon: "👥", target: "50/week" },
      { label: "Agent Check-ins", value: "—", icon: "📋", target: "5/week" },
      { label: "Recruits Contacted", value: "—", icon: "🤝", target: "3/week" },
      { label: "Override Revenue", value: "—", icon: "💰", target: "$500/week" },
    ],
    CP: [
      { label: "Territory Leads", value: "—", icon: "📊", target: "100/week" },
      { label: "RVP Check-ins", value: "—", icon: "📋", target: "3/week" },
      { label: "New Agents", value: "—", icon: "🆕", target: "1/month" },
      { label: "Territory Revenue", value: "—", icon: "💰", target: "$5K/week" },
    ],
  };

  const items = activities[role] || activities.agent;

  return (
    <div style={{
      position: "relative",
      padding: 0,
      background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 4px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px ${GREEN}10`,
    }}>
      {/* Top accent — green operational signal */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: GREEN,
        boxShadow: `0 0 8px ${GREEN}aa`,
        pointerEvents: "none",
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
          background: GREEN,
          boxShadow: `0 0 6px ${GREEN}cc`,
          display: "inline-block",
        }} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          Your ACI This Week
        </span>
        <span style={{ marginLeft: "auto", fontSize: 13 }}>📅</span>
      </div>
      <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map(item => (
          <div key={item.label} style={{
            padding: "12px",
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6,
            transition: "all 0.18s",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ ...mono, fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: 0.3, textShadow: `0 0 10px ${GREEN}30` }}>{item.value}</span>
            </div>
            <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 4, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>{item.label}</div>
            <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.30)", marginTop: 3, letterSpacing: 0.5 }}>Target: {item.target}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Streak Tracker ──

function StreakTracker() {
  // Days of current week, mock active days
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date().getDay(); // 0=Sun
  const dayIndex = today === 0 ? 6 : today - 1;

  return (
    <div style={{
      position: "relative",
      padding: 0,
      background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 4px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px rgba(255,109,0,0.12)`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "#FF6D00",
        boxShadow: "0 0 8px rgba(255,109,0,0.85)",
        pointerEvents: "none",
      }} />
      <div style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "10px 16px",
        background: "rgba(255,255,255,0.025)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: "#FF6D00",
          boxShadow: "0 0 6px rgba(255,109,0,0.85)",
          animation: "liveDotPulse 1.6s ease-in-out infinite",
          display: "inline-block",
        }} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          Activity Streak
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, color: GREEN, ...mono, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", padding: "2px 7px", background: `${GREEN}10`, border: `1px solid ${GREEN}40`, borderRadius: 3 }}>
          Today
        </span>
      </div>
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
          {days.map((d, i) => (
            <div key={i} style={{
              width: 34, height: 34, borderRadius: "50%",
              background: i <= dayIndex ? `${GREEN}22` : "rgba(255,255,255,0.025)",
              border: `2px solid ${i <= dayIndex ? GREEN : "rgba(255,255,255,0.08)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: i <= dayIndex ? GREEN : "rgba(255,255,255,0.30)", ...mono,
              boxShadow: i <= dayIndex ? `0 0 10px ${GREEN}40` : "none",
              transition: "all 0.2s",
            }}>
              {i < dayIndex ? "✓" : d}
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 0.3, lineHeight: 1.55 }}>
          Log in daily to maintain your streak. Consistent activity drives results.
        </div>
      </div>
    </div>
  );
}

// ── Milestone Progress ──

function MilestoneProgress({ role }) {
  const milestones = {
    agent: [
      { label: "First Client Signed", done: false, icon: "✍️" },
      { label: "5 Leads Worked", done: false, icon: "🔥" },
      { label: "First Claim Filed", done: false, icon: "📄" },
      { label: "Seminar Certified", done: false, icon: "🎓" },
      { label: "$10K Revenue", done: false, icon: "💰" },
    ],
    RVP: [
      { label: "First Agent Recruited", done: false, icon: "👥" },
      { label: "Team of 3 Agents", done: false, icon: "🏆" },
      { label: "First Override Earned", done: false, icon: "💰" },
      { label: "Seminar Certified", done: false, icon: "🎓" },
      { label: "$25K Team Revenue", done: false, icon: "📈" },
    ],
    CP: [
      { label: "Territory Activated", done: true, icon: "🗺️" },
      { label: "First RVP Recruited", done: false, icon: "👥" },
      { label: "10 Active Agents", done: false, icon: "🏆" },
      { label: "Seminar Certified", done: false, icon: "🎓" },
      { label: "$100K Territory Revenue", done: false, icon: "💰" },
    ],
  };

  const items = milestones[role] || milestones.agent;
  const completed = items.filter(m => m.done).length;
  const pct = Math.round((completed / items.length) * 100);

  return (
    <div style={{
      position: "relative",
      padding: 0,
      background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 4px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px ${GOLD}10`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: GOLD,
        boxShadow: `0 0 8px ${GOLD}aa`,
        pointerEvents: "none",
      }} />
      <div style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "10px 16px",
        background: "rgba(255,255,255,0.025)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: GOLD,
          boxShadow: `0 0 6px ${GOLD}cc`,
          display: "inline-block",
        }} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          Milestones
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", fontSize: 10, color: GOLD, ...mono, fontWeight: 800, letterSpacing: 1.2, padding: "2px 7px", background: `${GOLD}10`, border: `1px solid ${GOLD}40`, borderRadius: 3 }}>
          {completed}/{items.length}
        </span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        {/* Progress bar — instrument visualization */}
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: `linear-gradient(90deg, ${GOLD}88 0%, ${GOLD} 100%)`,
            boxShadow: `0 0 8px ${GOLD}aa`,
            borderRadius: 2, transition: "width 0.5s",
          }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {items.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, ...mono }}>
              <span style={{ fontSize: 14, opacity: m.done ? 0.7 : 1 }}>{m.done ? "✓" : m.icon}</span>
              <span style={{
                color: m.done ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.85)",
                textDecoration: m.done ? "line-through" : "none",
                fontWeight: 600, letterSpacing: 0.3,
              }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Network Position ──

function NetworkPosition({ role }) {
  const roleLabel = { agent: "Agent", RVP: "Regional VP", CP: "Chapter President" }[role] || "Member";

  return (
    <div style={{
      position: "relative",
      padding: 0,
      background: `linear-gradient(135deg, ${PURPLE}10 0%, ${PURPLE}02 60%, rgba(0,230,168,0.04) 100%)`,
      border: `1px solid ${PURPLE}28`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 4px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 22px ${PURPLE}14`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: PURPLE,
        boxShadow: `0 0 8px ${PURPLE}aa`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: -50, right: -50,
        width: 180, height: 180,
        background: `radial-gradient(circle, ${PURPLE}1c 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", gap: 9,
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: PURPLE,
          boxShadow: `0 0 6px ${PURPLE}cc`,
          display: "inline-block",
        }} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          Network Position
        </span>
        <span style={{ marginLeft: "auto", fontSize: 13 }}>🌐</span>
      </div>
      <div style={{ position: "relative", zIndex: 1, padding: "14px 16px" }}>
        <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.70)", lineHeight: 1.6, letterSpacing: 0.2 }}>
          You are a <strong style={{ color: PURPLE, textShadow: `0 0 12px ${PURPLE}55` }}>{roleLabel}</strong> in the Pax Equitas network.
          {role === "agent" && " Your upline RVP and CP support your growth. Focus on leads and client relationships."}
          {role === "RVP" && " You lead a team of agents. Your success multiplies through their performance."}
          {role === "CP" && " You own your territory. Build your team, grow your market, earn overrides on every transaction."}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px",
            background: `${PURPLE}1a`, border: `1px solid ${PURPLE}45`,
            borderRadius: 4,
            fontSize: 9, color: PURPLE, fontWeight: 800, letterSpacing: 1.4, ...mono,
            textTransform: "uppercase",
          }}>
            <span style={{
              width: 4, height: 4, borderRadius: 2,
              background: PURPLE, boxShadow: `0 0 5px ${PURPLE}`, animation: "liveDotPulse 1.6s ease-in-out infinite",
            }} />
            Active Member
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px",
            background: `${GREEN}1a`, border: `1px solid ${GREEN}45`,
            borderRadius: 4,
            fontSize: 9, color: GREEN, fontWeight: 800, letterSpacing: 1.4, ...mono,
            textTransform: "uppercase",
          }}>
            <span style={{
              width: 4, height: 4, borderRadius: 2,
              background: GREEN, boxShadow: `0 0 5px ${GREEN}`,
            }} />
            In Good Standing
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Export ──

export default function RetentionWidgets({ role }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
      <WeeklyActivity role={role} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <StreakTracker />
        <MilestoneProgress role={role} />
      </div>
      <NetworkPosition role={role} />
    </div>
  );
}
