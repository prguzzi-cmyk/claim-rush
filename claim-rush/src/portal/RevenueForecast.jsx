import { useState, useEffect, useMemo } from "react";
import { C } from "./theme";
// NOTE: Route-level protection via RequireRole in App.jsx ensures only home_office can access.
// Server-side: GET /api/forecast must validate role === "home_office" before returning data.

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── DEFAULTS ────────────────────────────────────────────────────────────────

const SCENARIOS = {
  conservative: { newRvps: 1, newAgents: 3, agentsPerRvp: 3, avgProdPerAgent: 2200, planRate: 0.12, claimRate: 0.08, avgClaimValue: 12000, overhead: 15000 },
  target:       { newRvps: 2, newAgents: 6, agentsPerRvp: 5, avgProdPerAgent: 3500, planRate: 0.18, claimRate: 0.12, avgClaimValue: 16000, overhead: 15000 },
  aggressive:   { newRvps: 4, newAgents: 12, agentsPerRvp: 6, avgProdPerAgent: 5000, planRate: 0.25, claimRate: 0.18, avgClaimValue: 22000, overhead: 15000 },
};

const CURRENT = { cps: 5, rvps: 12, agents: 45, territories: 10 };
const CP_FEE = 2000, RVP_FEE = 1000, AGENT_FEE = 500;
const PAYOUT_RATES = { cpLicense: 0.12, rvpLicense: 0.08, agentProd: 0.20, rvpProd: 0.05, cpProd: 0.03 };

// ── FORECAST ENGINE ─────────────────────────────────────────────────────────

function forecast(inputs, months) {
  const result = [];
  let rvps = CURRENT.rvps, agents = CURRENT.agents, cps = CURRENT.cps;

  for (let m = 1; m <= months; m++) {
    rvps += inputs.newRvps;
    agents += inputs.newAgents;
    if (m % 3 === 0) cps += 1; // new CP every quarter

    const licensingRev = cps * CP_FEE + rvps * RVP_FEE + agents * AGENT_FEE;
    const planRev = agents * inputs.avgProdPerAgent * inputs.planRate;
    const claimRev = agents * inputs.claimRate * inputs.avgClaimValue;
    const productionRev = planRev + claimRev;
    const totalRev = licensingRev + productionRev;

    const cpPayout = rvps * RVP_FEE * PAYOUT_RATES.cpLicense + agents * AGENT_FEE * PAYOUT_RATES.cpLicense;
    const rvpPayout = agents * AGENT_FEE * PAYOUT_RATES.rvpLicense;
    const agentPayout = productionRev * PAYOUT_RATES.agentProd;
    const rvpProdPayout = productionRev * PAYOUT_RATES.rvpProd;
    const cpProdPayout = productionRev * PAYOUT_RATES.cpProd;
    const totalPayouts = cpPayout + rvpPayout + agentPayout + rvpProdPayout + cpProdPayout;

    const retained = totalRev - totalPayouts;
    const netAfterOverhead = retained - inputs.overhead;

    result.push({
      month: m, rvps, agents, cps,
      licensingRev: Math.round(licensingRev),
      productionRev: Math.round(productionRev),
      planRev: Math.round(planRev),
      claimRev: Math.round(claimRev),
      totalRev: Math.round(totalRev),
      cpPayout: Math.round(cpPayout + cpProdPayout),
      rvpPayout: Math.round(rvpPayout + rvpProdPayout),
      agentPayout: Math.round(agentPayout),
      totalPayouts: Math.round(totalPayouts),
      retained: Math.round(retained),
      netAfterOverhead: Math.round(netAfterOverhead),
      margin: totalRev > 0 ? Math.round((retained / totalRev) * 100) : 0,
    });
  }
  return result;
}

// ── SLIDER ──────────────────────────────────────────────────────────────────

function Slider({ label, value, onChange, min, max, step = 1, prefix = "", suffix = "", isPct }) {
  const display = isPct ? `${Math.round(value * 100)}%` : `${prefix}${typeof value === "number" ? value.toLocaleString() : value}${suffix}`;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 700 }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(isPct ? parseFloat(e.target.value) : Number(e.target.value))}
        style={{ width: "100%", accentColor: "#00E6A8", height: 4, cursor: "pointer" }} />
    </div>
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────

export default function RevenueForecast() {
  const [mounted, setMounted] = useState(false);
  const [scenario, setScenario] = useState("target");
  const [inputs, setInputs] = useState(SCENARIOS.target);
  const [range, setRange] = useState(12);
  const [sensitivityVar, setSensitivityVar] = useState("newAgents");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setInputs({ ...SCENARIOS[scenario] }); }, [scenario]);

  const set = (k, v) => setInputs(prev => ({ ...prev, [k]: v }));
  const data = useMemo(() => forecast(inputs, range), [inputs, range]);
  const last = data[data.length - 1] || {};
  const first = data[0] || {};
  const growthRate = first.totalRev > 0 ? Math.round(((last.totalRev - first.totalRev) / first.totalRev) * 100) : 0;
  const breakEvenMonth = data.findIndex(d => d.netAfterOverhead > 0) + 1;
  const maxRev = Math.max(...data.map(d => d.totalRev), 1);

  // Sensitivity: vary one input ±30%
  const sensBase = inputs[sensitivityVar];
  const sensLow = forecast({ ...inputs, [sensitivityVar]: sensBase * 0.7 }, range);
  const sensHigh = forecast({ ...inputs, [sensitivityVar]: sensBase * 1.3 }, range);
  const sensLastLow = sensLow[sensLow.length - 1] || {};
  const sensLastHigh = sensHigh[sensHigh.length - 1] || {};

  // Risks
  const risks = [];
  if (last.margin < 50) risks.push({ msg: `Margin at ${last.margin}% — below 50% target`, severity: "high" });
  if (last.totalPayouts > last.retained) risks.push({ msg: "Payout liability exceeds retained revenue", severity: "high" });
  if (last.margin < 65 && last.margin >= 50) risks.push({ msg: `Margin at ${last.margin}% — monitor closely`, severity: "medium" });
  if (growthRate < 20) risks.push({ msg: `Growth rate ${growthRate}% — below 20% target`, severity: "medium" });
  if (breakEvenMonth === 0) risks.push({ msg: "Break-even not reached within forecast period", severity: "high" });

  return (
    <div style={{ maxWidth: 1200, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
      <style>{`
        @keyframes rfFade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        input[type=range] { -webkit-appearance: none; background: rgba(255,255,255,0.08); border-radius: 2px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 7px; background: #00E6A8; cursor: pointer; box-shadow: 0 0 6px rgba(0,230,168,0.4); }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>EXECUTIVE REVENUE FORECAST</h1>
          <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>Strategic projections for revenue, payouts, and retained margin.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Scenario */}
          <div style={{ display: "flex", gap: 0 }}>
            {["conservative", "target", "aggressive"].map((s, i) => (
              <button key={s} onClick={() => setScenario(s)} style={{
                padding: "7px 16px", background: scenario === s ? `${PURPLE}15` : "rgba(255,255,255,0.03)",
                border: `1px solid ${scenario === s ? `${PURPLE}40` : "rgba(255,255,255,0.08)"}`,
                borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : "0",
                borderLeft: i > 0 ? "none" : undefined,
                color: scenario === s ? PURPLE : "rgba(255,255,255,0.55)",
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer", ...mono,
              }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
          {/* Range */}
          <div style={{ display: "flex", gap: 0 }}>
            {[3, 6, 12].map((r, i) => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: "7px 14px", background: range === r ? "rgba(0,230,168,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${range === r ? "rgba(0,230,168,0.35)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : "0",
                borderLeft: i > 0 ? "none" : undefined,
                color: range === r ? "#00E6A8" : "rgba(255,255,255,0.55)",
                fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono,
              }}>{r}mo</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Proj. Monthly Rev", value: `$${last.totalRev?.toLocaleString()}`, color: "#FFFFFF" },
          { label: "Company Retained", value: `$${last.retained?.toLocaleString()}`, color: "#00E6A8" },
          { label: "Total Payouts", value: `$${last.totalPayouts?.toLocaleString()}`, color: C.gold },
          { label: "Net Margin", value: `${last.margin}%`, color: last.margin >= 60 ? "#00E6A8" : last.margin >= 50 ? C.gold : "#E05050" },
          { label: "Territories", value: CURRENT.territories, color: PURPLE },
          { label: "Growth", value: `+${growthRate}%`, color: growthRate >= 20 ? "#00E6A8" : C.gold },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#162238", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 4, textShadow: `0 0 10px ${kpi.color}40` }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, marginBottom: 24 }}>
        <div>
          {/* Revenue forecast chart */}
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1, marginBottom: 16 }}>REVENUE PROJECTION</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 160 }}>
              {data.map((d, i) => {
                const licH = Math.round((d.licensingRev / maxRev) * 140);
                const prodH = Math.round((d.productionRev / maxRev) * 140);
                const retH = Math.round((d.retained / maxRev) * 140);
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", ...mono }}>{d.totalRev >= 1000 ? `${Math.round(d.totalRev / 1000)}k` : d.totalRev}</span>
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 140 }}>
                      <div style={{ width: "100%", height: prodH, background: "#00E6A8", borderRadius: "2px 2px 0 0", transition: "height 0.3s" }} />
                      <div style={{ width: "100%", height: licH, background: PURPLE, transition: "height 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", ...mono }}>{d.month}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              {[{ color: PURPLE, label: "Licensing" }, { color: "#00E6A8", label: "Production" }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 4, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Forecast breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* Licensing */}
            <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600, marginBottom: 10 }}>LICENSING (Mo. {range})</div>
              {[
                { label: `${last.cps} CPs × $${CP_FEE}`, value: last.cps * CP_FEE, color: PURPLE },
                { label: `${last.rvps} RVPs × $${RVP_FEE}`, value: last.rvps * RVP_FEE, color: PURPLE },
                { label: `${last.agents} Agents × $${AGENT_FEE}`, value: last.agents * AGENT_FEE, color: PURPLE },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: r.color, ...mono, fontWeight: 700 }}>${r.value.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 13, color: PURPLE, ...mono, fontWeight: 700 }}>${last.licensingRev?.toLocaleString()}</span>
              </div>
            </div>

            {/* Production */}
            <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600, marginBottom: 10 }}>PRODUCTION (Mo. {range})</div>
              {[
                { label: "Protection Plans", value: last.planRev, color: "#00E6A8" },
                { label: "Claims", value: last.claimRev, color: "#00E6A8" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: r.color, ...mono, fontWeight: 700 }}>${r.value?.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 13, color: "#00E6A8", ...mono, fontWeight: 700 }}>${last.productionRev?.toLocaleString()}</span>
              </div>
            </div>

            {/* Payouts */}
            <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600, marginBottom: 10 }}>PAYOUTS (Mo. {range})</div>
              {[
                { label: "CP Payouts", value: last.cpPayout, color: C.gold },
                { label: "RVP Payouts", value: last.rvpPayout, color: C.gold },
                { label: "Agent Payouts", value: last.agentPayout, color: C.gold },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: r.color, ...mono, fontWeight: 700 }}>${r.value?.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 13, color: C.gold, ...mono, fontWeight: 700 }}>${last.totalPayouts?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Break-even + Sensitivity + Risks */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Break-even */}
            <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: `1px solid ${breakEvenMonth > 0 ? "rgba(0,230,168,0.20)" : "rgba(255,255,255,0.10)"}`, borderRadius: 10, padding: "20px 24px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600, marginBottom: 10 }}>BREAK-EVEN ANALYSIS</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 28, color: breakEvenMonth > 0 ? "#00E6A8" : "#E05050", fontWeight: 700, ...mono }}>
                  {breakEvenMonth > 0 ? `Month ${breakEvenMonth}` : "Not reached"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500, marginBottom: 8 }}>
                Overhead: ${inputs.overhead.toLocaleString()}/mo
              </div>
              <Slider label="Monthly Overhead" value={inputs.overhead} onChange={v => set("overhead", v)} min={5000} max={50000} step={1000} prefix="$" />
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500 }}>
                Net at month {range}: <span style={{ color: last.netAfterOverhead >= 0 ? "#00E6A8" : "#E05050", fontWeight: 700 }}>${last.netAfterOverhead?.toLocaleString()}</span>
              </div>
            </div>

            {/* Sensitivity */}
            <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "20px 24px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600, marginBottom: 10 }}>SENSITIVITY ANALYSIS</div>
              <div style={{ marginBottom: 12 }}>
                <select value={sensitivityVar} onChange={e => setSensitivityVar(e.target.value)} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#FFFFFF", fontSize: 12, ...mono, outline: "none", width: "100%" }}>
                  {[
                    ["newAgents", "New Agents/mo"], ["newRvps", "New RVPs/mo"],
                    ["avgProdPerAgent", "Avg Prod/Agent"], ["planRate", "Plan Conversion"],
                    ["claimRate", "Claim Conversion"], ["avgClaimValue", "Avg Claim Value"],
                  ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "-30%", rev: sensLastLow.totalRev, retained: sensLastLow.retained, color: "#E05050" },
                  { label: "Base", rev: last.totalRev, retained: last.retained, color: "#FFFFFF" },
                  { label: "+30%", rev: sensLastHigh.totalRev, retained: sensLastHigh.retained, color: "#00E6A8" },
                ].map(s => (
                  <div key={s.label} style={{ padding: "10px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: s.color, ...mono, fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 14, color: "#FFFFFF", ...mono, fontWeight: 700 }}>${(s.rev / 1000).toFixed(0)}k</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono }}>ret ${(s.retained / 1000).toFixed(0)}k</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risks */}
          {risks.length > 0 && (
            <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(224,80,80,0.15)", borderRadius: 10, padding: "16px 20px", marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "#E05050", letterSpacing: 1, ...mono, fontWeight: 700, marginBottom: 8 }}>RISK WARNINGS</div>
              {risks.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                  <span style={{ fontSize: 12, color: r.severity === "high" ? "#E05050" : C.gold }}>⚠</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", ...mono, fontWeight: 500 }}>{r.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Inputs + Summary */}
        <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
          {/* Scenario inputs */}
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "20px 24px", marginBottom: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600, marginBottom: 14 }}>GROWTH INPUTS</div>
            <Slider label="New RVPs / Month" value={inputs.newRvps} onChange={v => set("newRvps", v)} min={0} max={10} />
            <Slider label="New Agents / Month" value={inputs.newAgents} onChange={v => set("newAgents", v)} min={0} max={25} />
            <Slider label="Agents per RVP" value={inputs.agentsPerRvp} onChange={v => set("agentsPerRvp", v)} min={1} max={15} />
            <Slider label="Avg Prod / Agent" value={inputs.avgProdPerAgent} onChange={v => set("avgProdPerAgent", v)} min={500} max={10000} step={250} prefix="$" />
            <Slider label="Plan Conversion" value={inputs.planRate} onChange={v => set("planRate", v)} min={0.05} max={0.40} step={0.01} isPct />
            <Slider label="Claim Conversion" value={inputs.claimRate} onChange={v => set("claimRate", v)} min={0.02} max={0.30} step={0.01} isPct />
            <Slider label="Avg Claim Value" value={inputs.avgClaimValue} onChange={v => set("avgClaimValue", v)} min={5000} max={50000} step={1000} prefix="$" />
          </div>

          {/* Executive summary */}
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 10, padding: "20px 24px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: PURPLE, fontWeight: 700, letterSpacing: 1, ...mono }}>EXECUTIVE SUMMARY</span>
            </div>
            <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500, lineHeight: 1.7 }}>
              At the <span style={{ color: PURPLE, fontWeight: 700 }}>{scenario}</span> scenario over <span style={{ fontWeight: 700 }}>{range} months</span>, the platform projects
              {" "}<span style={{ color: "#00E6A8", fontWeight: 700 }}>${last.totalRev?.toLocaleString()}/mo</span> in total revenue
              with <span style={{ color: "#00E6A8", fontWeight: 700 }}>${last.retained?.toLocaleString()}</span> retained
              at a <span style={{ color: last.margin >= 60 ? "#00E6A8" : C.gold, fontWeight: 700 }}>{last.margin}% margin</span>.

              {"\n\n"}The organization will grow to <span style={{ fontWeight: 700 }}>{last.agents} agents</span> across
              {" "}<span style={{ fontWeight: 700 }}>{last.rvps} RVPs</span> and <span style={{ fontWeight: 700 }}>{last.cps} CPs</span>.

              {breakEvenMonth > 0 ? (
                <>{"\n\n"}Break-even (after ${inputs.overhead.toLocaleString()}/mo overhead) is reached at <span style={{ color: "#00E6A8", fontWeight: 700 }}>month {breakEvenMonth}</span>.</>
              ) : (
                <>{"\n\n"}<span style={{ color: "#E05050", fontWeight: 700 }}>Break-even is not reached</span> within the {range}-month window at current growth.</>
              )}

              {"\n\n"}Total payout liability is <span style={{ color: C.gold, fontWeight: 700 }}>${last.totalPayouts?.toLocaleString()}/mo</span>
              {" "}({last.totalRev > 0 ? Math.round((last.totalPayouts / last.totalRev) * 100) : 0}% of revenue).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
