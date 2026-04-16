import { useState, useEffect, useCallback } from "react";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── DEFAULT RULE STATE ──────────────────────────────────────────────────────

const DEFAULT_RULES = {
  version: 3,
  publishedAt: "2026-03-15T10:00:00Z",
  publishedBy: "Admin",

  // Platform Licensing
  licensing: {
    CP:    { fee: 2000, promoFee: 1500, promoEnabled: false, promoStart: "", promoEnd: "", active: true, hidden: false },
    RVP:   { fee: 1000, promoFee: 750,  promoEnabled: false, promoStart: "", promoEnd: "", active: true, hidden: false },
    Agent: { fee: 500,  promoFee: 299,  promoEnabled: true,  promoStart: "2026-03-01", promoEnd: "2026-04-30", active: true, hidden: false },
  },

  // Licensing Overrides
  overrides: {
    cpOnRvp:    { enabled: true, pct: 10, start: "2026-01-01", end: "", activePaidOnly: true },
    rvpOnAgent: { enabled: true, pct: 8,  start: "2026-01-01", end: "", activePaidOnly: true },
    cpOnAgent:  { enabled: true, pct: 5,  start: "2026-01-01", end: "", activePaidOnly: true },
  },

  // Production Compensation
  production: {
    plans:  { closerPct: 20, rvpPct: 5, cpPct: 3, companyPct: 72, oneTimeBonus: true, recurring: true },
    claims: { adjusterPct: 10, agentPct: 15, rvpPct: 5, cpPct: 3, companyPct: 67, maxTotal: 100 },
    other:  { type: "percentage", amount: 10, eligibleRoles: ["Agent", "RVP"], serviceType: "Consulting" },
  },

  // Eligibility
  eligibility: {
    licensing: { mustBeActive: true, mustBeCurrent: true, parentActive: true, notSuspended: true, notCanceled: true },
    production: { dealClosed: true, paymentReceived: true, userAssigned: true, activeAtPayout: true, notBlocked: true },
  },

  // Hierarchy
  hierarchy: { cpOnRvps: true, rvpOnAgents: true, cpOnAgentsDirect: true, maxDepth: 3, fullDownline: false },

  // Payout Schedule
  schedule: { frequency: "monthly", delayDays: 15, clawbackDays: 90, minPayout: 50, holdFailedBilling: true, holdChargebacks: true },

  // Exceptions
  exceptions: [
    { id: 1, type: "user", target: "Marcus Lee", rule: "Reduced CP fee", value: "$1,500/mo", start: "2026-03-01", end: "2026-06-30", note: "Early adopter discount" },
    { id: 2, type: "territory", target: "FL", rule: "Bonus override", value: "+2%", start: "2026-04-01", end: "2026-04-30", note: "Florida storm season push" },
  ],
};

const AUDIT_LOG = [
  { id: 1, field: "Agent promo fee", oldVal: "$399", newVal: "$299", by: "Admin", at: "2026-03-28 14:22", note: "Q2 promotion" },
  { id: 2, field: "CP override on RVP", oldVal: "8%", newVal: "10%", by: "Admin", at: "2026-03-15 10:00", note: "v3 rule update" },
  { id: 3, field: "Clawback window", oldVal: "60 days", newVal: "90 days", by: "Admin", at: "2026-03-01 09:15", note: "Legal compliance" },
  { id: 4, field: "Agent fee", oldVal: "$450", newVal: "$500", by: "Admin", at: "2026-02-01 11:30", note: "v2 pricing adjustment" },
  { id: 5, field: "RVP on Agent override", oldVal: "6%", newVal: "8%", by: "Admin", at: "2026-01-15 16:45", note: "Incentive increase" },
];

// ── HELPERS ─────────────────────────────────────────────────────────────────

function Panel({ children, title, style: extraStyle, color }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
      border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)", marginBottom: 24, overflow: "hidden",
      ...extraStyle,
    }}>
      {title && (
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {color && <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />}
          <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>{title}</span>
        </div>
      )}
      <div style={{ padding: "20px 24px" }}>{children}</div>
    </div>
  );
}

function RuleRow({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", ...mono, fontWeight: 500 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 36, height: 20, borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
      background: value ? "#00E6A8" : "rgba(255,255,255,0.12)",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 2, left: value ? 18 : 2,
        width: 16, height: 16, borderRadius: 8,
        background: value ? "#002018" : "rgba(255,255,255,0.5)",
        transition: "all 0.2s",
      }} />
    </div>
  );
}

function NumInput({ value, onChange, prefix = "", suffix = "", width = 80 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {prefix && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", ...mono }}>{prefix}</span>}
      <input value={value} onChange={e => onChange(e.target.value)} style={{
        width, padding: "5px 10px", background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5,
        color: "#FFFFFF", fontSize: 13, ...mono, fontWeight: 600, outline: "none",
        textAlign: "right",
      }} />
      {suffix && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", ...mono }}>{suffix}</span>}
    </div>
  );
}

function DateInput({ value, onChange }) {
  return (
    <input type="date" value={value} onChange={e => onChange(e.target.value)} style={{
      padding: "4px 8px", background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5,
      color: "#FFFFFF", fontSize: 12, ...mono, outline: "none",
      colorScheme: "dark",
    }} />
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────

export default function PayoutRules() {
  const { permissions, userRole } = useAxisContext();
  const canEdit = permissions.canSeePayoutRules;
  const canPublish = permissions.canApprovePayouts;

  const [mounted, setMounted] = useState(false);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [tab, setTab] = useState("plans"); // plans | claims | other
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(null);
  useEffect(() => { setMounted(true); }, []);

  const set = useCallback((path, value) => {
    setRules(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return clone;
    });
  }, []);

  // Impact preview calculations
  const mockUsers = { CP: 4, RVP: 12, Agent: 45 };
  const totalLicensing = mockUsers.CP * rules.licensing.CP.fee + mockUsers.RVP * rules.licensing.RVP.fee + mockUsers.Agent * rules.licensing.Agent.fee;
  const totalOverrides = (rules.overrides.cpOnRvp.enabled ? mockUsers.RVP * rules.licensing.RVP.fee * rules.overrides.cpOnRvp.pct / 100 : 0) +
    (rules.overrides.rvpOnAgent.enabled ? mockUsers.Agent * rules.licensing.Agent.fee * rules.overrides.rvpOnAgent.pct / 100 : 0) +
    (rules.overrides.cpOnAgent.enabled ? mockUsers.Agent * rules.licensing.Agent.fee * rules.overrides.cpOnAgent.pct / 100 : 0);
  const companyRetained = totalLicensing - totalOverrides;

  const prodPlan = rules.production.plans;
  const prodClaim = rules.production.claims;
  const claimTotal = prodClaim.adjusterPct + prodClaim.agentPct + prodClaim.rvpPct + prodClaim.cpPct + prodClaim.companyPct;
  const claimWarning = claimTotal > 100;

  return (
    <div style={{ maxWidth: 1200, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
      <style>{`
        @keyframes prFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>PAYOUT RULES ENGINE</h1>
            <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>Control licensing fees, overrides, production compensation, and payout eligibility.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono }}>v{rules.version}</span>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono }}>Published {new Date(rules.publishedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
        {/* ── LEFT: Rules ──────────────────────────────────────────────────── */}
        <div>

          {/* 2. Platform Licensing */}
          <Panel title="PLATFORM LICENSING FEES" color={PURPLE}>
            {["CP", "RVP", "Agent"].map(role => {
              const r = rules.licensing[role];
              return (
                <div key={role} style={{ marginBottom: role !== "Agent" ? 20 : 0, paddingBottom: role !== "Agent" ? 16 : 0, borderBottom: role !== "Agent" ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  <div style={{ fontSize: 14, color: role === "CP" ? "#00E6A8" : role === "RVP" ? C.gold : C.blue, fontWeight: 700, ...mono, marginBottom: 8 }}>{role}</div>
                  <RuleRow label="Monthly Fee"><NumInput value={r.fee} onChange={v => set(`licensing.${role}.fee`, Number(v))} prefix="$" /></RuleRow>
                  <RuleRow label="Active"><Toggle value={r.active} onChange={v => set(`licensing.${role}.active`, v)} /></RuleRow>
                  <RuleRow label="Hidden"><Toggle value={r.hidden} onChange={v => set(`licensing.${role}.hidden`, v)} /></RuleRow>
                  <RuleRow label="Promo Pricing"><Toggle value={r.promoEnabled} onChange={v => set(`licensing.${role}.promoEnabled`, v)} /></RuleRow>
                  {r.promoEnabled && (
                    <>
                      <RuleRow label="Promo Fee"><NumInput value={r.promoFee} onChange={v => set(`licensing.${role}.promoFee`, Number(v))} prefix="$" /></RuleRow>
                      <RuleRow label="Promo Start"><DateInput value={r.promoStart} onChange={v => set(`licensing.${role}.promoStart`, v)} /></RuleRow>
                      <RuleRow label="Promo End"><DateInput value={r.promoEnd} onChange={v => set(`licensing.${role}.promoEnd`, v)} /></RuleRow>
                    </>
                  )}
                </div>
              );
            })}
          </Panel>

          {/* 3. Licensing Override Rules */}
          <Panel title="LICENSING OVERRIDE RULES" color={PURPLE}>
            {[
              { key: "cpOnRvp", label: "CP override on RVP licensing" },
              { key: "rvpOnAgent", label: "RVP override on Agent licensing" },
              { key: "cpOnAgent", label: "CP override on Agent licensing" },
            ].map(o => {
              const r = rules.overrides[o.key];
              return (
                <div key={o.key} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <RuleRow label={o.label}><Toggle value={r.enabled} onChange={v => set(`overrides.${o.key}.enabled`, v)} /></RuleRow>
                  {r.enabled && (
                    <>
                      <RuleRow label="Override %"><NumInput value={r.pct} onChange={v => set(`overrides.${o.key}.pct`, Number(v))} suffix="%" width={60} /></RuleRow>
                      <RuleRow label="Effective Start"><DateInput value={r.start} onChange={v => set(`overrides.${o.key}.start`, v)} /></RuleRow>
                      <RuleRow label="End Date"><DateInput value={r.end} onChange={v => set(`overrides.${o.key}.end`, v)} /></RuleRow>
                      <RuleRow label="Active paid only"><Toggle value={r.activePaidOnly} onChange={v => set(`overrides.${o.key}.activePaidOnly`, v)} /></RuleRow>
                    </>
                  )}
                </div>
              );
            })}
          </Panel>

          {/* 4. Production Compensation */}
          <Panel title="PRODUCTION COMPENSATION" color="#00E6A8">
            <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
              {["plans", "claims", "other"].map((t, i) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "7px 18px",
                  background: tab === t ? "rgba(0,230,168,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${tab === t ? "rgba(0,230,168,0.35)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : "0",
                  borderLeft: i > 0 ? "none" : undefined,
                  color: tab === t ? "#00E6A8" : "rgba(255,255,255,0.55)",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", ...mono,
                }}>{t === "plans" ? "Protection Plans" : t === "claims" ? "Claims" : "Other"}</button>
              ))}
            </div>

            {tab === "plans" && (
              <>
                <RuleRow label="Direct Closer %"><NumInput value={prodPlan.closerPct} onChange={v => set("production.plans.closerPct", Number(v))} suffix="%" width={60} /></RuleRow>
                <RuleRow label="RVP Override %"><NumInput value={prodPlan.rvpPct} onChange={v => set("production.plans.rvpPct", Number(v))} suffix="%" width={60} /></RuleRow>
                <RuleRow label="CP Override %"><NumInput value={prodPlan.cpPct} onChange={v => set("production.plans.cpPct", Number(v))} suffix="%" width={60} /></RuleRow>
                <RuleRow label="Company Retained %"><NumInput value={prodPlan.companyPct} onChange={v => set("production.plans.companyPct", Number(v))} suffix="%" width={60} /></RuleRow>
                <RuleRow label="One-Time Bonus"><Toggle value={prodPlan.oneTimeBonus} onChange={v => set("production.plans.oneTimeBonus", v)} /></RuleRow>
                <RuleRow label="Recurring Commission"><Toggle value={prodPlan.recurring} onChange={v => set("production.plans.recurring", v)} /></RuleRow>
              </>
            )}
            {tab === "claims" && (
              <>
                <RuleRow label="Handling Adjuster %"><NumInput value={prodClaim.adjusterPct} onChange={v => set("production.claims.adjusterPct", Number(v))} suffix="%" width={60} /></RuleRow>
                <RuleRow label="Sales Agent %"><NumInput value={prodClaim.agentPct} onChange={v => set("production.claims.agentPct", Number(v))} suffix="%" width={60} /></RuleRow>
                <RuleRow label="RVP Override %"><NumInput value={prodClaim.rvpPct} onChange={v => set("production.claims.rvpPct", Number(v))} suffix="%" width={60} /></RuleRow>
                <RuleRow label="CP Override %"><NumInput value={prodClaim.cpPct} onChange={v => set("production.claims.cpPct", Number(v))} suffix="%" width={60} /></RuleRow>
                <RuleRow label="Company Retained %"><NumInput value={prodClaim.companyPct} onChange={v => set("production.claims.companyPct", Number(v))} suffix="%" width={60} /></RuleRow>
                <RuleRow label="Max Total Allowed %"><NumInput value={prodClaim.maxTotal} onChange={v => set("production.claims.maxTotal", Number(v))} suffix="%" width={60} /></RuleRow>
                {claimWarning && (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(224,80,80,0.08)", border: "1px solid rgba(224,80,80,0.25)", borderRadius: 6, fontSize: 12, color: "#E05050", ...mono, fontWeight: 600 }}>
                    ⚠ Total claim allocation is {claimTotal}% — exceeds {prodClaim.maxTotal}% maximum
                  </div>
                )}
              </>
            )}
            {tab === "other" && (
              <>
                <RuleRow label="Type">
                  <select value={rules.production.other.type} onChange={e => set("production.other.type", e.target.value)} style={{
                    padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 5, color: "#FFFFFF", fontSize: 13, ...mono, outline: "none",
                  }}>
                    <option value="percentage">Percentage</option>
                    <option value="flat">Flat Amount</option>
                  </select>
                </RuleRow>
                <RuleRow label="Amount"><NumInput value={rules.production.other.amount} onChange={v => set("production.other.amount", Number(v))} suffix={rules.production.other.type === "percentage" ? "%" : ""} prefix={rules.production.other.type === "flat" ? "$" : ""} width={80} /></RuleRow>
                <RuleRow label="Service Type"><NumInput value={rules.production.other.serviceType} onChange={v => set("production.other.serviceType", v)} width={120} /></RuleRow>
              </>
            )}
          </Panel>

          {/* 5. Eligibility */}
          <Panel title="ELIGIBILITY RULES" color={C.gold}>
            <div style={{ fontSize: 12, color: PURPLE, fontWeight: 700, letterSpacing: 1, ...mono, marginBottom: 10 }}>LICENSING ELIGIBILITY</div>
            {Object.entries(rules.eligibility.licensing).map(([key, val]) => (
              <RuleRow key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}><Toggle value={val} onChange={v => set(`eligibility.licensing.${key}`, v)} /></RuleRow>
            ))}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "12px 0" }} />
            <div style={{ fontSize: 12, color: "#00E6A8", fontWeight: 700, letterSpacing: 1, ...mono, marginBottom: 10 }}>PRODUCTION ELIGIBILITY</div>
            {Object.entries(rules.eligibility.production).map(([key, val]) => (
              <RuleRow key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}><Toggle value={val} onChange={v => set(`eligibility.production.${key}`, v)} /></RuleRow>
            ))}
          </Panel>

          {/* 6. Hierarchy */}
          <Panel title="HIERARCHY RULES" color={C.blue}>
            <RuleRow label="CP earns on RVPs"><Toggle value={rules.hierarchy.cpOnRvps} onChange={v => set("hierarchy.cpOnRvps", v)} /></RuleRow>
            <RuleRow label="RVP earns on Agents"><Toggle value={rules.hierarchy.rvpOnAgents} onChange={v => set("hierarchy.rvpOnAgents", v)} /></RuleRow>
            <RuleRow label="CP earns on Agents directly"><Toggle value={rules.hierarchy.cpOnAgentsDirect} onChange={v => set("hierarchy.cpOnAgentsDirect", v)} /></RuleRow>
            <RuleRow label="Max hierarchy depth"><NumInput value={rules.hierarchy.maxDepth} onChange={v => set("hierarchy.maxDepth", Number(v))} width={50} /></RuleRow>
            <RuleRow label="Full downline (vs direct only)"><Toggle value={rules.hierarchy.fullDownline} onChange={v => set("hierarchy.fullDownline", v)} /></RuleRow>
          </Panel>

          {/* 8. Payout Schedule */}
          <Panel title="PAYOUT SCHEDULE" color={C.gold}>
            <RuleRow label="Frequency">
              <select value={rules.schedule.frequency} onChange={e => set("schedule.frequency", e.target.value)} style={{
                padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 5, color: "#FFFFFF", fontSize: 13, ...mono, outline: "none",
              }}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </RuleRow>
            <RuleRow label="Payout Delay"><NumInput value={rules.schedule.delayDays} onChange={v => set("schedule.delayDays", Number(v))} suffix=" days" width={60} /></RuleRow>
            <RuleRow label="Clawback Window"><NumInput value={rules.schedule.clawbackDays} onChange={v => set("schedule.clawbackDays", Number(v))} suffix=" days" width={60} /></RuleRow>
            <RuleRow label="Minimum Payout"><NumInput value={rules.schedule.minPayout} onChange={v => set("schedule.minPayout", Number(v))} prefix="$" width={70} /></RuleRow>
            <RuleRow label="Hold for Failed Billing"><Toggle value={rules.schedule.holdFailedBilling} onChange={v => set("schedule.holdFailedBilling", v)} /></RuleRow>
            <RuleRow label="Hold for Chargebacks"><Toggle value={rules.schedule.holdChargebacks} onChange={v => set("schedule.holdChargebacks", v)} /></RuleRow>
          </Panel>

          {/* 9. Exceptions */}
          <Panel title="EXCEPTION RULES" color="#E05050">
            {rules.exceptions.map((ex, i) => (
              <div key={ex.id} style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, ...mono, background: ex.type === "user" ? "rgba(42,112,208,0.12)" : `${C.gold}12`, border: `1px solid ${ex.type === "user" ? "rgba(42,112,208,0.25)" : `${C.gold}25`}`, color: ex.type === "user" ? C.blue : C.gold }}>{ex.type.toUpperCase()}</span>
                    <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, ...mono }}>{ex.target}</span>
                  </div>
                  <span style={{ fontSize: 13, color: "#00E6A8", fontWeight: 700, ...mono }}>{ex.value}</span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500 }}>
                  {ex.rule} · {ex.start} → {ex.end} · {ex.note}
                </div>
              </div>
            ))}
          </Panel>

          {/* 11. Audit Log */}
          <Panel title="RULE HISTORY" color="rgba(255,255,255,0.45)">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {AUDIT_LOG.map(log => (
                <div key={log.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{log.field}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono }}>{log.at} · {log.by}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#E05050", ...mono, fontWeight: 600, textDecoration: "line-through" }}>{log.oldVal}</div>
                  <div style={{ fontSize: 12, color: "#00E6A8", ...mono, fontWeight: 700 }}>{log.newVal}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500 }}>{log.note}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ── RIGHT: Sticky Summary + Actions ──────────────────────────────── */}
        <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
          {/* Impact Preview */}
          <Panel title="IMPACT PREVIEW" color="#00E6A8">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>AFFECTED USERS</div>
                <div style={{ fontSize: 22, color: "#FFFFFF", fontWeight: 700, ...mono }}>{mockUsers.CP + mockUsers.RVP + mockUsers.Agent}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono }}>{mockUsers.CP} CP · {mockUsers.RVP} RVP · {mockUsers.Agent} Agent</div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>MONTHLY LICENSING</div>
                <div style={{ fontSize: 20, color: "#FFFFFF", fontWeight: 700, ...mono }}>${totalLicensing.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>TOTAL OVERRIDES</div>
                <div style={{ fontSize: 20, color: PURPLE, fontWeight: 700, ...mono }}>-${Math.round(totalOverrides).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>COMPANY RETAINED</div>
                <div style={{ fontSize: 20, color: "#00E6A8", fontWeight: 700, ...mono }}>${Math.round(companyRetained).toLocaleString()}</div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600 }}>RETENTION RATE</div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                <div style={{ height: "100%", borderRadius: 3, width: `${Math.round((companyRetained / totalLicensing) * 100)}%`, background: "#00E6A8", transition: "width 0.4s ease" }} />
              </div>
              <div style={{ fontSize: 13, color: "#00E6A8", ...mono, fontWeight: 700 }}>{Math.round((companyRetained / totalLicensing) * 100)}%</div>

              {claimWarning && (
                <div style={{ padding: "8px 10px", background: "rgba(224,80,80,0.08)", border: "1px solid rgba(224,80,80,0.20)", borderRadius: 6, fontSize: 12, color: "#E05050", ...mono, fontWeight: 600 }}>
                  ⚠ Claims allocation exceeds max
                </div>
              )}
            </div>
          </Panel>

          {/* Actions */}
          <Panel>
            {canEdit ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => canEdit && setSaved("draft")} style={{
                  width: "100%", padding: "10px 0", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
                  color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer", ...mono,
                }}>SAVE DRAFT</button>
                <button onClick={() => canEdit && setShowPreview(true)} style={{
                  width: "100%", padding: "10px 0", background: `${PURPLE}12`,
                  border: `1px solid ${PURPLE}35`, borderRadius: 8,
                  color: PURPLE, fontSize: 13, fontWeight: 700, cursor: "pointer", ...mono,
                }}>PREVIEW IMPACT</button>
                {canPublish && (
                  <button onClick={() => setSaved("published")} style={{
                    width: "100%", padding: "12px 0",
                    background: "linear-gradient(90deg, #00C896, #00E6A8)",
                    border: "none", borderRadius: 8,
                    color: "#002018", fontSize: 14, fontWeight: 700, cursor: "pointer", ...mono,
                    boxShadow: "0 0 14px rgba(0,230,168,0.3)",
                  }}>PUBLISH RULES</button>
                )}
                <button onClick={() => canEdit && setRules(DEFAULT_RULES)} style={{
                  width: "100%", padding: "8px 0", background: "none",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                  color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 600, cursor: "pointer", ...mono,
                }}>REVERT TO v{rules.version}</button>
              </div>
            ) : (
              <div style={{ padding: "12px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono }}>
                Read-only access. Contact home office to modify rules.
              </div>
            )}
            {saved && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.20)", borderRadius: 6, fontSize: 12, color: "#00E6A8", ...mono, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                ✓ {saved === "draft" ? "Draft saved" : "Rules published"}
                <button onClick={() => setSaved(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
            )}
          </Panel>

          {/* Schema suggestion */}
          <Panel title="DATABASE SCHEMA" color="rgba(255,255,255,0.35)">
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500, lineHeight: 1.6 }}>
              payout_rule_sets<br />
              payout_rules<br />
              payout_exceptions<br />
              payout_audit_logs<br />
              payout_runs<br />
              payout_run_items
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
