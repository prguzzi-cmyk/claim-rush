import { useState, useEffect, useCallback } from "react";
import { C } from "./theme";

const mono = { fontFamily: "'Courier New', monospace" };

// ── DEFAULTS ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  CP: {
    fee: 2000,
    conservative: { rvps: 2, agentsPerRvp: 3, cpRvpOverride: 0.10, cpAgentOverride: 0.05, plansSold: 4, avgPlanComm: 120, claimsSigned: 2, avgClaimComm: 800, teamOverride: 200 },
    target:       { rvps: 4, agentsPerRvp: 5, cpRvpOverride: 0.10, cpAgentOverride: 0.05, plansSold: 10, avgPlanComm: 150, claimsSigned: 5, avgClaimComm: 1000, teamOverride: 500 },
    aggressive:   { rvps: 8, agentsPerRvp: 8, cpRvpOverride: 0.10, cpAgentOverride: 0.05, plansSold: 20, avgPlanComm: 180, claimsSigned: 12, avgClaimComm: 1200, teamOverride: 1500 },
  },
  RVP: {
    fee: 1000,
    conservative: { agents: 3, rvpAgentOverride: 0.08, plansSold: 3, avgPlanComm: 120, claimsSigned: 1, avgClaimComm: 800, teamOverride: 100 },
    target:       { agents: 6, rvpAgentOverride: 0.08, plansSold: 8, avgPlanComm: 150, claimsSigned: 3, avgClaimComm: 1000, teamOverride: 300 },
    aggressive:   { agents: 12, rvpAgentOverride: 0.08, plansSold: 15, avgPlanComm: 180, claimsSigned: 8, avgClaimComm: 1200, teamOverride: 800 },
  },
  Agent: {
    fee: 500,
    conservative: { plansSold: 2, avgPlanComm: 100, claimsSigned: 1, avgClaimComm: 600, teamOverride: 0 },
    target:       { plansSold: 5, avgPlanComm: 130, claimsSigned: 3, avgClaimComm: 800, teamOverride: 0 },
    aggressive:   { plansSold: 12, avgPlanComm: 160, claimsSigned: 6, avgClaimComm: 1000, teamOverride: 0 },
  },
};

const RVP_FEE = 1000;
const AGENT_FEE = 500;

// ── CALCULATOR ──────────────────────────────────────────────────────────────

function calculate(role, inputs, fee) {
  let platformGross = 0;
  let rvpIncome = 0, agentIncome = 0;

  if (role === "CP") {
    rvpIncome = inputs.rvps * RVP_FEE * inputs.cpRvpOverride;
    agentIncome = inputs.rvps * inputs.agentsPerRvp * AGENT_FEE * inputs.cpAgentOverride;
    platformGross = rvpIncome + agentIncome;
  } else if (role === "RVP") {
    agentIncome = inputs.agents * AGENT_FEE * inputs.rvpAgentOverride;
    platformGross = agentIncome;
  }

  const platformNet = platformGross - fee;
  const productionIncome = (inputs.plansSold || 0) * (inputs.avgPlanComm || 0) + (inputs.claimsSigned || 0) * (inputs.avgClaimComm || 0) + (inputs.teamOverride || 0);
  const totalMonthly = platformNet + productionIncome;
  const annual = totalMonthly * 12;

  // Breakeven
  let breakEvenMsg = "";
  if (platformGross < fee) {
    if (role === "CP" && inputs.cpRvpOverride > 0) {
      const perRvp = RVP_FEE * inputs.cpRvpOverride + inputs.agentsPerRvp * AGENT_FEE * inputs.cpAgentOverride;
      const needed = Math.ceil(fee / perRvp);
      breakEvenMsg = `Need ${needed} RVP${needed !== 1 ? "s" : ""} (with ${inputs.agentsPerRvp} agents each) to cover $${fee.toLocaleString()}/mo`;
    } else if (role === "RVP" && inputs.rvpAgentOverride > 0) {
      const perAgent = AGENT_FEE * inputs.rvpAgentOverride;
      const needed = Math.ceil(fee / perAgent);
      breakEvenMsg = `Need ${needed} agent${needed !== 1 ? "s" : ""} to cover $${fee.toLocaleString()}/mo`;
    } else {
      breakEvenMsg = "Platform income does not cover fee at current rates";
    }
  }

  const breakEvenPct = Math.min(100, Math.round((platformGross / fee) * 100));

  // 12-month projection (assume 8% monthly growth in production + 1 new recruit/mo)
  const projection = [];
  for (let m = 1; m <= 12; m++) {
    const growthFactor = Math.pow(1.08, m - 1);
    const recruitGrowth = role === "Agent" ? 0 : m * 0.5; // half a recruit per month
    let projPlatform = platformGross;
    if (role === "CP") projPlatform = (inputs.rvps + recruitGrowth * 0.3) * RVP_FEE * inputs.cpRvpOverride + (inputs.rvps + recruitGrowth * 0.3) * inputs.agentsPerRvp * AGENT_FEE * inputs.cpAgentOverride;
    else if (role === "RVP") projPlatform = (inputs.agents + recruitGrowth) * AGENT_FEE * inputs.rvpAgentOverride;
    const projProduction = productionIncome * growthFactor;
    projection.push({ month: m, platform: Math.round(projPlatform - fee), production: Math.round(projProduction), total: Math.round(projPlatform - fee + projProduction) });
  }

  return { platformGross: Math.round(platformGross), platformNet: Math.round(platformNet), rvpIncome: Math.round(rvpIncome), agentIncome: Math.round(agentIncome), productionIncome: Math.round(productionIncome), totalMonthly: Math.round(totalMonthly), annual: Math.round(annual), breakEvenPct, breakEvenMsg, fee, projection };
}

// ── SLIDER COMPONENT ────────────────────────────────────────────────────────

function Field({ label, value, onChange, min = 0, max = 100, step = 1, prefix = "", suffix = "", isPercent }) {
  const display = isPercent ? `${Math.round(value * 100)}%` : `${prefix}${value.toLocaleString()}${suffix}`;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 700 }}>{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(isPercent ? parseFloat(e.target.value) : Number(e.target.value))}
        style={{ width: "100%", accentColor: "#00E6A8", height: 4, cursor: "pointer" }}
      />
    </div>
  );
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function EarningsSimulator() {
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState("CP");
  const [scenario, setScenario] = useState("target");
  const [inputs, setInputs] = useState(DEFAULTS.CP.target);
  const [saved, setSaved] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  const loadScenario = useCallback((r, s) => {
    setRole(r);
    setScenario(s);
    setInputs({ ...DEFAULTS[r][s] });
  }, []);

  useEffect(() => { loadScenario(role, scenario); }, [role, scenario]);

  const fee = DEFAULTS[role].fee;
  const result = calculate(role, inputs, fee);
  const set = (key, val) => setInputs(prev => ({ ...prev, [key]: val }));
  const projMax = Math.max(...result.projection.map(p => p.total), 1);

  return (
    <div style={{ maxWidth: 1200 }}>
      <style>{`
        @keyframes simFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input[type=range] { -webkit-appearance: none; background: rgba(255,255,255,0.08); border-radius: 2px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 7px; background: #00E6A8; cursor: pointer; box-shadow: 0 0 6px rgba(0,230,168,0.4); }
      `}</style>

      {/* Header */}
      <div style={{
        marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease",
      }}>
        <div>
          <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>EARNINGS SIMULATOR</h1>
          <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>Model your income across platform licensing + production</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => loadScenario(role, scenario)} style={{
            padding: "7px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 6, color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 600, cursor: "pointer", ...mono,
          }}>RESET</button>
          <button onClick={() => setSaved({ role, scenario, inputs: { ...inputs }, result: { ...result } })} style={{
            padding: "7px 16px", background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.25)",
            borderRadius: 6, color: "#00E6A8", fontSize: 12, fontWeight: 700, cursor: "pointer", ...mono,
          }}>SAVE SCENARIO</button>
        </div>
      </div>

      {/* Role + Scenario selectors */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {/* Role */}
        <div style={{ display: "flex", gap: 0 }}>
          {["CP", "RVP", "Agent"].map((r, i) => (
            <button key={r} onClick={() => setRole(r)} style={{
              padding: "8px 20px",
              background: role === r ? "rgba(0,230,168,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${role === r ? "rgba(0,230,168,0.35)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : "0",
              borderLeft: i > 0 ? "none" : undefined,
              color: role === r ? "#00E6A8" : "rgba(255,255,255,0.55)",
              fontSize: 13, fontWeight: 700, letterSpacing: 1, cursor: "pointer", ...mono,
            }}>{r}</button>
          ))}
        </div>
        {/* Scenario */}
        <div style={{ display: "flex", gap: 0 }}>
          {["conservative", "target", "aggressive"].map((s, i) => (
            <button key={s} onClick={() => setScenario(s)} style={{
              padding: "8px 18px",
              background: scenario === s ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${scenario === s ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : "0",
              borderLeft: i > 0 ? "none" : undefined,
              color: scenario === s ? "#A855F7" : "rgba(255,255,255,0.55)",
              fontSize: 12, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer", ...mono,
            }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* ── KPI STRIP ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Platform Income", value: result.platformNet, color: "#A855F7" },
          { label: "Production Income", value: result.productionIncome, color: "#00E6A8" },
          { label: "Total Monthly", value: result.totalMonthly, color: "#FFFFFF" },
          { label: "Annual Income", value: result.annual, color: C.gold },
        ].map((kpi, i) => (
          <div key={kpi.label} style={{
            background: "#162238", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.4)", padding: "20px 22px",
            animation: mounted ? `simFadeUp 0.5s ease ${i * 0.08}s both` : "none",
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                fontSize: kpi.label === "Annual Income" ? 28 : 26, fontWeight: 700, ...mono,
                color: kpi.value < 0 ? "#E05050" : "#FFFFFF",
                textShadow: `0 0 12px ${kpi.value < 0 ? "rgba(224,80,80,0.3)" : `${kpi.color}40`}`,
              }}>
                {kpi.value < 0 ? "-" : ""}${Math.abs(kpi.value).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── MAIN: Inputs + Breakdown + Projection ────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, marginBottom: 28 }}>

        {/* Left: Input panel */}
        <div style={{
          background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
          border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", padding: "20px 24px",
          animation: mounted ? "simFadeUp 0.6s ease 0.3s both" : "none",
        }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, ...mono, fontWeight: 600 }}>
            PLATFORM INPUTS
          </div>
          {role === "CP" && (
            <>
              <Field label="RVPs Recruited" value={inputs.rvps} onChange={v => set("rvps", v)} max={20} />
              <Field label="Agents per RVP" value={inputs.agentsPerRvp} onChange={v => set("agentsPerRvp", v)} max={20} />
              <Field label="CP Override on RVP" value={inputs.cpRvpOverride} onChange={v => set("cpRvpOverride", v)} min={0.01} max={0.25} step={0.01} isPercent />
              <Field label="CP Override on Agent" value={inputs.cpAgentOverride} onChange={v => set("cpAgentOverride", v)} min={0.01} max={0.15} step={0.01} isPercent />
            </>
          )}
          {role === "RVP" && (
            <>
              <Field label="Agents Recruited" value={inputs.agents} onChange={v => set("agents", v)} max={25} />
              <Field label="RVP Override on Agent" value={inputs.rvpAgentOverride} onChange={v => set("rvpAgentOverride", v)} min={0.01} max={0.20} step={0.01} isPercent />
            </>
          )}
          {role === "Agent" && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", ...mono, fontWeight: 500, padding: "8px 0" }}>
              Agents earn from production only.
            </div>
          )}

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "12px 0 16px" }} />
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, ...mono, fontWeight: 600 }}>
            PRODUCTION INPUTS
          </div>
          <Field label="Plans Sold / Month" value={inputs.plansSold} onChange={v => set("plansSold", v)} max={30} />
          <Field label="Avg Plan Commission" value={inputs.avgPlanComm} onChange={v => set("avgPlanComm", v)} max={500} step={10} prefix="$" />
          <Field label="Claims Signed / Month" value={inputs.claimsSigned} onChange={v => set("claimsSigned", v)} max={20} />
          <Field label="Avg Claim Commission" value={inputs.avgClaimComm} onChange={v => set("avgClaimComm", v)} max={3000} step={50} prefix="$" />
          {role !== "Agent" && (
            <Field label="Team Override Income" value={inputs.teamOverride} onChange={v => set("teamOverride", v)} max={5000} step={50} prefix="$" />
          )}
        </div>

        {/* Right: Breakdown + Projection */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Breakdown */}
          <div style={{
            background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
            border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)", padding: "20px 24px",
            animation: mounted ? "simFadeUp 0.6s ease 0.35s both" : "none",
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, ...mono, fontWeight: 600 }}>
              INCOME BREAKDOWN
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {role === "CP" && (
                <>
                  <Row label={`RVP Overrides (${inputs.rvps} × $${RVP_FEE} × ${Math.round(inputs.cpRvpOverride*100)}%)`} value={result.rvpIncome} color="#A855F7" />
                  <Row label={`Agent Overrides (${inputs.rvps}×${inputs.agentsPerRvp} × $${AGENT_FEE} × ${Math.round(inputs.cpAgentOverride*100)}%)`} value={result.agentIncome} color="#7C3AED" />
                </>
              )}
              {role === "RVP" && (
                <Row label={`Agent Overrides (${inputs.agents} × $${AGENT_FEE} × ${Math.round(inputs.rvpAgentOverride*100)}%)`} value={result.agentIncome} color="#A855F7" />
              )}
              <Row label="Platform Gross" value={result.platformGross} color="rgba(255,255,255,0.75)" bold />
              <Row label={`${role} Fee`} value={-fee} color="#E05050" />
              <Row label="Platform Net" value={result.platformNet} color={result.platformNet >= 0 ? "#A855F7" : "#E05050"} bold />
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
              <Row label={`Plans (${inputs.plansSold} × $${inputs.avgPlanComm})`} value={(inputs.plansSold || 0) * (inputs.avgPlanComm || 0)} color="#00E6A8" />
              <Row label={`Claims (${inputs.claimsSigned} × $${inputs.avgClaimComm})`} value={(inputs.claimsSigned || 0) * (inputs.avgClaimComm || 0)} color="#00E6A8" />
              {role !== "Agent" && <Row label="Team Override" value={inputs.teamOverride || 0} color={C.gold} />}
              <Row label="Production Total" value={result.productionIncome} color="#00E6A8" bold />
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
              <Row label="TOTAL MONTHLY" value={result.totalMonthly} color={result.totalMonthly >= 0 ? "#FFFFFF" : "#E05050"} bold large />
              <Row label="ANNUAL" value={result.annual} color={result.annual >= 0 ? C.gold : "#E05050"} bold large />
            </div>
          </div>

          {/* Breakeven */}
          <div style={{
            background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
            border: `1px solid ${result.breakEvenPct >= 100 ? "rgba(0,230,168,0.20)" : "rgba(255,255,255,0.10)"}`,
            borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", padding: "20px 24px",
            animation: mounted ? "simFadeUp 0.6s ease 0.4s both" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono, fontWeight: 600 }}>PLATFORM BREAKEVEN</span>
              <span style={{ fontSize: 14, fontWeight: 700, ...mono, color: result.breakEvenPct >= 100 ? "#00E6A8" : C.gold }}>{result.breakEvenPct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 10 }}>
              <div style={{
                height: "100%", borderRadius: 4, width: `${result.breakEvenPct}%`,
                background: result.breakEvenPct >= 100 ? "linear-gradient(90deg, #00C896, #00E6A8)" : `linear-gradient(90deg, ${C.gold}, ${C.gold}cc)`,
                boxShadow: result.breakEvenPct >= 100 ? "0 0 10px rgba(0,230,168,0.4)" : "none",
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ fontSize: 13, ...mono, fontWeight: 600, color: result.breakEvenPct >= 100 ? "#00E6A8" : "#FFFFFF", lineHeight: 1.5 }}>
              {result.breakEvenPct >= 100
                ? `✓ Covered. Platform generates $${result.platformGross.toLocaleString()} vs $${fee.toLocaleString()} fee.`
                : result.breakEvenMsg}
            </div>
          </div>

          {/* 12-Month Projection */}
          <div style={{
            background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
            border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)", padding: "20px 24px",
            animation: mounted ? "simFadeUp 0.6s ease 0.45s both" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>12-MONTH PROJECTION</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono, fontWeight: 500 }}>8% monthly growth</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
              {result.projection.map((p, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 9, color: p.total >= 0 ? "rgba(255,255,255,0.45)" : "#E05050", ...mono, fontWeight: 600 }}>
                    {p.total >= 1000 ? `${Math.round(p.total / 1000)}k` : p.total}
                  </span>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 90 }}>
                    {/* Production portion */}
                    <div style={{
                      width: "100%", borderRadius: "3px 3px 0 0",
                      height: `${Math.max(1, Math.round((p.production / projMax) * 90))}px`,
                      background: "#00E6A8", transition: "height 0.4s ease",
                    }} />
                    {/* Platform portion */}
                    <div style={{
                      width: "100%", borderRadius: "0 0 3px 3px",
                      height: `${Math.max(1, Math.round((Math.max(0, p.platform) / projMax) * 90))}px`,
                      background: "#A855F7", transition: "height 0.4s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", ...mono }}>{i + 1}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 4, borderRadius: 2, background: "#A855F7" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono }}>Platform</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 4, borderRadius: 2, background: "#00E6A8" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono }}>Production</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Saved scenario */}
      {saved && (
        <div style={{
          padding: "14px 20px",
          background: "rgba(0,230,168,0.06)", border: "1px solid rgba(0,230,168,0.15)",
          borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, color: "#00E6A8", ...mono, fontWeight: 600 }}>
            ✓ Scenario saved — {saved.role} / {saved.scenario} — ${saved.result.totalMonthly.toLocaleString()}/mo
          </span>
          <button onClick={() => setSaved(null)} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 14, cursor: "pointer",
          }}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── BREAKDOWN ROW ───────────────────────────────────────────────────────────

function Row({ label, value, color, bold, large }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...{ fontFamily: "'Courier New', monospace" }, fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: large ? 18 : 14, fontWeight: bold ? 700 : 500,
        color: color || "#FFFFFF", fontFamily: "'Courier New', monospace",
      }}>
        {value < 0 ? "-" : ""}${Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}
