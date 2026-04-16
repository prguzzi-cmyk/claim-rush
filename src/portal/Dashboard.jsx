import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── SHARED COMPONENTS ───────────────────────────────────────────────────────

function KPI({ label, value, color, alert }) {
  return (
    <div style={{ background: "#162238", border: `1px solid ${alert ? "#E0505030" : "rgba(255,255,255,0.12)"}`, borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 6, textShadow: `0 0 10px ${color}40` }}>{value}</div>
    </div>
  );
}

function Panel({ title, color, children, action, onAction }) {
  return (
    <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden" }}>
      {title && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {color && <span style={{ width: 7, height: 7, borderRadius: 4, background: color }} />}
            <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>{title}</span>
          </div>
          {action && <button onClick={onAction} style={{ padding: "4px 10px", background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.25)", borderRadius: 5, color: "#00E6A8", fontSize: 10, fontWeight: 700, cursor: "pointer", ...mono }}>{action}</button>}
        </div>
      )}
      <div style={{ padding: "14px 20px" }}>{children}</div>
    </div>
  );
}

function AttentionItem({ severity, text, sub }) {
  const c = severity === "high" ? "#E05050" : severity === "medium" ? C.gold : "rgba(255,255,255,0.45)";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: c, flexShrink: 0, marginTop: 4, boxShadow: severity === "high" ? `0 0 6px ${c}60` : "none" }} />
      <div>
        <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500 }}>{text}</div>
        {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function EarningsRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", ...mono }}>{label}</span>
      <span style={{ fontSize: 13, color: color || "#FFFFFF", ...mono, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ── EARNINGS PANEL (shared across roles) ────────────────────────────────────

function EarningsPanel({ role }) {
  const [tab, setTab] = useState("overview");
  const tabs = [{ key: "overview", label: "Overview" }, { key: "pending", label: "Pending" }, { key: "paid", label: "Paid" }];

  return (
    <Panel title="EARNINGS" color="#00E6A8">
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "5px 12px", borderRadius: 5,
            background: tab === t.key ? "rgba(0,230,168,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${tab === t.key ? "rgba(0,230,168,0.30)" : "rgba(255,255,255,0.08)"}`,
            color: tab === t.key ? "#00E6A8" : "rgba(255,255,255,0.55)",
            fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {role === "agent" && (
            <>
              <EarningsRow label="This Week" value="$1,420" color="#00E6A8" />
              <EarningsRow label="This Month" value="$2,840" />
              <EarningsRow label="Claims Commission" value="$1,950" />
              <EarningsRow label="Plan Sales" value="$890" />
            </>
          )}
          {role === "RVP" && (
            <>
              <EarningsRow label="Licensing Overrides" value="$400" color={PURPLE} />
              <EarningsRow label="Production Overrides" value="$520" color="#00E6A8" />
              <EarningsRow label="Direct Production" value="$3,400" />
              <EarningsRow label="Total This Month" value="$4,320" color="#FFFFFF" />
            </>
          )}
          {role === "CP" && (
            <>
              <EarningsRow label="Licensing Overrides" value="$625" color={PURPLE} />
              <EarningsRow label="Production Overrides" value="$1,000" color="#00E6A8" />
              <EarningsRow label="Direct Production" value="$3,840" />
              <EarningsRow label="Total This Month" value="$5,465" color="#FFFFFF" />
            </>
          )}
        </>
      )}
      {tab === "pending" && (
        <>
          <EarningsRow label="Available to Pay" value={role === "agent" ? "$948" : role === "RVP" ? "$760" : "$1,465"} color="#00E6A8" />
          <EarningsRow label="Awaiting Approval" value={role === "agent" ? "$478" : "$840"} color={C.gold} />
          <EarningsRow label="Next Payout" value="April 1, 2026" />
          <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.45)", ...mono }}>Payouts process bi-monthly via ACH</div>
        </>
      )}
      {tab === "paid" && (
        <>
          <EarningsRow label="Mar 18 Payout" value={role === "agent" ? "$1,598" : role === "RVP" ? "$1,970" : "$1,800"} />
          <EarningsRow label="Mar 3 Payout" value={role === "agent" ? "$880" : role === "RVP" ? "$780" : "$1,200"} />
          <EarningsRow label="Feb 18 Payout" value={role === "agent" ? "$720" : role === "RVP" ? "$640" : "$920"} />
          <EarningsRow label="Total YTD" value={role === "agent" ? "$3,198" : role === "RVP" ? "$3,390" : "$3,920"} color="#00E6A8" />
        </>
      )}
    </Panel>
  );
}

// ── AGENT DASHBOARD ─────────────────────────────────────────────────────────

function AgentDash({ navigate }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="New Leads" value="5" color={C.blue} />
        <KPI label="Follow-Ups Due" value="3" color={C.gold} alert />
        <KPI label="Earnings This Week" value="$1,420" color="#00E6A8" />
        <KPI label="Pending Payouts" value="$948" color={C.gold} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="WHAT NEEDS ATTENTION TODAY" color="#E05050">
            <AttentionItem severity="high" text="3 leads need follow-up" sub="Outreach sent 24+ hrs ago, no response" />
            <AttentionItem severity="high" text="1 agreement awaiting signature" sub="Park WTP Platinum — sent yesterday" />
            <AttentionItem severity="medium" text="2 new leads assigned" sub="Wildfire Alert — FL" />
            <AttentionItem severity="info" text="$948 payout available April 1" />
          </Panel>
          <Panel title="MY LEAD QUEUE" color="#00E6A8" action="VIEW ALL →" onAction={() => navigate("/portal/fire-leads")}>
            {[
              { name: "James Whitfield", detail: "Roof & Exterior · FL", action: "START OUTREACH", color: "#00E6A8" },
              { name: "Lisa Tran", detail: "Smoke & Ash · AZ · 96%", action: "SEND AGREEMENT", color: "#00E6A8" },
              { name: "Kevin Park", detail: "Roof & Windows · CO", action: "FOLLOW UP", color: C.gold },
              { name: "Natasha Williams", detail: "Flooding · LA", action: "IN FOLLOW-UP", color: PURPLE },
            ].map(l => (
              <div key={l.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }} onClick={() => navigate("/portal/fire-leads")}>
                <div>
                  <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono }}>{l.detail}</div>
                </div>
                <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, ...mono, background: `${l.color}12`, border: `1px solid ${l.color}30`, color: l.color }}>{l.action}</span>
              </div>
            ))}
          </Panel>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <EarningsPanel role="agent" />
          <Panel title="RECENT ACTIVITY" color="rgba(255,255,255,0.45)">
            {[
              { time: "2 hrs ago", text: "Whitfield Roof Claim closed — $710" },
              { time: "5 hrs ago", text: "Outreach sent to Derek Okafor" },
              { time: "Yesterday", text: "Park WTP Platinum agreement sent" },
              { time: "Yesterday", text: "Santos Multi-Unit claim filed" },
            ].map((a, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", ...mono }}>{a.time}</div>
                <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500, marginTop: 1 }}>{a.text}</div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}

// ── RVP DASHBOARD ───────────────────────────────────────────────────────────

function RVPDash({ navigate }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="Active Agents" value="6" color="#00E6A8" />
        <KPI label="Team Leads" value="24" color={C.blue} />
        <KPI label="Override Earnings" value="$920" color={PURPLE} />
        <KPI label="Pending Payouts" value="$760" color={C.gold} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="WHAT NEEDS ATTENTION TODAY" color="#E05050">
            <AttentionItem severity="high" text="David Kim — payment failed" sub="Card declined, needs update" />
            <AttentionItem severity="high" text="2 agents below quota this week" sub="David Kim, Tanya Brooks" />
            <AttentionItem severity="medium" text="1 agent in onboarding" sub="Jamal Foster — Day 3" />
            <AttentionItem severity="info" text="Team production up +12% this week" />
          </Panel>
          <Panel title="TEAM PERFORMANCE" color="#00E6A8">
            {[
              { name: "Priya Sharma", prod: "$4,200", status: "Top producer" },
              { name: "Alex Chen", prod: "$3,800", status: "Strong" },
              { name: "Carlos Vega", prod: "$3,100", status: "Growing" },
              { name: "Rachel Torres", prod: "$2,400", status: "On track" },
              { name: "David Kim", prod: "$1,200", status: "Needs coaching", alert: true },
            ].map(a => (
              <div key={a.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: a.alert ? "#E05050" : "rgba(255,255,255,0.45)", ...mono }}>{a.status}</div>
                </div>
                <span style={{ fontSize: 13, color: "#00E6A8", ...mono, fontWeight: 700 }}>{a.prod}</span>
              </div>
            ))}
          </Panel>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="AGENTS NEEDING HELP" color="#E05050">
            <AttentionItem severity="high" text="David Kim — low production" sub="$1,200 this month · below $2k target" />
            <AttentionItem severity="medium" text="Tanya Brooks — billing issue" sub="Suspended account · $1,500 outstanding" />
            <AttentionItem severity="info" text="Jamal Foster — new (trial)" sub="Onboarding Day 3 · no production yet" />
          </Panel>
          <EarningsPanel role="RVP" />
        </div>
      </div>
    </>
  );
}

// ── CP DASHBOARD ────────────────────────────────────────────────────────────

function CPDash({ territory, navigate }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="Territory Revenue" value="$42,400" color="#FFFFFF" />
        <KPI label="Active RVPs" value="3" color={C.gold} />
        <KPI label="Active Agents" value="14" color="#00E6A8" />
        <KPI label="Pending Payouts" value="$1,465" color={C.gold} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="WHAT NEEDS ATTENTION TODAY" color="#E05050">
            <AttentionItem severity="high" text="James Obi — $1,000 past due" sub="RVP · TX territory · 32 days" />
            <AttentionItem severity="medium" text="TX territory nearing capacity" sub="3/3 agents per RVP · consider expansion" />
            <AttentionItem severity="medium" text="GA territory — low agent count" sub="1 RVP, 4 agents · below density target" />
            <AttentionItem severity="info" text="Territory growth +16% this month" />
          </Panel>
          <Panel title="TERRITORY SNAPSHOT" color="#00E6A8">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Primary", value: territory.primaryState, color: "#00E6A8" },
                { label: "Expansion", value: territory.expansionStates.join(", ") || "None", color: C.gold },
                { label: "Licensing Rev", value: "$18,400", color: PURPLE },
                { label: "Production Rev", value: "$24,000", color: "#00E6A8" },
                { label: "Growth Rate", value: "+16%", color: "#00E6A8" },
                { label: "Health Score", value: "88%", color: "#00E6A8" },
              ].map(s => (
                <div key={s.label} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 15, color: s.color, ...mono, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="GROWTH GAPS" color={C.gold}>
            <AttentionItem severity="high" text="GA needs more agents" sub="4 agents · target 8 · recruit 4 more" />
            <AttentionItem severity="medium" text="No new RVPs this quarter" sub="Pipeline: 1 prospect in LA" />
            <AttentionItem severity="info" text="TX at capacity" sub="Consider opening adjacent state" />
          </Panel>
          <EarningsPanel role="CP" />
        </div>
      </div>
    </>
  );
}

// ── HOME OFFICE DASHBOARD ───────────────────────────────────────────────────

function HomeOfficeDash({ navigate }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="Revenue Pulse" value="$258K" color="#00E6A8" />
        <KPI label="Payout Actions" value="3" color={C.gold} alert />
        <KPI label="Billing Issues" value="3" color="#E05050" alert />
        <KPI label="At Risk" value="2" color="#E05050" />
      </div>

      {/* Smart summary */}
      <div style={{ padding: "14px 20px", marginBottom: 20, background: `${PURPLE}04`, border: `1px solid ${PURPLE}15`, borderRadius: 10 }}>
        <div style={{ fontSize: 14, color: "#FFFFFF", ...mono, fontWeight: 500, lineHeight: 1.7 }}>
          <span style={{ color: "#E05050", fontWeight: 700 }}>2 past due</span> — Obi $1K, Brooks $1.5K suspended.
          {" "}<span style={{ color: C.gold, fontWeight: 700 }}>PR-2026-009</span> awaiting approval ($3.9K, 1 held).
          {" "}AL territory <span style={{ color: "#E05050", fontWeight: 700 }}>has no RVPs</span>.
          {" "}Revenue <span style={{ color: "#00E6A8", fontWeight: 700 }}>+16%</span> this month.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="WHAT NEEDS ATTENTION TODAY" color="#E05050">
            <AttentionItem severity="high" text="Approve payout run PR-2026-009" sub="$3,885 gross · 12 items · 1 held" />
            <AttentionItem severity="high" text="David Kim — 4 access violations" sub="Repeated attempts at restricted routes" />
            <AttentionItem severity="high" text="Tanya Brooks — suspended" sub="$1,500 outstanding · card: None" />
            <AttentionItem severity="medium" text="James Obi — $1,000 past due" sub="32 days · autopay off" />
            <AttentionItem severity="medium" text="Alabama — no RVPs" sub="Declining health score (45%)" />
          </Panel>
          <Panel title="PAYOUT QUEUE" color={C.gold} action="OPEN →" onAction={() => navigate("/portal/payout-runs")}>
            <EarningsRow label="Pending Approval" value="$3,885" color={C.gold} />
            <EarningsRow label="Held Items" value="$1,140" color="#E05050" />
            <EarningsRow label="Ready to Pay" value="11 items" />
            <EarningsRow label="Last Run Paid" value="PR-2026-008 · $4,120" />
          </Panel>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="BILLING ALERTS" color="#E05050" action="OPEN →" onAction={() => navigate("/portal/billing")}>
            <AttentionItem severity="high" text="Tanya Brooks — suspended" sub="$1,500 · no card on file" />
            <AttentionItem severity="high" text="David Kim — payment failed" sub="$500 · card declined" />
            <AttentionItem severity="medium" text="James Obi — past due" sub="$1,000 · 32 days" />
            <AttentionItem severity="info" text="5 renewals this week" sub="All on autopay" />
          </Panel>
          <Panel title="TERRITORY PERFORMANCE" color="#00E6A8" action="VIEW →" onAction={() => navigate("/portal/territory-revenue")}>
            {[
              { terr: "CA", rev: "$64K", health: 88, color: "#00E6A8" },
              { terr: "TX", rev: "$54K", health: 85, color: "#00E6A8" },
              { terr: "FL", rev: "$42K", health: 92, color: "#00E6A8" },
              { terr: "AL", rev: "$5K", health: 45, color: "#E05050" },
            ].map(t => (
              <div key={t.terr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 14, color: "#FFFFFF", ...mono, fontWeight: 700, width: 28 }}>{t.terr}</span>
                <span style={{ fontSize: 13, color: "#00E6A8", ...mono, fontWeight: 700 }}>{t.rev}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 30, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
                    <div style={{ width: `${t.health}%`, height: "100%", borderRadius: 2, background: t.color }} />
                  </div>
                  <span style={{ fontSize: 11, color: t.color, ...mono, fontWeight: 600 }}>{t.health}</span>
                </div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { userRole, territory } = useAxisContext();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const titles = {
    agent: { title: "MY DASHBOARD", sub: "Leads, deals, and earnings" },
    RVP: { title: "TEAM COMMAND CENTER", sub: "Team performance, overrides, and recruiting" },
    CP: { title: "TERRITORY COMMAND CENTER", sub: "Territory revenue, team growth, and ownership" },
    home_office: { title: "OPERATIONS COMMAND CENTER", sub: "Revenue, payouts, billing, territories, and compliance" },
  };
  const t = titles[userRole] || titles.agent;

  return (
    <div style={{ maxWidth: 1100, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>{t.title}</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>{t.sub}</p>
      </div>

      {userRole === "agent" && <AgentDash navigate={navigate} />}
      {userRole === "RVP" && <RVPDash navigate={navigate} />}
      {userRole === "CP" && <CPDash territory={territory} navigate={navigate} />}
      {userRole === "home_office" && <HomeOfficeDash navigate={navigate} />}
    </div>
  );
}
