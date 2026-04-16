import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

const SEV_COLORS = { critical: "#FF4444", high: "#E05050", medium: C.gold, info: "rgba(255,255,255,0.55)" };

function SevDot({ severity }) {
  const c = SEV_COLORS[severity] || SEV_COLORS.info;
  return <span style={{ width: 7, height: 7, borderRadius: 4, background: c, display: "inline-block", boxShadow: severity === "critical" || severity === "high" ? `0 0 6px ${c}60` : "none", flexShrink: 0 }} />;
}

function SevBadge({ severity }) {
  const c = SEV_COLORS[severity] || SEV_COLORS.info;
  return <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, ...mono, background: `${c}12`, border: `1px solid ${c}30`, color: c }}>{severity.toUpperCase()}</span>;
}

function KPI({ label, value, color, alert }) {
  return (
    <div style={{ background: "#162238", border: `1px solid ${alert ? `${SEV_COLORS.high}30` : "rgba(255,255,255,0.12)"}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 4, textShadow: `0 0 10px ${color}40` }}>{value}</div>
    </div>
  );
}

function Panel({ title, color, children, action, onAction, severity }) {
  return (
    <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: `1px solid ${severity === "high" || severity === "critical" ? `${SEV_COLORS[severity]}20` : "rgba(255,255,255,0.10)"}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {color && <span style={{ width: 7, height: 7, borderRadius: 4, background: color }} />}
          <span style={{ fontSize: 12, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>{title}</span>
        </div>
        {action && <button onClick={onAction} style={{ padding: "3px 10px", background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.25)", borderRadius: 5, color: "#00E6A8", fontSize: 10, fontWeight: 700, cursor: "pointer", ...mono }}>{action}</button>}
      </div>
      <div style={{ padding: "12px 20px" }}>{children}</div>
    </div>
  );
}

function AlertRow({ severity, text, sub, action, onAction }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <SevDot severity={severity} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500 }}>{text}</div>
        {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono, marginTop: 1 }}>{sub}</div>}
      </div>
      {action && <button onClick={onAction} style={{ padding: "2px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 4, color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 600, cursor: "pointer", ...mono, flexShrink: 0 }}>{action}</button>}
    </div>
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────

export default function HomeOfficeOps() {
  const { permissions } = useAxisContext();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!permissions.canSeePayoutRules) {
    return <div style={{ padding: 40, textAlign: "center", fontSize: 16, color: "#E05050", ...mono }}>Access denied. Home office only.</div>;
  }

  const go = (path) => navigate(path);

  return (
    <div style={{ maxWidth: 1200, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
      <style>{`@keyframes hoFade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>HOME OFFICE OPERATIONS</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>Daily command center for payouts, billing, territory performance, recruiting, and compliance.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Revenue Today" value="$8,420" color="#00E6A8" />
        <KPI label="Payout Actions" value="3" color={C.gold} alert />
        <KPI label="Past Due" value="2" color="#E05050" alert />
        <KPI label="Compliance" value="2" color={C.gold} alert />
        <KPI label="At Risk" value="1" color="#E05050" />
        <KPI label="New Today" value="4" color="#00E6A8" />
      </div>

      {/* Smart summary */}
      <div style={{ padding: "16px 20px", marginBottom: 20, background: "rgba(168,85,247,0.04)", border: `1px solid ${PURPLE}15`, borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: PURPLE }} />
          <span style={{ fontSize: 12, color: PURPLE, fontWeight: 700, letterSpacing: 1, ...mono }}>DAILY BRIEFING</span>
        </div>
        <div style={{ fontSize: 14, color: "#FFFFFF", ...mono, fontWeight: 500, lineHeight: 1.7 }}>
          <span style={{ color: "#E05050", fontWeight: 700 }}>2 past due accounts</span> need attention — James Obi ($1,000) and Tanya Brooks ($1,500 suspended).
          {" "}<span style={{ color: C.gold, fontWeight: 700 }}>Payout run PR-2026-009</span> is awaiting approval with $3,885 gross and 1 held item.
          {" "}<span style={{ color: C.gold, fontWeight: 700 }}>2 compliance items</span> are open — David Kim has 4 access violations.
          {" "}Alabama territory has <span style={{ color: "#E05050", fontWeight: 700 }}>no RVPs and declining health</span>.
          {" "}Revenue is tracking <span style={{ color: "#00E6A8", fontWeight: 700 }}>+16% this month</span>.
        </div>
      </div>

      {/* Main grid: 3 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Priority queue */}
        <Panel title="PRIORITY QUEUE" color="#E05050" severity="high">
          {[
            { sev: "high", text: "Approve payout run PR-2026-009", sub: "$3,885 gross · 1 held", cat: "Payouts" },
            { sev: "high", text: "Review David Kim access violations", sub: "4 attempts in 48hrs", cat: "Compliance" },
            { sev: "medium", text: "Contact James Obi — past due", sub: "$1,000 · 32 days", cat: "Billing" },
            { sev: "medium", text: "Fill Alabama territory gap", sub: "No RVP, declining health", cat: "Territory" },
            { sev: "info", text: "Onboard Nina Patel (new RVP)", sub: "TN territory", cat: "Recruiting" },
          ].map((item, i) => <AlertRow key={i} severity={item.sev} text={item.text} sub={`${item.cat} · ${item.sub}`} />)}
        </Panel>

        {/* Payout watch */}
        <Panel title="PAYOUT WATCH" color={C.gold} action="OPEN →" onAction={() => go("/portal/payout-runs")}>
          <AlertRow severity="high" text="PR-2026-009 awaiting approval" sub="$3,885 gross · 12 line items" action="REVIEW" onAction={() => go("/portal/payout-runs")} />
          <AlertRow severity="medium" text="1 item held" sub="$1,140 — pending claim verification" />
          <AlertRow severity="medium" text="1 manual adjustment" sub="Rachel Torres -$58 (trial)" />
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[{ label: "Queue", value: "$4,885", color: C.gold }, { label: "Held", value: "$1,140", color: "#E05050" }].map(s => (
              <div key={s.label} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", ...mono }}>{s.label}</div>
                <div style={{ fontSize: 16, color: s.color, fontWeight: 700, ...mono }}>{s.value}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Billing risk */}
        <Panel title="BILLING RISK" color="#E05050" action="OPEN →" onAction={() => go("/portal/billing")}>
          <AlertRow severity="high" text="Tanya Brooks — suspended" sub="$1,500 outstanding · card: None" action="VIEW" onAction={() => go("/portal/billing")} />
          <AlertRow severity="high" text="James Obi — past due" sub="$1,000 · 32 days · autopay off" action="RETRY" />
          <AlertRow severity="medium" text="David Kim — failed payment" sub="Card declined · $500" action="RETRY" />
          <AlertRow severity="info" text="5 renewals this week" sub="All on autopay" />
        </Panel>
      </div>

      {/* Second row: Territory + Recruiting + Compliance */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Territory alerts */}
        <Panel title="TERRITORY ALERTS" color="#E05050" action="MAP →" onAction={() => go("/portal/territory-revenue")}>
          {[
            { terr: "AL", issue: "No RVPs, declining health", sev: "high", action: "Recruit RVP" },
            { terr: "LA", issue: "Low agent density (3)", sev: "medium", action: "Recruit agents" },
            { terr: "NV", issue: "Unassigned — no CP", sev: "medium", action: "Assign CP" },
            { terr: "SC", issue: "Unassigned — no CP", sev: "medium", action: "Assign CP" },
          ].map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <SevDot severity={t.sev} />
              <span style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 700, ...mono, width: 28 }}>{t.terr}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono, flex: 1 }}>{t.issue}</span>
              <span style={{ fontSize: 10, color: "#00E6A8", ...mono, fontWeight: 600 }}>{t.action}</span>
            </div>
          ))}
        </Panel>

        {/* Recruiting */}
        <Panel title="RECRUITING + GROWTH" color="#00E6A8">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { label: "New CPs (pipeline)", value: "2", color: "#00E6A8" },
              { label: "New RVPs (month)", value: "3", color: C.gold },
              { label: "New Agents (month)", value: "8", color: C.blue },
              { label: "Open Territories", value: "4", color: "#E05050" },
            ].map(s => (
              <div key={s.label} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", ...mono, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 16, color: s.color, fontWeight: 700, ...mono, marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <AlertRow severity="info" text="Nina Patel onboarding (RVP — TN)" sub="Started 2026-03-22" />
          <AlertRow severity="info" text="Jamal Foster trial (Agent)" sub="Started 2026-03-28" />
        </Panel>

        {/* Compliance snapshot */}
        <Panel title="COMPLIANCE" color={C.gold} action="AUDIT →" onAction={() => go("/portal/audit")}>
          <AlertRow severity="high" text="David Kim — 4 access violations" sub="Repeated route/API attempts" action="REVIEW" onAction={() => go("/portal/audit")} />
          <AlertRow severity="medium" text="James Obi billing override" sub="Manual fee waiver applied" />
          <AlertRow severity="medium" text="Tanya Brooks suspension" sub="Review outstanding + reinstatement" />
          <AlertRow severity="info" text="Agent promo fee changed" sub="$399 → $299 (Q2 promo)" />
        </Panel>
      </div>

      {/* Third row: Revenue pulse + Team spotlight + Follow-ups */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Revenue pulse */}
        <Panel title="REVENUE PULSE" color="#00E6A8">
          {[
            { label: "Billed Today", value: "$8,420", color: "#FFFFFF" },
            { label: "Collected Today", value: "$7,200", color: "#00E6A8" },
            { label: "Projected This Month", value: "$258,300", color: "#00E6A8" },
            { label: "Pending Payouts", value: "$4,885", color: C.gold },
            { label: "Retained Estimate", value: "$46,480", color: "#00E6A8" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono }}>{r.label}</span>
              <span style={{ fontSize: 13, color: r.color, ...mono, fontWeight: 700 }}>{r.value}</span>
            </div>
          ))}
        </Panel>

        {/* Team spotlight */}
        <Panel title="PERFORMANCE SPOTLIGHT" color={PURPLE}>
          {[
            { label: "Top CP", value: "Sarah Kim", stat: "$42,400 territory rev", color: "#00E6A8" },
            { label: "Top RVP", value: "Marcus Lee", stat: "$8,200 production", color: C.gold },
            { label: "Top Agent", value: "Priya Sharma", stat: "$4,200 this month", color: C.blue },
            { label: "Most Improved", value: "GA territory", stat: "+22% growth", color: "#00E6A8" },
            { label: "Needs Attention", value: "AL territory", stat: "45% health score", color: "#E05050" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono }}>{r.label}</div>
                <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{r.value}</div>
              </div>
              <span style={{ fontSize: 11, color: r.color, ...mono, fontWeight: 600 }}>{r.stat}</span>
            </div>
          ))}
        </Panel>

        {/* Follow-ups */}
        <Panel title="FOLLOW-UPS" color="rgba(255,255,255,0.55)">
          <AlertRow severity="medium" text="Payout hold — notify James Obi" sub="$1,140 held · Santos claim" />
          <AlertRow severity="info" text="Billing reminder — David Kim" sub="$500 failed · card update needed" />
          <AlertRow severity="info" text="Onboarding check-in — Nina Patel" sub="Day 7 · TN territory" />
          <AlertRow severity="info" text="Trial review — Rachel Torres" sub="End of trial period approaching" />
          <AlertRow severity="info" text="Territory pitch — NV prospect" sub="Follow up on CP interest" />
        </Panel>
      </div>

      {/* Quick-launch bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "16px 20px", background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
        {[
          { label: "Review Payouts", path: "/portal/payout-runs", color: C.gold },
          { label: "Open Billing", path: "/portal/billing", color: "#E05050" },
          { label: "Compliance Queue", path: "/portal/audit", color: C.gold },
          { label: "Territory Revenue", path: "/portal/territory-revenue", color: "#00E6A8" },
          { label: "Launch Pitch", path: "/portal/pitch?mode=cp", color: PURPLE },
          { label: "Revenue Forecast", path: "/portal/forecast", color: "#00E6A8" },
        ].map(btn => (
          <button key={btn.label} onClick={() => go(btn.path)} style={{
            padding: "8px 18px", background: `${btn.color}10`, border: `1px solid ${btn.color}30`,
            borderRadius: 8, color: btn.color, fontSize: 12, fontWeight: 700,
            cursor: "pointer", ...mono, transition: "all 0.2s",
          }}>{btn.label}</button>
        ))}
      </div>
    </div>
  );
}
