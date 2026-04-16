import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "./theme";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

const ROLES = {
  company: { label: "COMPANY", fee: null, color: "#FFFFFF", desc: "Collects all licensing fees. Distributes overrides based on hierarchy.", icon: "🏢" },
  cp:      { label: "CP", fee: 2000, color: "#00E6A8", desc: "Channel Partner. Recruits and manages RVPs. Earns overrides on entire downline.", icon: "👔" },
  rvp:     { label: "RVP", fee: 1000, color: C.gold, desc: "Regional VP. Recruits agents. Earns overrides on agent fees + production.", icon: "📋" },
  agent:   { label: "AGENT", fee: 500, color: C.blue, desc: "Front-line seller. Earns direct production compensation on deals closed.", icon: "🎯" },
};

const EXAMPLES = [
  {
    title: "CP with 5 RVPs (4 agents each)",
    lines: [
      "5 RVPs × $1,000/mo × 10% override = $500/mo",
      "20 agents × $500/mo × 5% override = $500/mo",
      "Gross platform income = $1,000/mo",
      "CP fee = -$2,000/mo",
      "Net platform income = -$1,000/mo",
      "Production + team overrides fill the gap",
    ],
  },
  {
    title: "RVP with 10 agents",
    lines: [
      "10 agents × $500/mo × 8% override = $400/mo",
      "RVP fee = -$1,000/mo",
      "Net platform income = -$600/mo",
      "Direct production closes the gap fast",
    ],
  },
  {
    title: "Agent with direct production",
    lines: [
      "Agent fee = $500/mo",
      "5 plans sold × $130 avg commission = $650/mo",
      "3 claims × $800 avg commission = $2,400/mo",
      "Total production = $3,050/mo",
      "Net income = $3,050 - $500 = $2,550/mo",
    ],
  },
];

const PAYOUT_RULES = [
  "All licensing fees are collected by the company first.",
  "Overrides are distributed monthly based on active billing.",
  "Inactive or lapsed accounts do not generate override payouts.",
  "Production compensation is separate from platform licensing.",
  "Payouts depend on hierarchy position and account status.",
  "Override percentages are fixed per role level.",
  "No chargebacks on licensing — overrides stop if account cancels.",
];

const ROLE_SUMMARIES = [
  { role: "CP", color: "#00E6A8", icon: "👔", best: "Experienced operators who want to build a team of RVPs", earns: "10% override on RVP fees + 5% on agent fees + team production overrides", responsible: "Recruiting RVPs, training leadership, territory management, team performance" },
  { role: "RVP", color: C.gold, icon: "📋", best: "Sales leaders who want to recruit and manage a team of agents", earns: "8% override on agent fees + direct production + team overrides", responsible: "Recruiting agents, coaching, ensuring agent production, local market presence" },
  { role: "Agent", color: C.blue, icon: "🎯", best: "Individual producers focused on closing deals and serving clients", earns: "Direct commission on protection plans + claims signed", responsible: "Lead follow-up, client enrollment, claims support, plan renewals" },
  { role: "Company", color: "#FFFFFF", icon: "🏢", best: "Platform operator providing technology, leads, and infrastructure", earns: "All licensing fees minus distributed overrides", responsible: "Platform development, lead generation, compliance, adjuster network, support" },
];

// ── COMPONENT ───────────────────────────────────────────────────────────────

export default function CompPlan() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState("combined"); // licensing | production | combined
  const [expandedExample, setExpandedExample] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { setMounted(true); }, []);

  const panel = {
    background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  };

  const Arrow = ({ color = "rgba(255,255,255,0.25)", label, down = true }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 0" }}>
      {!down && <span style={{ fontSize: 14, color, lineHeight: 1 }}>▲</span>}
      <div style={{ width: 2, height: 20, background: color }} />
      {label && <span style={{ fontSize: 10, color, ...mono, fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>}
      {down && <span style={{ fontSize: 14, color, lineHeight: 1 }}>▼</span>}
    </div>
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      <style>{`
        @keyframes cpFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        marginBottom: 28,
        opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease",
      }}>
        <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>
          COMP PLAN VISUALIZER
        </h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono, lineHeight: 1.5 }}>
          See exactly how licensing fees and production compensation flow through the organization.
        </p>
      </div>

      {/* View toggles */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28 }}>
        {[
          { key: "licensing", label: "Licensing" },
          { key: "production", label: "Production" },
          { key: "combined", label: "Combined" },
        ].map((v, i) => (
          <button key={v.key} onClick={() => setView(v.key)} style={{
            padding: "8px 20px",
            background: view === v.key ? `${PURPLE}15` : "rgba(255,255,255,0.03)",
            border: `1px solid ${view === v.key ? `${PURPLE}40` : "rgba(255,255,255,0.08)"}`,
            borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : "0",
            borderLeft: i > 0 ? "none" : undefined,
            color: view === v.key ? PURPLE : "rgba(255,255,255,0.55)",
            fontSize: 12, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer", ...mono,
          }}>{v.label}</button>
        ))}
      </div>

      {/* ── HIERARCHY MAP ─────────────────────────────────────────────────────── */}
      <div style={{ ...panel, padding: "28px 32px", marginBottom: 28, animation: mounted ? "cpFadeUp 0.5s ease 0.1s both" : "none" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 20, ...mono, fontWeight: 600 }}>
          ORGANIZATIONAL HIERARCHY
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          {["company", "cp", "rvp", "agent"].map((key, i) => {
            const r = ROLES[key];
            return (
              <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  padding: "16px 28px", minWidth: 320, textAlign: "center",
                  background: `${r.color}08`, border: `1px solid ${r.color}25`, borderRadius: 10,
                  transition: "all 0.2s ease",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${r.color}50`; e.currentTarget.style.boxShadow = `0 0 16px ${r.color}15`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${r.color}25`; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{r.icon}</div>
                  <div style={{ fontSize: 15, color: r.color, fontWeight: 700, ...mono, letterSpacing: 1 }}>{r.label}</div>
                  {r.fee && <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600, marginTop: 4 }}>${r.fee.toLocaleString()}/mo</div>}
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500, marginTop: 4, lineHeight: 1.4 }}>{r.desc}</div>
                  {key !== "company" && (
                    <button onClick={() => navigate(`/portal/simulator?role=${key === "cp" ? "CP" : key === "rvp" ? "RVP" : "Agent"}`)} style={{
                      marginTop: 8, padding: "4px 12px", background: `${r.color}12`, border: `1px solid ${r.color}30`,
                      borderRadius: 5, color: r.color, fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono, transition: "all 0.2s",
                    }}>SIMULATE →</button>
                  )}
                </div>
                {i < 3 && <Arrow color={r.color} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MONEY FLOW LANES ──────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: (view === "combined" ? "1fr 1fr" : "1fr"), gap: 20, marginBottom: 28 }}>

        {/* Platform Licensing Flow */}
        {(view === "licensing" || view === "combined") && (
          <div style={{ ...panel, padding: "24px 28px", animation: mounted ? "cpFadeUp 0.5s ease 0.2s both" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: PURPLE }} />
              <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>PLATFORM LICENSING FLOW</span>
            </div>

            {/* Fees flow up */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center" }}>
              {[
                { label: "Agent", fee: "$500/mo", color: C.blue },
                { label: "RVP", fee: "$1,000/mo", color: C.gold },
                { label: "CP", fee: "$2,000/mo", color: "#00E6A8" },
              ].map((item, i) => (
                <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    padding: "10px 24px", minWidth: 200, textAlign: "center",
                    background: `${item.color}08`, border: `1px solid ${item.color}20`, borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 13, color: item.color, fontWeight: 700, ...mono }}>{item.label}</div>
                    <div style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 600, ...mono, marginTop: 2 }}>{item.fee}</div>
                  </div>
                  <Arrow color={item.color} label={`${item.fee} →`} down={false} />
                </div>
              ))}
              <div style={{
                padding: "12px 28px", textAlign: "center",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
              }}>
                <div style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono }}>🏢 COMPANY</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500, marginTop: 2 }}>Collects all fees</div>
              </div>

              {/* Overrides flow down */}
              <div style={{ marginTop: 16, width: "100%", padding: "14px 20px", background: `${PURPLE}06`, border: `1px solid ${PURPLE}15`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: PURPLE, letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 700, marginBottom: 8 }}>OVERRIDES (PAID DOWN)</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", ...mono, fontWeight: 500, lineHeight: 1.7 }}>
                  CP receives 10% of each RVP fee + 5% of each Agent fee<br />
                  RVP receives 8% of each Agent fee<br />
                  Agent receives no licensing override
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Production Compensation Flow */}
        {(view === "production" || view === "combined") && (
          <div style={{ ...panel, padding: "24px 28px", animation: mounted ? "cpFadeUp 0.5s ease 0.25s both" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: "#00E6A8" }} />
              <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>PRODUCTION COMPENSATION FLOW</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center" }}>
              {/* Deal source */}
              <div style={{
                padding: "12px 28px", textAlign: "center",
                background: "rgba(0,230,168,0.06)", border: "1px solid rgba(0,230,168,0.20)", borderRadius: 8,
              }}>
                <div style={{ fontSize: 13, color: "#00E6A8", fontWeight: 700, ...mono }}>CLIENT DEAL</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500, marginTop: 2 }}>Plan enrollment or claim signed</div>
              </div>

              <Arrow color="#00E6A8" label="Commission" />

              <div style={{
                padding: "10px 24px", minWidth: 200, textAlign: "center",
                background: `${C.blue}08`, border: `1px solid ${C.blue}20`, borderRadius: 8,
              }}>
                <div style={{ fontSize: 13, color: C.blue, fontWeight: 700, ...mono }}>AGENT</div>
                <div style={{ fontSize: 12, color: "#FFFFFF", ...mono, fontWeight: 500, marginTop: 2 }}>Direct production comp</div>
              </div>

              <Arrow color={C.gold} label="Team override" />

              <div style={{
                padding: "10px 24px", minWidth: 200, textAlign: "center",
                background: `${C.gold}08`, border: `1px solid ${C.gold}20`, borderRadius: 8,
              }}>
                <div style={{ fontSize: 13, color: C.gold, fontWeight: 700, ...mono }}>RVP</div>
                <div style={{ fontSize: 12, color: "#FFFFFF", ...mono, fontWeight: 500, marginTop: 2 }}>Override on agent production</div>
              </div>

              <Arrow color="#00E6A8" label="Optional override" />

              <div style={{
                padding: "10px 24px", minWidth: 200, textAlign: "center",
                background: "rgba(0,230,168,0.04)", border: "1px solid rgba(0,230,168,0.15)", borderRadius: 8,
              }}>
                <div style={{ fontSize: 13, color: "#00E6A8", fontWeight: 700, ...mono }}>CP</div>
                <div style={{ fontSize: 12, color: "#FFFFFF", ...mono, fontWeight: 500, marginTop: 2 }}>Team production override</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── EXAMPLE SCENARIOS ─────────────────────────────────────────────────── */}
      <div style={{ ...panel, padding: "24px 28px", marginBottom: 28, animation: mounted ? "cpFadeUp 0.5s ease 0.3s both" : "none" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, ...mono, fontWeight: 600 }}>
          EXAMPLE SCENARIOS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EXAMPLES.map((ex, i) => (
            <div key={i}>
              <button
                onClick={() => setExpandedExample(expandedExample === i ? null : i)}
                style={{
                  width: "100%", padding: "12px 16px", textAlign: "left",
                  background: expandedExample === i ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${expandedExample === i ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: expandedExample === i ? "8px 8px 0 0" : 8,
                  color: "#FFFFFF", fontSize: 14, fontWeight: 600, cursor: "pointer", ...mono,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  transition: "all 0.2s ease",
                }}
              >
                {ex.title}
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{expandedExample === i ? "▾" : "▸"}</span>
              </button>
              {expandedExample === i && (
                <div style={{
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderTop: "none", borderRadius: "0 0 8px 8px",
                }}>
                  {ex.lines.map((line, j) => {
                    const isResult = line.includes("=") && (line.includes("Net") || line.includes("Total") || line.includes("Gross"));
                    return (
                      <div key={j} style={{
                        fontSize: 13, color: isResult ? "#00E6A8" : line.startsWith("-") || line.includes("-$") ? "#E05050" : "rgba(255,255,255,0.75)",
                        ...mono, fontWeight: isResult ? 700 : 500, lineHeight: 1.8,
                      }}>
                        {line}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── PAYOUT RULES ──────────────────────────────────────────────────────── */}
      <div style={{ ...panel, padding: "24px 28px", marginBottom: 28, animation: mounted ? "cpFadeUp 0.5s ease 0.35s both" : "none" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, ...mono, fontWeight: 600 }}>
          PAYOUT RULES
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PAYOUT_RULES.map((rule, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", ...mono, fontWeight: 700, minWidth: 18 }}>{i + 1}.</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", ...mono, fontWeight: 500, lineHeight: 1.5 }}>{rule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ROLE SUMMARY CARDS ────────────────────────────────────────────────── */}
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, ...mono, fontWeight: 600 }}>
        ROLE SUMMARIES
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 28 }}>
        {ROLE_SUMMARIES.map(r => (
          <div key={r.role} style={{
            ...panel, padding: "22px 24px",
            animation: mounted ? "cpFadeUp 0.5s ease 0.4s both" : "none",
            transition: "all 0.2s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${r.color}30`; e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.4), 0 0 12px ${r.color}10`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>{r.icon}</span>
              <span style={{ fontSize: 15, color: r.color, fontWeight: 700, ...mono, letterSpacing: 1 }}>{r.role}</span>
            </div>
            {[
              { label: "BEST FOR", text: r.best },
              { label: "EARNS", text: r.earns },
              { label: "RESPONSIBLE FOR", text: r.responsible },
            ].map(section => (
              <div key={section.label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600, marginBottom: 3 }}>
                  {section.label}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", ...mono, fontWeight: 500, lineHeight: 1.5 }}>
                  {section.text}
                </div>
              </div>
            ))}
            {r.role !== "Company" && (
              <button
                onClick={() => navigate(`/portal/simulator?role=${r.role}`)}
                style={{
                  marginTop: 4, padding: "6px 14px", background: `${r.color}10`, border: `1px solid ${r.color}30`,
                  borderRadius: 6, color: r.color, fontSize: 12, fontWeight: 700, cursor: "pointer", ...mono,
                  transition: "all 0.2s",
                }}
              >
                SIMULATE THIS ROLE →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
