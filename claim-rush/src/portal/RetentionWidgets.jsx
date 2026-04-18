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
    <div style={{ padding: "20px", background: "#131A2E", border: "1px solid #1F2742", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>📅</span>
        <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: "#fff" }}>Your ACI This Week</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map(item => (
          <div key={item.label} style={{ padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ ...mono, fontSize: 18, fontWeight: 700, color: "#fff" }}>{item.value}</span>
            </div>
            <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{item.label}</div>
            <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>Target: {item.target}</div>
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
    <div style={{ padding: "20px", background: "#131A2E", border: "1px solid #1F2742", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>🔥</span>
        <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: "#fff" }}>Activity Streak</span>
        <span style={{ marginLeft: "auto", ...mono, fontSize: 12, color: GREEN, fontWeight: 700 }}>Today</span>
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
        {days.map((d, i) => (
          <div key={i} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: i <= dayIndex ? `${GREEN}20` : "rgba(255,255,255,0.03)",
            border: `2px solid ${i <= dayIndex ? GREEN : "rgba(255,255,255,0.08)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: i <= dayIndex ? GREEN : "rgba(255,255,255,0.3)", ...mono,
          }}>
            {i < dayIndex ? "✓" : d}
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", ...mono, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
        Log in daily to maintain your streak. Consistent activity drives results.
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
    <div style={{ padding: "20px", background: "#131A2E", border: "1px solid #1F2742", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>🏅</span>
        <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: "#fff" }}>Milestones</span>
        <span style={{ marginLeft: "auto", ...mono, fontSize: 12, color: GOLD }}>{completed}/{items.length}</span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: GOLD, borderRadius: 2, transition: "width 0.5s" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, ...mono }}>
            <span style={{ fontSize: 14 }}>{m.done ? "✅" : m.icon}</span>
            <span style={{ color: m.done ? "rgba(255,255,255,0.4)" : "#fff", textDecoration: m.done ? "line-through" : "none" }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Network Position ──

function NetworkPosition({ role }) {
  const roleLabel = { agent: "Agent", RVP: "Regional VP", CP: "Chapter President" }[role] || "Member";

  return (
    <div style={{ padding: "20px", background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.02))", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>🌐</span>
        <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: "#fff" }}>Your Network Position</span>
      </div>
      <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
        You are a <strong style={{ color: PURPLE }}>{roleLabel}</strong> in the Pax Equitas network.
        {role === "agent" && " Your upline RVP and CP support your growth. Focus on leads and client relationships."}
        {role === "RVP" && " You lead a team of agents. Your success multiplies through their performance."}
        {role === "CP" && " You own your territory. Build your team, grow your market, earn overrides on every transaction."}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <span style={{ padding: "3px 10px", background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 12, fontSize: 10, color: PURPLE, fontWeight: 700, ...mono }}>ACTIVE MEMBER</span>
        <span style={{ padding: "3px 10px", background: "rgba(0,230,168,0.1)", border: "1px solid rgba(0,230,168,0.25)", borderRadius: 12, fontSize: 10, color: GREEN, fontWeight: 700, ...mono }}>IN GOOD STANDING</span>
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
