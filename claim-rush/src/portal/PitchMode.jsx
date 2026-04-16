import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { C } from "./theme";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── SLIDE DECKS ─────────────────────────────────────────────────────────────

const CP_SLIDES = [
  { id: "vision", title: "THE VISION", subtitle: "Claim Rush", content: "A national platform where independent Channel Partners own exclusive territories, build teams, and earn recurring revenue from both licensing fees and production compensation.", accent: "#00E6A8", large: true },
  { id: "problem", title: "THE PROBLEM", content: "Property owners lose billions every year to underpaid insurance claims. Adjusters work for the insurance company — not the homeowner. There is no scalable consumer protection layer between the policyholder and the insurer.", accent: "#E05050" },
  { id: "solution", title: "THE SOLUTION", content: "Claim Rush gives property owners direct access to AI-powered claim review, policy guidance, and licensed adjuster support — delivered through a network of local agents managed by RVPs under your territory.", accent: "#00E6A8" },
  { id: "model", title: "BUSINESS MODEL", content: "Two revenue streams. One platform.", blocks: [
    { label: "Platform Licensing", items: ["CP: $2,000/mo", "RVP: $1,000/mo", "Agent: $500/mo", "You earn overrides on every subscription in your territory"], color: PURPLE },
    { label: "Production Compensation", items: ["Protection plan enrollments", "Claim commissions", "Team override income", "Recurring revenue from renewals"], color: "#00E6A8" },
  ]},
  { id: "territory", title: "TERRITORY OWNERSHIP", content: "You don't rent your territory — you own it.", points: ["Exclusive access to your primary state", "Expansion into adjacent states", "Max 3 CPs per state — scarcity is built in", "First-mover advantage in unclaimed territories"], accent: C.gold, interactive: "territory" },
  { id: "simulator", title: "EARNINGS POTENTIAL", content: "Model your income. Adjust the inputs. See what's possible.", interactive: "simulator", accent: "#00E6A8" },
  { id: "example", title: "EXAMPLE: YEAR ONE", blocks: [
    { label: "Month 1–3", items: ["Recruit 2 RVPs", "Each RVP recruits 3 agents", "Platform: $700/mo override", "Production ramp-up begins"], color: "rgba(255,255,255,0.55)" },
    { label: "Month 4–8", items: ["4 RVPs, 20 agents", "Platform: $1,600/mo override", "Production: $4,000/mo", "Total: $5,600/mo"], color: C.gold },
    { label: "Month 9–12", items: ["6 RVPs, 35 agents", "Platform: $2,800/mo override", "Production: $8,000/mo", "Total: $10,800/mo"], color: "#00E6A8" },
  ]},
  { id: "growth", title: "GROWTH POTENTIAL", content: "The insurance protection market is $3.2 trillion. Less than 2% of policyholders have independent representation. Every territory is an untapped market.", points: ["Avg claim underpayment: $12,000", "73% of claims are underpaid on first offer", "Market growing 18% annually", "No dominant national player exists"], accent: "#00E6A8" },
  { id: "platform", title: "THE PLATFORM", content: "You're not just buying a territory. You're getting a fully built command center.", points: ["AI-powered lead scoring and scripts", "Automated follow-up sequences", "Assisted Close Mode with live tracking", "AXIS coaching engine", "Revenue dashboards and forecasting", "Built-in e-sign and enrollment"], accent: PURPLE, interactive: "dashboard" },
  { id: "why_now", title: "WHY NOW", content: "Storm season is starting. Wildfire claims are at record highs. Property owners need help now — and the agents who reach them first win.", accent: "#E05050", large: true },
  { id: "offer", title: "THE OFFER", blocks: [
    { label: "Territory License", items: ["$50,000 one-time territory fee", "$2,000/month platform fee", "Exclusive state ownership", "Full platform access"], color: "#00E6A8" },
    { label: "What You Get", items: ["Dedicated territory", "Recruiting tools", "Lead generation system", "Revenue command center", "AXIS coaching AI", "Ongoing platform development"], color: PURPLE },
  ]},
  { id: "cta", title: "READY?", subtitle: "Reserve your territory before it's taken.", content: "Only 3 CP positions per state. 12 states are already full. Don't wait.", accent: "#00E6A8", large: true, cta: true },
];

const RVP_SLIDES = [
  { id: "intro", title: "BUILD YOUR TEAM", subtitle: "RVP Opportunity", content: "Recruit agents. Earn overrides. Build a local insurance protection business — backed by a national platform.", accent: "#00E6A8", large: true },
  { id: "role", title: "YOUR ROLE", content: "As an RVP, you recruit and manage a team of agents in your market. You earn on every agent subscription and every deal they close.", points: ["$1,000/month platform fee", "8% override on agent subscriptions", "5% override on agent production", "Direct production commissions"], accent: C.gold },
  { id: "earnings", title: "EARNINGS EXAMPLE", blocks: [
    { label: "5 Agents", items: ["Licensing: $200/mo", "Production: $1,500/mo", "Net: $700/mo after fee"], color: "rgba(255,255,255,0.55)" },
    { label: "10 Agents", items: ["Licensing: $400/mo", "Production: $4,000/mo", "Net: $3,400/mo"], color: C.gold },
    { label: "15 Agents", items: ["Licensing: $600/mo", "Production: $7,500/mo", "Net: $7,100/mo"], color: "#00E6A8" },
  ]},
  { id: "simulator", title: "MODEL YOUR INCOME", interactive: "simulator", accent: "#00E6A8" },
  { id: "platform", title: "TOOLS YOU GET", points: ["AI sales scripts for every lead", "Automated outreach + follow-up", "Assisted Close Mode", "AXIS coaching engine", "Team performance tracking", "Commission dashboard"], accent: PURPLE },
  { id: "cta", title: "JOIN NOW", subtitle: "$1,000/month. Unlimited upside.", content: "Your market is waiting. The agents are out there. The platform is ready.", accent: "#00E6A8", large: true, cta: true },
];

const INVESTOR_SLIDES = [
  { id: "thesis", title: "INVESTMENT THESIS", subtitle: "Claim Rush", content: "A vertically integrated InsurTech platform combining AI-powered claims intelligence with a scalable agent network and recurring SaaS revenue.", accent: "#00E6A8", large: true },
  { id: "market", title: "MARKET OPPORTUNITY", content: "$3.2 trillion property insurance market. 73% of claims underpaid. No dominant consumer-side platform exists.", points: ["TAM: $3.2T property insurance", "SAM: $420B claims advocacy", "SOM: $12B protection plans", "18% annual market growth"], accent: C.gold },
  { id: "model", title: "REVENUE MODEL", blocks: [
    { label: "Platform Licensing (SaaS)", items: ["CP: $2,000/mo × territories", "RVP: $1,000/mo × regions", "Agent: $500/mo × field force", "85%+ gross margin on licensing"], color: PURPLE },
    { label: "Production Revenue", items: ["Protection plan enrollments", "Claims commission share", "Team override structure", "Recurring renewal revenue"], color: "#00E6A8" },
  ]},
  { id: "metrics", title: "KEY METRICS", blocks: [
    { label: "Current", items: ["10 active territories", "45 agents", "12 RVPs", "$93K MRR"], color: "rgba(255,255,255,0.55)" },
    { label: "12-Month Target", items: ["25 territories", "150 agents", "40 RVPs", "$480K MRR"], color: C.gold },
    { label: "24-Month Target", items: ["50 territories", "400 agents", "100 RVPs", "$1.8M MRR"], color: "#00E6A8" },
  ]},
  { id: "forecast", title: "REVENUE FORECAST", interactive: "forecast", accent: "#00E6A8" },
  { id: "unit", title: "UNIT ECONOMICS", points: ["CAC: $1,200 per agent", "LTV: $14,400 per agent (24mo)", "LTV/CAC ratio: 12x", "Payback period: 2.4 months", "Net revenue retention: 115%", "Gross margin: 82%"], accent: "#00E6A8" },
  { id: "moat", title: "COMPETITIVE MOAT", points: ["Territory exclusivity creates scarcity", "AI coaching engine (AXIS) is proprietary", "Network effects: more agents = more data = better AI", "Regulatory complexity favors platform approach", "Switching cost: agents built on the platform don't leave"], accent: PURPLE },
  { id: "team", title: "TEAM", content: "Insurance industry veterans + AI engineers + growth operators. Combined 40+ years in claims, InsurTech, and platform businesses.", accent: "rgba(255,255,255,0.75)" },
  { id: "ask", title: "THE ASK", content: "$2.5M Series Seed at $15M pre-money valuation.", points: ["40% — Territory expansion (25 new states)", "30% — Platform engineering + AI", "20% — Agent acquisition + onboarding", "10% — Operations + compliance"], accent: "#00E6A8", large: true, cta: true },
];

// ── INTERACTIVE EMBEDS ──────────────────────────────────────────────────────

function SimulatorEmbed() {
  const [agents, setAgents] = useState(10);
  const [prod, setProd] = useState(3000);
  const override = agents * 500 * 0.08;
  const production = agents * prod * 0.18;
  const total = override + production - 1000;
  return (
    <div style={{ padding: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, maxWidth: 500, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", ...mono }}>Agents</span>
          <span style={{ fontSize: 16, color: "#FFFFFF", ...mono, fontWeight: 700 }}>{agents}</span>
        </div>
        <input type="range" min={1} max={25} value={agents} onChange={e => setAgents(Number(e.target.value))} style={{ width: "100%", accentColor: "#00E6A8" }} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", ...mono }}>Avg Production/Agent</span>
          <span style={{ fontSize: 16, color: "#FFFFFF", ...mono, fontWeight: 700 }}>${prod.toLocaleString()}</span>
        </div>
        <input type="range" min={1000} max={8000} step={500} value={prod} onChange={e => setProd(Number(e.target.value))} style={{ width: "100%", accentColor: "#00E6A8" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "Overrides", value: Math.round(override), color: PURPLE },
          { label: "Production", value: Math.round(production), color: "#00E6A8" },
          { label: "Net Monthly", value: Math.round(total), color: total >= 0 ? "#FFFFFF" : "#E05050" },
        ].map(k => (
          <div key={k.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", ...mono, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 24, color: "#FFFFFF", fontWeight: 700, ...mono, textShadow: `0 0 12px ${k.color}40` }}>${k.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TerritoryEmbed() {
  const states = [
    { code: "FL", status: "full" }, { code: "TX", status: "full" }, { code: "CA", status: "full" },
    { code: "GA", status: "limited" }, { code: "LA", status: "limited" }, { code: "TN", status: "limited" },
    { code: "AZ", status: "open" }, { code: "CO", status: "open" }, { code: "NC", status: "open" },
    { code: "NV", status: "open" }, { code: "SC", status: "open" }, { code: "OK", status: "open" },
    { code: "AL", status: "open" }, { code: "MS", status: "open" },
  ];
  const colors = { full: "#E05050", limited: C.gold, open: "#00E6A8" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, maxWidth: 500, margin: "0 auto" }}>
      {states.map(s => (
        <div key={s.code} style={{ padding: "12px 0", textAlign: "center", background: `${colors[s.status]}10`, border: `1px solid ${colors[s.status]}30`, borderRadius: 8 }}>
          <div style={{ fontSize: 16, color: "#FFFFFF", fontWeight: 700, ...mono }}>{s.code}</div>
          <div style={{ fontSize: 10, color: colors[s.status], ...mono, fontWeight: 600, marginTop: 2 }}>{s.status.toUpperCase()}</div>
        </div>
      ))}
    </div>
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────

export default function PitchMode() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get("mode") || "cp"; // cp | rvp | investor
  const slides = mode === "investor" ? INVESTOR_SLIDES : mode === "rvp" ? RVP_SLIDES : CP_SLIDES;

  const [current, setCurrent] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [tracking, setTracking] = useState([]);
  const slideStart = useRef(Date.now());

  useEffect(() => { setMounted(true); }, []);

  const trackSlide = useCallback(() => {
    const elapsed = Math.round((Date.now() - slideStart.current) / 1000);
    setTracking(prev => [...prev, { slide: current, time: elapsed, ts: Date.now() }]);
    slideStart.current = Date.now();
  }, [current]);

  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= slides.length || transitioning) return;
    trackSlide();
    setTransitioning(true);
    setTimeout(() => { setCurrent(idx); setTransitioning(false); }, 300);
  }, [slides.length, transitioning, trackSlide]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") goTo(current + 1);
      if (e.key === "ArrowLeft") goTo(current - 1);
      if (e.key === "Escape") navigate("/portal");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, goTo, navigate]);

  const slide = slides[current];
  const progress = ((current + 1) / slides.length) * 100;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#070D18", zIndex: 9999,
      display: "flex", flexDirection: "column",
      fontFamily: "'Courier New', monospace",
    }}>
      <style>{`
        @keyframes pitchIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        input[type=range] { -webkit-appearance: none; background: rgba(255,255,255,0.08); border-radius: 2px; height: 4px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 8px; background: #00E6A8; cursor: pointer; }
      `}</style>

      {/* Top bar */}
      <div style={{ padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/portal")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 14, cursor: "pointer", ...mono }}>✕ EXIT</button>
          <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.10)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", ...mono, fontWeight: 600, letterSpacing: 1 }}>
            {mode.toUpperCase()} PITCH
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["cp", "rvp", "investor"].map(m => (
            <button key={m} onClick={() => { setCurrent(0); navigate(`/portal/pitch?mode=${m}`); }} style={{
              padding: "4px 12px", background: mode === m ? `${PURPLE}15` : "transparent",
              border: `1px solid ${mode === m ? `${PURPLE}40` : "rgba(255,255,255,0.08)"}`,
              borderRadius: 4, color: mode === m ? PURPLE : "rgba(255,255,255,0.45)",
              fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono,
            }}>{m.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: slide.accent || "#00E6A8", transition: "width 0.4s ease" }} />
      </div>

      {/* Slide content */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 80px", overflow: "auto",
        opacity: transitioning ? 0 : 1, transform: transitioning ? "translateY(10px)" : "translateY(0)",
        transition: "all 0.3s ease",
      }}>
        <div style={{ maxWidth: 900, width: "100%", animation: mounted && !transitioning ? "pitchIn 0.5s ease both" : "none" }}>
          {/* Subtitle */}
          {slide.subtitle && (
            <div style={{ fontSize: 14, color: slide.accent || "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
              {slide.subtitle}
            </div>
          )}

          {/* Title */}
          <h1 style={{ fontSize: slide.large ? 52 : 38, color: "#FFFFFF", fontWeight: 700, margin: "0 0 24px", letterSpacing: -0.5, lineHeight: 1.15 }}>
            {slide.title}
          </h1>

          {/* Content */}
          {slide.content && (
            <p style={{ fontSize: slide.large ? 20 : 18, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, margin: "0 0 28px", maxWidth: 700, fontWeight: 500 }}>
              {slide.content}
            </p>
          )}

          {/* Points */}
          {slide.points && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
              {slide.points.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ color: slide.accent || "#00E6A8", fontSize: 16, marginTop: 2, flexShrink: 0 }}>✦</span>
                  <span style={{ fontSize: 17, color: "#FFFFFF", lineHeight: 1.6, fontWeight: 500 }}>{p}</span>
                </div>
              ))}
            </div>
          )}

          {/* Blocks (multi-column) */}
          {slide.blocks && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${slide.blocks.length}, 1fr)`, gap: 20, marginBottom: 28 }}>
              {slide.blocks.map((block, i) => (
                <div key={i} style={{ padding: "24px", background: `${block.color}06`, border: `1px solid ${block.color}20`, borderRadius: 12 }}>
                  <div style={{ fontSize: 14, color: block.color, fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>{block.label}</div>
                  {block.items.map((item, j) => (
                    <div key={j} style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 2, fontWeight: 500 }}>
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Interactive embeds */}
          {slide.interactive === "simulator" && <SimulatorEmbed />}
          {slide.interactive === "territory" && <TerritoryEmbed />}
          {slide.interactive === "forecast" && (
            <div style={{ padding: "20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", ...mono, marginBottom: 12 }}>12-MONTH PROJECTION</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
                {[{ label: "MRR", value: "$480K", color: "#00E6A8" }, { label: "ARR", value: "$5.8M", color: PURPLE }, { label: "Margin", value: "68%", color: C.gold }].map(m => (
                  <div key={m.label}>
                    <div style={{ fontSize: 36, color: "#FFFFFF", fontWeight: 700, textShadow: `0 0 16px ${m.color}40` }}>{m.value}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", ...mono, marginTop: 4 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {slide.interactive === "dashboard" && (
            <div style={{ padding: "20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: 14, color: PURPLE, ...mono, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>LIVE PLATFORM DEMO</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", ...mono }}>Full portal access included with every territory</div>
            </div>
          )}

          {/* CTA buttons */}
          {slide.cta && (
            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
              <button style={{
                padding: "16px 32px", background: "linear-gradient(90deg, #00C896, #00E6A8)",
                border: "none", borderRadius: 10, color: "#002018", fontSize: 16, fontWeight: 700,
                letterSpacing: 1, cursor: "pointer", boxShadow: "0 0 20px rgba(0,230,168,0.35)",
                transition: "all 0.2s", ...mono,
              }}>
                {mode === "investor" ? "SCHEDULE MEETING" : mode === "rvp" ? "APPLY NOW" : "RESERVE TERRITORY"}
              </button>
              <button style={{
                padding: "16px 28px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10,
                color: "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: 600,
                cursor: "pointer", ...mono, transition: "all 0.2s",
              }}>
                SCHEDULE CALL
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{
        padding: "16px 32px", borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button onClick={() => goTo(current - 1)} disabled={current === 0} style={{
          padding: "8px 20px", background: current === 0 ? "transparent" : "rgba(255,255,255,0.04)",
          border: `1px solid ${current === 0 ? "transparent" : "rgba(255,255,255,0.10)"}`,
          borderRadius: 8, color: current === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.65)",
          fontSize: 13, fontWeight: 600, cursor: current === 0 ? "default" : "pointer", ...mono,
        }}>← BACK</button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Slide dots */}
          <div style={{ display: "flex", gap: 4 }}>
            {slides.map((_, i) => (
              <div key={i} onClick={() => goTo(i)} style={{
                width: i === current ? 20 : 6, height: 6, borderRadius: 3,
                background: i === current ? (slide.accent || "#00E6A8") : i < current ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
                cursor: "pointer", transition: "all 0.3s ease",
              }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono }}>
            {current + 1} / {slides.length}
          </span>
        </div>

        <button onClick={() => goTo(current + 1)} disabled={current === slides.length - 1} style={{
          padding: "8px 20px",
          background: current === slides.length - 1 ? "transparent" : "rgba(0,230,168,0.08)",
          border: `1px solid ${current === slides.length - 1 ? "transparent" : "rgba(0,230,168,0.25)"}`,
          borderRadius: 8, color: current === slides.length - 1 ? "rgba(255,255,255,0.15)" : "#00E6A8",
          fontSize: 13, fontWeight: 700, cursor: current === slides.length - 1 ? "default" : "pointer", ...mono,
        }}>NEXT →</button>
      </div>
    </div>
  );
}
