import { useState, useEffect, useRef } from "react";

const C = {
  black: "#060810",
  navy: "#0A1020",
  panel: "#0E1628",
  panel2: "#131E30",
  border: "#1A2840",
  gold: "#C9A84C",
  goldDim: "#8A6E2A",
  red: "#E03030",
  redDim: "#7A1818",
  green: "#22C55E",
  blue: "#2A70D0",
  white: "#F4F0E8",
  muted: "#5A6880",
  cream: "#E8DFC8",
};

// ── LIVE TICKER ──────────────────────────────────────────────────────────────
function Ticker() {
  const items = [
    "🔴 OREGON — SECURED · Peter G. · 28 leads this week",
    "🔴 WASHINGTON — SECURED · Team of 4 agents active",
    "⚡ TEXAS — 3 counties claimed in last 48 hours",
    "⚡ FLORIDA — 2 territories remaining statewide",
    "🔴 CALIFORNIA — Application window open · 142 leads queued",
    "⚡ GEORGIA — Chapter President position available",
    "🔴 NEVADA — SECURED · First leads distributed",
    "⚡ ARIZONA — 1 territory remaining",
  ];
  const [pos, setPos] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setPos(p => p + 0.8), 16);
    return () => clearInterval(iv);
  }, []);
  const w = items.length * 480;
  return (
    <div style={{ background: "#180000", borderBottom: `1px solid ${C.red}66`, padding: "7px 0", overflow: "hidden", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ background: C.red, color: "#fff", fontWeight: 900, fontSize: 9, letterSpacing: 2.5, padding: "4px 14px", flexShrink: 0, fontFamily: "'Courier New',monospace" }}>● LIVE</div>
      <div style={{ overflow: "hidden", flex: 1 }}>
        <div style={{ display: "flex", transform: `translateX(-${pos % w}px)`, whiteSpace: "nowrap" }}>
          {[...items, ...items, ...items].map((item, i) => (
            <span key={i} style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600, fontFamily: "'Courier New',monospace", paddingRight: 60 }}>{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── TERRITORY MAP ─────────────────────────────────────────────────────────────
function TerritoryMap() {
  const states = [
    { name: "WA", status: "secured", row: 0, col: 1 },
    { name: "MT", status: "open", row: 0, col: 2 },
    { name: "ND", status: "open", row: 0, col: 3 },
    { name: "MN", status: "open", row: 0, col: 4 },
    { name: "MI", status: "open", row: 0, col: 6 },
    { name: "NY", status: "open", row: 0, col: 7 },
    { name: "VT", status: "open", row: 0, col: 8 },
    { name: "OR", status: "secured", row: 1, col: 1 },
    { name: "ID", status: "open", row: 1, col: 2 },
    { name: "SD", status: "open", row: 1, col: 3 },
    { name: "WI", status: "open", row: 1, col: 4 },
    { name: "OH", status: "open", row: 1, col: 5 },
    { name: "PA", status: "open", row: 1, col: 6 },
    { name: "NJ", status: "open", row: 1, col: 7 },
    { name: "CT", status: "open", row: 1, col: 8 },
    { name: "CA", status: "open", row: 2, col: 0 },
    { name: "NV", status: "secured", row: 2, col: 1 },
    { name: "WY", status: "open", row: 2, col: 2 },
    { name: "NE", status: "open", row: 2, col: 3 },
    { name: "IA", status: "open", row: 2, col: 4 },
    { name: "IN", status: "open", row: 2, col: 5 },
    { name: "WV", status: "open", row: 2, col: 6 },
    { name: "VA", status: "open", row: 2, col: 7 },
    { name: "MD", status: "open", row: 2, col: 8 },
    { name: "AZ", status: "limited", row: 3, col: 1 },
    { name: "UT", status: "open", row: 3, col: 2 },
    { name: "CO", status: "open", row: 3, col: 3 },
    { name: "KS", status: "open", row: 3, col: 4 },
    { name: "MO", status: "open", row: 3, col: 5 },
    { name: "KY", status: "open", row: 3, col: 6 },
    { name: "NC", status: "open", row: 3, col: 7 },
    { name: "DE", status: "open", row: 3, col: 8 },
    { name: "NM", status: "open", row: 4, col: 1 },
    { name: "OK", status: "limited", row: 4, col: 3 },
    { name: "AR", status: "open", row: 4, col: 4 },
    { name: "TN", status: "open", row: 4, col: 5 },
    { name: "SC", status: "open", row: 4, col: 6 },
    { name: "GA", status: "open", row: 4, col: 7 },
    { name: "TX", status: "limited", row: 5, col: 2 },
    { name: "LA", status: "open", row: 5, col: 4 },
    { name: "MS", status: "open", row: 5, col: 5 },
    { name: "AL", status: "open", row: 5, col: 6 },
    { name: "FL", status: "limited", row: 6, col: 6 },
    { name: "HI", status: "open", row: 7, col: 0 },
    { name: "AK", status: "open", row: 7, col: 1 },
  ];

  const color = { secured: C.red, limited: C.gold, open: C.blue };
  const bg = { secured: "#2a0808", limited: "#1e1400", open: "#081428" };
  const label = { secured: "SECURED", limited: "LIMITED", open: "OPEN" };

  const [hovered, setHovered] = useState(null);

  const grid = Array.from({ length: 8 }, () => Array(9).fill(null));
  states.forEach(s => { grid[s.row][s.col] = s; });

  return (
    <div>
      <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(9, 38px)", gridTemplateRows: "repeat(8, 32px)", gap: 3 }}>
        {grid.flat().map((s, i) => s ? (
          <div key={s.name}
            onMouseEnter={() => setHovered(s.name)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: hovered === s.name ? color[s.status] : bg[s.status],
              border: `1px solid ${color[s.status]}`,
              borderRadius: 4,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.15s",
              boxShadow: hovered === s.name ? `0 0 12px ${color[s.status]}88` : "none",
            }}>
            <span style={{ color: "#FFFFFF", fontSize: 10, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>{s.name}</span>
          </div>
        ) : (
          <div key={i} style={{ background: "transparent" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        {[["secured", "SECURED"], ["limited", "LIMITED"], ["open", "OPEN"]].map(([k, l]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color[k] }} />
            <span style={{ color: "#FFFFFF", fontSize: 10, fontFamily: "'Courier New',monospace", letterSpacing: 1.5 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LIVE COUNTER ──────────────────────────────────────────────────────────────
function LiveCounter({ value, label, color, prefix = "", suffix = "" }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / 40;
    const iv = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(iv); }
      else setDisplay(Math.floor(start));
    }, 30);
    return () => clearInterval(iv);
  }, [value]);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ color, fontSize: 36, fontWeight: 900, fontFamily: "'Courier New',monospace", lineHeight: 1 }}>
        {prefix}{display.toLocaleString()}{suffix}
      </div>
      <div style={{ color: "#FFFFFF", fontSize: 10, letterSpacing: 2, marginTop: 6, fontFamily: "'Courier New',monospace" }}>{label}</div>
    </div>
  );
}

// ── SECTION WRAPPER ───────────────────────────────────────────────────────────
function Section({ children, style = {}, id }) {
  const ref = useRef();
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} id={id} style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(32px)", transition: "all 0.7s ease", ...style }}>
      {children}
    </div>
  );
}

// ── OBJECTION CRUSHER ─────────────────────────────────────────────────────────
function Objection({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(o => !o)} style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 0", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div style={{ color: "#FFFFFF", fontSize: 17, fontFamily: "Georgia,serif", fontWeight: 700 }}>{q}</div>
        <div style={{ color: "#C9A84C", fontSize: 18, flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(45deg)" : "none" }}>+</div>
      </div>
      {open && <div style={{ color: "#FFFFFF", fontSize: 15, marginTop: 12, lineHeight: 1.8, fontFamily: "Georgia,serif", borderLeft: `2px solid ${C.gold}`, paddingLeft: 16 }}>{a}</div>}
    </div>
  );
}

// ── APPLICATION FORM ──────────────────────────────────────────────────────────
function ApplicationForm() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    tier: "cp", years_in_insurance: "", years_in_sales: "", current_role: "", current_income_range: "",
    availability: "full_time", capital_ready: false, motivation: "", goals: "",
    first_choice_state: "", second_choice_state: "", territory_reason: "", founding_cp_requested: false,
  });
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const inputStyle = { width: "100%", background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "10px 14px", color: "#FFFFFF", fontSize: 15, fontFamily: "Georgia,serif", outline: "none", boxSizing: "border-box" };
  const labelStyle = { color: "#FFFFFF", fontSize: 11, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 6 };
  const stepLabel = { color: "#FFFFFF", fontSize: 13, letterSpacing: 3, fontFamily: "'Courier New',monospace", marginBottom: 6 };
  const btnGold = { background: C.gold, color: "#060810", fontWeight: 900, fontSize: 13, padding: "13px 0", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "'Courier New',monospace", letterSpacing: 2, marginTop: 6, width: "100%" };
  const btnBack = { flex: 1, background: "transparent", color: "#FFFFFF", fontWeight: 700, fontSize: 12, padding: "13px 0", borderRadius: 4, border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: "'Courier New',monospace" };

  const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
  const INCOME_RANGES = ["Under $50K", "$50K–$100K", "$100K–$150K", "$150K–$250K", "$250K+"];

  async function handleSubmit() {
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/v1/applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, years_in_insurance: parseInt(data.years_in_insurance) || 0, years_in_sales: parseInt(data.years_in_sales) || 0 }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `Error ${res.status}`); }
      setStep(6);
    } catch (e) { setError(e.message); }
    setSubmitting(false);
  }

  // Success screen
  if (step === 6) return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
      <div style={{ color: "#C9A84C", fontWeight: 900, fontSize: 20, fontFamily: "'Courier New',monospace", letterSpacing: 2, marginBottom: 12 }}>APPLICATION RECEIVED</div>
      <div style={{ color: "#FFFFFF", fontSize: 14, fontFamily: "Georgia,serif", lineHeight: 1.7 }}>A senior team member will contact you within 48 hours to schedule an interview.</div>
      <div style={{ marginTop: 20, color: "#E03030", fontSize: 11, fontFamily: "'Courier New',monospace", letterSpacing: 2 }}>● YOUR TERRITORY IS BEING HELD PENDING REVIEW</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 0, marginBottom: 24 }}>
        {[1,2,3,4,5].map(s => <div key={s} style={{ flex: 1, height: 3, background: step >= s ? C.gold : C.border, transition: "all 0.3s" }} />)}
      </div>

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={stepLabel}>STEP 1 — IDENTIFICATION</div>
          <div><div style={labelStyle}>First Name</div><input style={inputStyle} value={data.first_name} onChange={e => set("first_name", e.target.value)} /></div>
          <div><div style={labelStyle}>Last Name</div><input style={inputStyle} value={data.last_name} onChange={e => set("last_name", e.target.value)} /></div>
          <div><div style={labelStyle}>Email</div><input type="email" style={inputStyle} value={data.email} onChange={e => set("email", e.target.value)} /></div>
          <div><div style={labelStyle}>Phone</div><input type="tel" style={inputStyle} value={data.phone} onChange={e => set("phone", e.target.value)} /></div>
          <button onClick={() => setStep(2)} disabled={!data.first_name || !data.email} style={btnGold}>CONTINUE →</button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={stepLabel}>STEP 2 — EXPERIENCE</div>
          <div><div style={labelStyle}>Years in Insurance</div><input type="number" style={inputStyle} value={data.years_in_insurance} onChange={e => set("years_in_insurance", e.target.value)} /></div>
          <div><div style={labelStyle}>Years in Sales</div><input type="number" style={inputStyle} value={data.years_in_sales} onChange={e => set("years_in_sales", e.target.value)} /></div>
          <div><div style={labelStyle}>Current Role</div><input style={inputStyle} value={data.current_role} onChange={e => set("current_role", e.target.value)} placeholder="e.g. Insurance Agent, Claims Adjuster" /></div>
          <div><div style={labelStyle}>Current Income Range</div>
            <select style={{ ...inputStyle, appearance: "auto" }} value={data.current_income_range} onChange={e => set("current_income_range", e.target.value)}>
              <option value="">Select...</option>
              {INCOME_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(1)} style={btnBack}>← BACK</button>
            <button onClick={() => setStep(3)} style={{ ...btnGold, flex: 2 }}>CONTINUE →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={stepLabel}>STEP 3 — COMMITMENT</div>
          <div><div style={labelStyle}>Availability</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["full_time","Full-Time"],["part_time","Part-Time"]].map(([v,l]) => (
                <div key={v} onClick={() => set("availability", v)} style={{ flex: 1, padding: "10px", textAlign: "center", background: data.availability === v ? `${C.gold}18` : C.panel2, border: `1px solid ${data.availability === v ? C.gold : C.border}`, borderRadius: 4, cursor: "pointer", color: data.availability === v ? C.gold : "#fff", fontSize: 13, fontFamily: "'Courier New',monospace" }}>{l}</div>
              ))}
            </div>
          </div>
          <div onClick={() => set("capital_ready", !data.capital_ready)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: data.capital_ready ? `${C.gold}12` : C.panel2, border: `1px solid ${data.capital_ready ? C.gold : C.border}`, borderRadius: 4 }}>
            <span style={{ fontSize: 18 }}>{data.capital_ready ? "☑" : "☐"}</span>
            <span style={{ color: "#FFFFFF", fontSize: 13 }}>I am prepared to invest $100,000 entry + $2,000/month</span>
          </div>
          <div><div style={labelStyle}>Why do you want to build with ACI?</div><textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={data.motivation} onChange={e => set("motivation", e.target.value)} /></div>
          <div><div style={labelStyle}>What are your goals for the first 12 months?</div><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={data.goals} onChange={e => set("goals", e.target.value)} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(2)} style={btnBack}>← BACK</button>
            <button onClick={() => setStep(4)} style={{ ...btnGold, flex: 2 }}>CONTINUE →</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={stepLabel}>STEP 4 — TERRITORY</div>
          <div><div style={labelStyle}>First Choice State</div>
            <select style={{ ...inputStyle, appearance: "auto" }} value={data.first_choice_state} onChange={e => set("first_choice_state", e.target.value)}>
              <option value="">Select state...</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><div style={labelStyle}>Second Choice State</div>
            <select style={{ ...inputStyle, appearance: "auto" }} value={data.second_choice_state} onChange={e => set("second_choice_state", e.target.value)}>
              <option value="">Select state...</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><div style={labelStyle}>Why these territories?</div><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={data.territory_reason} onChange={e => set("territory_reason", e.target.value)} /></div>
          <div onClick={() => set("founding_cp_requested", !data.founding_cp_requested)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: data.founding_cp_requested ? `${C.gold}12` : C.panel2, border: `1px solid ${data.founding_cp_requested ? C.gold : C.border}`, borderRadius: 4 }}>
            <span style={{ fontSize: 18 }}>{data.founding_cp_requested ? "☑" : "☐"}</span>
            <span style={{ color: "#FFFFFF", fontSize: 13 }}>I want to apply as a Founding Chapter President (entry fee waived)</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(3)} style={btnBack}>← BACK</button>
            <button onClick={() => setStep(5)} style={{ ...btnGold, flex: 2 }}>REVIEW APPLICATION →</button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={stepLabel}>STEP 5 — REVIEW & SUBMIT</div>
          <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "14px" }}>
            {[
              ["Name", `${data.first_name} ${data.last_name}`], ["Email", data.email], ["Phone", data.phone || "—"],
              ["Experience", `${data.years_in_insurance || 0}yr insurance, ${data.years_in_sales || 0}yr sales`],
              ["Current Role", data.current_role || "—"], ["Availability", data.availability],
              ["Capital Ready", data.capital_ready ? "Yes" : "No"],
              ["Territory", `${data.first_choice_state || "—"} / ${data.second_choice_state || "—"}`],
              ["Founding CP", data.founding_cp_requested ? "Yes" : "No"],
            ].map(([k,v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span style={{ color: "#8A92A8" }}>{k}</span><span style={{ color: "#FFFFFF" }}>{v}</span>
              </div>
            ))}
          </div>
          {error && <div style={{ color: "#E05050", fontSize: 13, padding: "8px 12px", background: "rgba(224,80,80,0.1)", border: "1px solid rgba(224,80,80,0.3)", borderRadius: 4 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(4)} style={btnBack}>← BACK</button>
            <button onClick={handleSubmit} disabled={submitting} style={{ ...btnGold, flex: 2, background: submitting ? "#333" : C.red, color: "#fff" }}>
              {submitting ? "SUBMITTING..." : "SECURE MY TERRITORY"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN LANDING PAGE ─────────────────────────────────────────────────────────
export default function ClaimRush({ lang, onSetLang }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    document.title = "Secure Territory. Capture Leads. Build Your Empire | ACI United";
    document.documentElement.lang = "en";
    const setMeta = (name, content, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", "Claim Rush — Secure your position, capture real property-loss leads, and build your empire. Limited positions available.");
    setMeta("og:title", "Secure Territory. Capture Leads. Build Your Empire | ACI United", "property");
    setMeta("og:description", "Claim Rush — Limited-time territory opportunity. $339K conservative Year 1 projections.", "property");
    const addLink = (rel, attrs) => {
      let el = document.querySelector(`link[rel="${rel}"][hreflang="${attrs.hreflang || ""}"]`) || document.querySelector(`link[rel="${rel}"]:not([hreflang])`);
      if (!el) { el = document.createElement("link"); document.head.appendChild(el); }
      el.setAttribute("rel", rel);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    };
    addLink("canonical", { href: "https://claimrush.aciunited.com/" });
    addLink("alternate", { hreflang: "en", href: "https://claimrush.aciunited.com/" });
    addLink("alternate", { hreflang: "es", href: "https://claimrush.aciunited.com/es" });
  }, []);

  const emailSeq = [
    { day: "DAY 1", subject: "Claim Rush started. 3 territories locked today.", preview: "Oregon, Nevada and Washington secured in the first 24 hours..." },
    { day: "DAY 3", subject: "Your county still open — for now.", preview: "We're seeing significant interest in your state. Here's what's left..." },
    { day: "DAY 5", subject: "X agents already positioned. Yours next?", preview: "The operators who moved early are already receiving lead flow..." },
  ];

  return (
    <div style={{ background: C.black, color: "#F4F0E8", minHeight: "100vh", fontFamily: "Georgia,serif", overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: ${C.gold}44; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${C.black}; } ::-webkit-scrollbar-thumb { background: ${C.goldDim}; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px ${C.gold}44} 50%{box-shadow:0 0 40px ${C.gold}88,0 0 80px ${C.gold}22} }
        .pulse { animation: pulse 2s infinite; }
        .glow-btn { animation: glow 3s infinite; }
        .hover-gold:hover { color: ${C.gold} !important; transition: color 0.2s; }
      `}</style>

      {/* STICKY NAV */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? `${C.black}ee` : "transparent", borderBottom: scrolled ? `1px solid ${C.border}` : "none", padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: scrolled ? "blur(10px)" : "none", transition: "all 0.3s" }}>
        <div style={{ color: "#C9A84C", fontWeight: 900, fontSize: 16, fontFamily: "'Courier New',monospace", letterSpacing: 3 }}>CLAIM RUSH™</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, fontFamily: "'Courier New',monospace", fontSize: 10, letterSpacing: 1 }}>
            <span style={{ color: "#F4F0E8", fontWeight: 900, padding: "4px 8px", background: `${C.gold}22`, borderRadius: "3px 0 0 3px", border: `1px solid ${C.gold}66` }}>EN</span>
            <span onClick={() => onSetLang("es")} style={{ color: C.muted, fontWeight: 600, padding: "4px 8px", cursor: "pointer", background: `${C.border}44`, borderRadius: "0 3px 3px 0", border: `1px solid ${C.border}`, borderLeft: "none" }}>ES</span>
          </div>
          <a href="#apply" style={{ background: C.red, color: "#fff", fontWeight: 900, fontSize: 11, padding: "8px 20px", borderRadius: 3, textDecoration: "none", fontFamily: "'Courier New',monospace", letterSpacing: 2 }}>SECURE TERRITORY</a>
        </div>
      </div>

      {/* TICKER */}
      <div style={{ paddingTop: 52 }}><Ticker /></div>

      {/* ── HERO ── */}
      <div style={{ minHeight: "92vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 40px 60px", textAlign: "center", position: "relative", animation: "slideDown 0.8s ease" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 40%, ${C.gold}08 0%, transparent 65%)`, pointerEvents: "none" }} />

        <div className="pulse" style={{ color: "#E03030", fontSize: 10, letterSpacing: 5, fontFamily: "'Courier New',monospace", marginBottom: 24, fontWeight: 700 }}>● CLAIM RUSH IS LIVE — TERRITORIES BEING ASSIGNED NOW</div>

        <div style={{ fontSize: "clamp(42px, 7vw, 86px)", fontWeight: 900, lineHeight: 1.0, fontFamily: "'Courier New',monospace", letterSpacing: -1, marginBottom: 8 }}>
          <div style={{ color: "#F4F0E8" }}>SECURE TERRITORY.</div>
          <div style={{ color: "#C9A84C" }}>CAPTURE LEADS.</div>
          <div style={{ color: "#F4F0E8" }}>BUILD EMPIRE.</div>
        </div>

        <div style={{ color: "#FFFFFF", fontSize: 12, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 40 }}>BEFORE IT'S CLAIMED.</div>

        <div style={{ maxWidth: 580, color: "#FFFFFF", fontSize: 18, lineHeight: 1.85, marginBottom: 16, fontFamily: "Georgia,serif" }}>
          Claim Rush is a limited-time opportunity to secure territory inside a system built to generate, distribute, and convert real property-loss opportunities into signed claims. Once territories are assigned and teams are built, entry becomes restricted.
        </div>

        <div style={{ maxWidth: 660, color: "#FFFFFF", fontSize: 13, lineHeight: 1.9, marginBottom: 48, fontFamily: "'Courier New',monospace", letterSpacing: 0.5, borderLeft: "2px solid #8A6E2A", paddingLeft: 16 }}>
          Backed by Unified Public Advocacy · 501(c)(3) Nonprofit · Powered by RIN™ · Executed through ACI · Expanded through Maximus.software · Strengthened by Academy of Adjusters
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <a href="#apply" className="glow-btn" style={{ background: C.gold, color: "#060810", fontWeight: 900, fontSize: 13, padding: "16px 36px", borderRadius: 3, textDecoration: "none", fontFamily: "'Courier New',monospace", letterSpacing: 2 }}>APPLY TO SECURE TERRITORY →</a>
          <a href="#how" style={{ background: "transparent", color: "#F4F0E8", fontWeight: 700, fontSize: 13, padding: "16px 36px", borderRadius: 3, textDecoration: "none", fontFamily: "'Courier New',monospace", letterSpacing: 1.5, border: `1px solid ${C.border}` }}>SEE HOW IT WORKS</a>
        </div>

        <div style={{ display: "flex", gap: 40, marginTop: 64, flexWrap: "wrap", justifyContent: "center" }}>
          <LiveCounter value={845} label="FIRE INCIDENTS TODAY" color={C.red} />
          <LiveCounter value={850} label="LEADS GENERATED TODAY" color={C.gold} />
          <LiveCounter value={7} label="TERRITORIES SECURED" color={C.blue} />
        </div>
      </div>

      {/* ── ECOSYSTEM ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: "1px solid #1A2840", background: "#0E1628" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14, textAlign: "center" }}>THE FULL PICTURE</div>
            <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 16, lineHeight: 1.1, color: "#F4F0E8" }}>
              This Is Not Software.<br /><span style={{ color: "#C9A84C" }}>This Is an Ecosystem.</span>
            </div>
            <div style={{ color: "#FFFFFF", fontSize: 16, textAlign: "center", maxWidth: 560, margin: "0 auto 56px", lineHeight: 1.7 }}>
              Built on trust, operations, revenue, growth, and workforce development.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 2 }}>
              {[
                { icon: "🏛", label: "UPA", sub: "TRUST LAYER", color: "#4A6CF7", points: ["501(c)(3) nonprofit", "Advocacy and education", "Public-facing credibility", "Outreach legitimacy"] },
                { icon: "📋", label: "ACI", sub: "REVENUE LAYER", color: "#C9A84C", points: ["Licensed claim execution", "Backend revenue participation", "Adjusting infrastructure", "State-licensed operations"] },
                { icon: "⚡", label: "RIN™", sub: "OPERATIONS LAYER", color: "#E03030", points: ["Live incident detection", "Lead routing and automation", "AI outreach and intake", "Territory-based distribution"] },
                { icon: "🚀", label: "MAXIMUS", sub: "GROWTH LAYER", color: "#A855F7", points: ["Marketing engine", "Recruiting system", "Landing pages", "Digital presence"] },
                { icon: "🎓", label: "ACADEMY", sub: "WORKFORCE LAYER", color: "#22C55E", points: ["Licensing support", "Training programs", "Apprenticeship pipeline", "Future agent development"] },
              ].map(item => (
                <div key={item.label} style={{ background: "#060810", border: "1px solid #1A2840", padding: "28px 22px" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                  <div style={{ color: item.color, fontWeight: 900, fontSize: 13, fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>{item.label}</div>
                  <div style={{ color: "#FFFFFF", fontSize: 11, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 14 }}>{item.sub}</div>
                  {item.points.map(p => (
                    <div key={p} style={{ color: "#FFFFFF", fontSize: 15, padding: "7px 0", borderBottom: "1px solid #1A2840", display: "flex", gap: 8 }}>
                      <span style={{ color: item.color, flexShrink: 0 }}>·</span>{p}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 32, color: "#FFFFFF", fontSize: 15, fontStyle: "italic", fontFamily: "Georgia,serif" }}>
              "Most competitors offer tools. This offers a complete market-building ecosystem."
            </div>
          </div>
        </div>
      </Section>

      {/* ── UPA TRUST LAYER ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: "1px solid #1A2840" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
            <div>
              <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14 }}>TRUST INFRASTRUCTURE</div>
              <div style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 20, lineHeight: 1.1, color: "#F4F0E8" }}>
                Backed by Unified<br />Public Advocacy —<br /><span style={{ color: "#4A6CF7" }}>A 501(c)(3) Advantage.</span>
              </div>
              <div style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 1.85, marginBottom: 24 }}>
                Unified Public Advocacy is a 501(c)(3) nonprofit built to educate and advocate for property owners during the claims process. This is not a marketing layer — it is a structural trust asset. In a market where homeowners are skeptical of contractors and adjusters, walking in backed by a nonprofit advocacy organization changes the conversation before it starts.
              </div>
              <div style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 1.85, marginBottom: 32 }}>
                UPA handles education and outreach. ACI handles adjusting. The separation is intentional, legal, and powerful — because most operators in this space can't say either.
              </div>
              <div style={{ background: "#4A6CF722", border: "1px solid #4A6CF744", borderRadius: 6, padding: "14px 18px" }}>
                <div style={{ color: "#FFFFFF", fontSize: 15, fontStyle: "italic", fontFamily: "Georgia,serif", lineHeight: 1.7 }}>"In a market full of noise, trust becomes a weapon."</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                { icon: "🏛", title: "Nonprofit Credibility", body: "A 501(c)(3) designation signals public mission — not just profit motive. That matters enormously when approaching homeowners who have already been approached by ten contractors." },
                { icon: "📚", title: "Education Positioning", body: "UPA educates property owners on their rights. That creates the opening. ACI steps in once trust is established. This sequencing is the difference between a cold pitch and a warm consultation." },
                { icon: "⚖️", title: "Outreach Legitimacy", body: "Because UPA operates as an advocacy organization, the first contact with a property owner is framed around helping — not selling. That changes close rates." },
                { icon: "🛡", title: "Structural Separation", body: "The legal and operational separation between UPA, ACI, and Respro is intentional architecture. Each entity does what it is designed to do — nothing more, nothing less." },
              ].map(item => (
                <div key={item.title} style={{ background: "#0E1628", border: "1px solid #1A2840", padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 13, fontFamily: "'Courier New',monospace", marginBottom: 5 }}>{item.title}</div>
                    <div style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 1.65 }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── ACADEMY OF ADJUSTERS ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: "1px solid #1A2840", background: "#0E1628" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                {[
                  { icon: "📜", label: "Licensing Support", desc: "Guidance through state licensing requirements so new agents enter the field fully credentialed.", color: "#22C55E" },
                  { icon: "🎯", label: "Training Programs", desc: "Structured curriculum covering claim identification, intake, negotiation, and platform operations.", color: "#22C55E" },
                  { icon: "🔗", label: "Apprenticeship Pathway", desc: "New agents learn under experienced operators — building skill and pipeline simultaneously.", color: "#22C55E" },
                  { icon: "📈", label: "Team Growth Engine", desc: "Chapter Presidents don't just recruit — they develop. The Academy turns prospects into producers.", color: "#22C55E" },
                ].map(item => (
                  <div key={item.label} style={{ background: "#060810", border: "1px solid #1A2840", padding: "22px 18px" }}>
                    <div style={{ fontSize: 26, marginBottom: 10 }}>{item.icon}</div>
                    <div style={{ color: item.color, fontWeight: 700, fontSize: 11, fontFamily: "'Courier New',monospace", marginBottom: 8 }}>{item.label}</div>
                    <div style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 1.65 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14 }}>WORKFORCE INFRASTRUCTURE</div>
                <div style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 20, lineHeight: 1.1, color: "#F4F0E8" }}>
                  Academy of Adjusters —<br /><span style={{ color: "#22C55E" }}>Built to Feed<br />the System.</span>
                </div>
                <div style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 1.85, marginBottom: 24 }}>
                  Scaling a territory operation has one limiting factor: people. The Academy of Adjusters is built to solve that problem directly — providing licensing support, structured training, and apprenticeship pathways that convert motivated candidates into productive licensed agents.
                </div>
                <div style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 1.85, marginBottom: 32 }}>
                  Chapter Presidents who build alongside the Academy don't just have a team — they have a pipeline. New agents are not a bottleneck. They are a compounding advantage.
                </div>
                <div style={{ background: "#22C55E22", border: "1px solid #22C55E44", borderRadius: 6, padding: "14px 18px" }}>
                  <div style={{ color: "#FFFFFF", fontSize: 15, fontStyle: "italic", fontFamily: "Georgia,serif", lineHeight: 1.7 }}>"The best territories don't wait for talent. They develop it."</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── WHAT YOU'RE SECURING ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14, textAlign: "center" }}>WHAT YOU ARE ACTUALLY SECURING</div>
          <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 16, lineHeight: 1.1 }}>You Are Not Buying Software.<br /><span style={{ color: "#C9A84C" }}>You Are Securing Position.</span></div>
          <div style={{ color: "#FFFFFF", fontSize: 16, textAlign: "center", maxWidth: 560, margin: "0 auto 56px", lineHeight: 1.7 }}>
            Tools are everywhere. Positions aren't. This is territory ownership with built-in lead flow.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
            {[
              { icon: "📍", label: "Chapter Position", desc: "Build and lead your own chapter within the network" },
              { icon: "⚡", label: "Lead Access", desc: "Live fire, storm, roof and crime opportunities flow to you" },
              { icon: "🔄", label: "System Leverage", desc: "AI does the outreach while you focus on closings" },
              { icon: "👥", label: "Team Infrastructure", desc: "Recruit agents beneath you — override on every claim" },
              { icon: "📈", label: "Income Scalability", desc: "Your income scales with your team's production" },
              { icon: "🏆", label: "Early-Mover Advantage", desc: "First in builds the team. Late arrivals compete against it" },
            ].map(item => (
              <div key={item.label} style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "28px 24px" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
                <div style={{ color: "#FFFFFF", fontWeight: 800, fontSize: 14, fontFamily: "'Courier New',monospace", letterSpacing: 1, marginBottom: 8 }}>{item.label}</div>
                <div style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 1.75 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── TERRITORY MAP ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, background: C.panel }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
              <div>
                <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14 }}>● TERRITORY STATUS — LIVE</div>
                <div style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 20, lineHeight: 1.1 }}>Once a Territory<br />Is Assigned —<br /><span style={{ color: "#E03030" }}>It Is Gone.</span></div>
                <div style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 1.85, marginBottom: 28 }}>
                  This isn't a platform you join later. Leads flow to Chapter Presidents operating inside the system. The earlier you secure your position, the faster you build your team and capture your market.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { stat: "3", label: "States Fully Secured", color: "#E03030" },
                    { stat: "4", label: "States with Limited Positions", color: "#C9A84C" },
                    { stat: "43+", label: "States Still Available", color: "#22C55E" },
                  ].map(s => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ color: s.color, fontSize: 24, fontWeight: 900, fontFamily: "'Courier New',monospace", minWidth: 50 }}>{s.stat}</div>
                      <div style={{ color: "#FFFFFF", fontSize: 12, fontFamily: "'Courier New',monospace" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <TerritoryMap />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── HOW THE MONEY WORKS ── */}
      <Section id="how">
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14, textAlign: "center" }}>HOW THE MONEY WORKS</div>
          <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 56, lineHeight: 1.1 }}>From Incident to Revenue.<br /><span style={{ color: "#C9A84C" }}>Automated.</span></div>

          <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", marginBottom: 48, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { icon: "🔥", label: "Incident\nDetected", color: "#E03030" },
              { icon: "⭐", label: "Lead\nCreated", color: "#C9A84C" },
              { icon: "🔄", label: "Rotation\nAssigned", color: "#2A70D0" },
              { icon: "📞", label: "AI\nOutreach", color: "#C9A84C" },
              { icon: "🤖", label: "AI\nIntake", color: "#22C55E" },
              { icon: "✍️", label: "Contract\nSigned", color: "#22C55E" },
              { icon: "💰", label: "Revenue\nFlows", color: "#C9A84C" },
            ].map((s, i, arr) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 8px" }}>
                  <div style={{ background: `${s.color}28`, border: `1px solid ${s.color}88`, borderRadius: 10, width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{s.icon}</div>
                  <div style={{ color: '#FFFFFF', fontSize: 13, fontFamily: "'Courier New',monospace", fontWeight: 700, textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.4 }}>{s.label}</div>
                </div>
                {i < arr.length - 1 && <div style={{ color: "#FFFFFF", fontSize: 20, marginBottom: 18 }}>→</div>}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "36px 32px" }}>
              <div style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 15, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 22 }}>SOFTWARE REVENUE STREAM</div>
              {["SaaS subscription per seat", "Platform licensing fees", "Seat expansion as team grows", "Enterprise deployment contracts"].map(i => (
                <div key={i} style={{ color: "#FFFFFF", fontSize: 15, padding: "13px 0", fontWeight: 500, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
                  <span style={{ color: "#2A70D0" }}>·</span> {i}
                </div>
              ))}
            </div>
            <div style={{ background: C.panel, border: `1px solid ${C.gold}44`, padding: "36px 32px" }}>
              <div style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 15, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 22 }}>CLAIM REVENUE STREAM</div>
              {["Override on every claim", "Adjusting fee participation", "Restoration margin participation", "Team production scaling"].map(i => (
                <div key={i} style={{ color: "#FFFFFF", fontSize: 15, padding: "13px 0", fontWeight: 500, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
                  <span style={{ color: "#C9A84C" }}>·</span> {i}
                </div>
              ))}
            </div>
          </div>


        </div>
      </Section>

      {/* ── INVESTMENT QUALIFICATION ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14, textAlign: "center" }}>COMPLETE INVESTMENT PICTURE</div>
            <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 16, lineHeight: 1.1 }}>
              This Is a Business.<br /><span style={{ color: "#C9A84C" }}>Not a Subscription.</span>
            </div>
            <div style={{ color: "#FFFFFF", fontSize: 16, textAlign: "center", maxWidth: 560, margin: "0 auto 48px", lineHeight: 1.7 }}>
              Claim Rush Chapter President positions are reserved for serious operators. The investment structure is designed to filter for commitment — and to deliver outsized returns to those who execute.
            </div>

            <div style={{ border: `1px solid ${C.gold}`, borderRadius: 4, padding: "36px 32px", marginBottom: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                <div style={{ background: C.panel, borderRadius: 6, padding: "24px 20px", border: `1px solid ${C.gold}55` }}>
                  <div style={{ color: C.gold, fontSize: 10, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 8 }}>FOUNDING CHAPTER PRESIDENT</div>
                  <div style={{ color: "#F4F0E8", fontSize: 32, fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 4 }}>$0</div>
                  <div style={{ color: C.gold, fontSize: 12, fontFamily: "'Courier New',monospace", fontWeight: 700 }}>Entry fee waived during launch window</div>
                  <div style={{ color: C.muted, fontSize: 12, fontFamily: "'Courier New',monospace", marginTop: 10 }}>$2,000/mo operating fee</div>
                  <div style={{ color: C.muted, fontSize: 11, fontFamily: "'Courier New',monospace", marginTop: 6 }}>20% commission override on SaaS fees from personally recruited network members</div>
                </div>
                <div style={{ background: C.panel, borderRadius: 6, padding: "24px 20px" }}>
                  <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 8 }}>STANDARD CHAPTER PRESIDENT</div>
                  <div style={{ color: "#F4F0E8", fontSize: 32, fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 4 }}>$100,000</div>
                  <div style={{ color: C.muted, fontSize: 12, fontFamily: "'Courier New',monospace" }}>One-time entry fee</div>
                  <div style={{ color: C.muted, fontSize: 12, fontFamily: "'Courier New',monospace", marginTop: 10 }}>$2,000/mo operating fee</div>
                  <div style={{ color: C.muted, fontSize: 11, fontFamily: "'Courier New',monospace", marginTop: 6 }}>20% commission override on SaaS fees from personally recruited network members</div>
                </div>
              </div>

              <div style={{ background: C.panel, borderRadius: 6, padding: "20px 24px", marginBottom: 24 }}>
                <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 16, textAlign: "center" }}>ROI AT CONSERVATIVE PROJECTIONS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: C.green, fontSize: 28, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>$339K</div>
                    <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New',monospace" }}>Year 1 revenue</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: C.green, fontSize: 28, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>$24K</div>
                    <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New',monospace" }}>Annual fee (7% of revenue)</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: C.green, fontSize: 28, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>$315K</div>
                    <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New',monospace" }}>Net year 1</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: C.panel, borderRadius: 6, padding: "18px 20px", textAlign: "center" }}>
                  <div style={{ color: C.green, fontSize: 24, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>$847K</div>
                  <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New',monospace" }}>Growth model year 1</div>
                </div>
                <div style={{ background: C.panel, borderRadius: 6, padding: "18px 20px", textAlign: "center" }}>
                  <div style={{ color: C.green, fontSize: 24, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>6 mo</div>
                  <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New',monospace" }}>To full ramp</div>
                </div>
              </div>
            </div>

            <div style={{ color: "#3D4F6A", fontSize: 10, textAlign: "center", lineHeight: 1.8, fontFamily: "'Courier New',monospace" }}>
              Income projections are estimates based on market activity and are not guarantees of earnings.<br />
              Individual results depend on agent roster, market volume, and CP operational execution.
            </div>
          </div>
        </div>
      </Section>

      {/* ── MAXIMUS MARKETING INCLUDED ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, background: C.panel }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{ background: C.black, border: `1px solid ${C.gold}`, borderRadius: 6, padding: "10px 18px", color: C.gold, fontSize: 14, fontWeight: 700, fontFamily: "'Courier New',monospace", flexShrink: 0 }}>maximus.software</div>
              <div>
                <div style={{ color: "#F4F0E8", fontSize: 18, fontWeight: 700, fontFamily: "'Courier New',monospace" }}>100-person dedicated marketing team <span style={{ background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}44`, borderRadius: 3, fontSize: 9, fontWeight: 700, padding: "2px 8px", letterSpacing: 0.5, marginLeft: 8 }}>INCLUDED</span></div>
                <div style={{ color: C.muted, fontSize: 13 }}>Every Chapter President gets a full marketing operation promoting their market — at no extra cost.</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
              {[
                { title: "Market promotion", desc: "Dedicated campaigns driving awareness and leads in your specific geography." },
                { title: "Digital marketing", desc: "Social, search, and content marketing handled by a professional team." },
                { title: "Brand support", desc: "UPA and RIN brand assets, campaigns, and messaging — ready to deploy." },
              ].map(item => (
                <div key={item.title} style={{ background: C.black, border: `1px solid ${C.border}`, padding: "20px 18px" }}>
                  <div style={{ color: "#F4F0E8", fontWeight: 700, fontSize: 13, fontFamily: "'Courier New',monospace", marginBottom: 6 }}>{item.title}</div>
                  <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── WHO THIS IS FOR ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, background: C.panel }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
              <div>
                <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14 }}>WHO THIS IS FOR</div>
                <div style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 20, lineHeight: 1.1 }}>We Are Selecting<br /><span style={{ color: "#C9A84C" }}>Operators.</span><br />Not Users.</div>
                <div style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 1.85, marginBottom: 28 }}>
                  This platform is not for casual participants. We are building chapter operations with serious principals who intend to grow a team and capture a market. Applications are reviewed before access is granted.
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {[
                  { role: "Public Adjusters", desc: "Licensed operators who want a live pipeline instead of waiting for referrals", icon: "📋", fit: true },
                  { role: "Agency Owners", desc: "Multi-agent organizations who want enterprise-grade routing and network control", icon: "🏢", fit: true },
                  { role: "Team Builders", desc: "Leaders who want to recruit agents beneath them and earn on production", icon: "👥", fit: true },
                  { role: "Passive Participants", desc: "We are not the right fit for those not ready to build and operate", icon: "✗", fit: false },
                ].map(item => (
                  <div key={item.role} style={{ background: item.fit ? C.black : `${C.redDim}44`, border: `1px solid ${item.fit ? C.border : C.redDim}`, padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <div style={{ color: item.fit ? "#FFFFFF" : C.muted, fontWeight: 700, fontSize: 14, fontFamily: "'Courier New',monospace", marginBottom: 6 }}>{item.role}</div>
                      <div style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 1.65 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── AI ADVANTAGE ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14, textAlign: "center" }}>THE AI ADVANTAGE</div>
          <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 16, lineHeight: 1.1 }}>
            More Conversations.<br /><span style={{ color: "#C9A84C" }}>More Closings. More Claims.</span>
          </div>
          <div style={{ color: "#FFFFFF", fontSize: 16, textAlign: "center", maxWidth: 560, margin: "0 auto 56px", lineHeight: 1.7 }}>
            The platform does not replace the adjuster. It gives the adjuster leverage. One agent with this system can initiate outreach on hundreds of leads per day. A traditional agent maxes at 50–60 manual calls.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2 }}>
            {[
              { name: "AI Voice Outreach", icon: "📞", color: "#2A70D0", desc: "Places hundreds of first-contact calls automatically. Logs every outcome. Routes interested leads directly to a live agent." },
              { name: "AI Sales Agent", icon: "🧠", color: "#C9A84C", desc: "Real-time objection handling, custom pitch scripts by peril type, and closing prompts for every conversation." },
              { name: "AI Lead Intake", icon: "🤖", color: "#22C55E", desc: "Structured qualification conversations 24 hours a day. Full intake data collected before any agent is involved." },
              { name: "AI Secretary", icon: "📅", color: "#E03030", desc: "Manages your follow-up queue, drafts messages, summarizes your pipeline every morning. Nothing slips." },
            ].map(t => (
              <div key={t.name} style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "28px 24px" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>{t.icon}</div>
                <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 14, fontFamily: "'Courier New',monospace", letterSpacing: 1, marginBottom: 10 }}>{t.name}</div>
                <div style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 1.75 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── MAXIMUS ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, background: C.panel }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14, textAlign: "center" }}>THE GROWTH LAYER</div>
            <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 20, lineHeight: 1.1 }}>
              Powered by <span style={{ color: "#C9A84C" }}>Maximus.software</span>
            </div>
            <div style={{ color: "#FFFFFF", fontSize: 16, textAlign: "center", maxWidth: 620, margin: "0 auto 48px", lineHeight: 1.7 }}>
              The portal drives operations. Maximus drives visibility and growth. Together they create a scalable expansion system — from lead generation all the way to market dominance.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <div style={{ background: C.black, border: `1px solid ${C.border}`, padding: "36px 32px" }}>
                <div style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 15, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 22 }}>⚡ RIN™ PORTAL — OPERATIONS</div>
                {["Live lead generation from real incidents", "AI outreach and intake automation", "Territory management and rotation", "Claim pipeline tracking", "Team operations and oversight"].map(i => (
                  <div key={i} style={{ color: "#FFFFFF", fontSize: 15, padding: "11px 0", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10 }}><span style={{ color: "#2A70D0" }}>·</span>{i}</div>
                ))}
              </div>
              <div style={{ background: C.black, border: `1px solid ${C.gold}44`, padding: "36px 32px" }}>
                <div style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 15, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 22 }}>🚀 MAXIMUS — GROWTH ENGINE</div>
                {["Landing pages for territory and recruiting", "Recruitment messaging and digital branding", "Local territory promotion", "AI-driven marketing operations", "Inbound opportunity and conversion support"].map(i => (
                  <div key={i} style={{ color: "#FFFFFF", fontSize: 15, padding: "11px 0", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10 }}><span style={{ color: "#C9A84C" }}>·</span>{i}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── EMAIL SEQUENCE PREVIEW ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14, textAlign: "center" }}>WHAT HAPPENS AFTER TERRITORIES FILL</div>
          <div style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 48, lineHeight: 1.1 }}>
            This Is the Message<br />You Don't Want to Receive.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 680, margin: "0 auto" }}>
            {emailSeq.map((email, i) => (
              <div key={i} style={{ background: C.panel, border: `1px solid ${i === 2 ? C.red : C.border}`, padding: "20px 24px" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ background: i === 2 ? C.red : C.border, color: i === 2 ? "#fff" : C.muted, fontSize: 9, fontFamily: "'Courier New',monospace", fontWeight: 700, padding: "4px 10px", borderRadius: 2, flexShrink: 0 }}>{email.day}</div>
                  <div>
                    <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{email.subject}</div>
                    <div style={{ color: "#FFFFFF", fontSize: 15 }}>{email.preview}</div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}`, padding: "20px 24px", textAlign: "center" }}>
              <div style={{ color: "#E03030", fontWeight: 900, fontSize: 13, fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>YOUR TERRITORY WAS SECURED BY ANOTHER OPERATOR.</div>
              <div style={{ color: "#FFFFFF", fontSize: 15, marginTop: 6 }}>They get the leads. They build the team. You compete against them.</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── OBJECTIONS ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, background: C.panel }}>
          <div style={{ maxWidth: 740, margin: "0 auto" }}>
            <div style={{ color: "#FFFFFF", fontSize: 13, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14, textAlign: "center" }}>OBJECTION CRUSHERS</div>
            <div style={{ fontSize: "clamp(24px, 3vw, 38px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 40, lineHeight: 1.2 }}>Every Reason to Wait<br /><span style={{ color: "#C9A84C" }}>Is a Reason Someone Else Won't.</span></div>
            {[
              { q: "Is this just another lead tool?", a: "No. It's a Chapter President position with built-in lead flow. Tools are everywhere. Positions aren't. Early movers build teams and capture markets before others even enter." },
              { q: "What if I miss it?", a: "Then someone else builds the team first. They establish dominance first. The earlier you enter, the larger your network and the greater your override income." },
              { q: "Can I do it later?", a: "Founding Chapter President positions are limited to the launch window. Once the window closes, entry requires the Standard $100,000 fee. The economics favor those who move first." },
              { q: "How much does it cost?", a: "Founding Chapter Presidents enter for $0 during the launch window with a $2,000/mo operating fee. Standard entry is $100,000 plus the same monthly fee. Both tiers earn a 20% commission override on SaaS fees from personally recruited network members. Conservative Year 1 projections show $339K revenue against $24K in fees — a 6x+ return." },
              { q: "How do I know leads are real?", a: "The system detects incidents from live emergency feeds including PulsePoint — the same source fire departments use. These are real dispatched events at real addresses, scored by AI, in near real time." },
            ].map(obj => <Objection key={obj.q} q={obj.q} a={obj.a} />)}
          </div>
        </div>
      </Section>

      {/* ── COMMUNITY ALIGNMENT (compliance-safe) ── */}
      <Section>
        <div style={{ padding: "60px 40px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
            <div style={{ color: C.gold, fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16 }}>● MORE THAN JUST CLAIMS</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#FFFFFF", fontFamily: "'Courier New',monospace", marginBottom: 16 }}>
              A Model Built for <span style={{ color: C.gold }}>Real Impact</span>
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, lineHeight: 1.85, marginBottom: 20 }}>
              ACI supports the mission of Unified Public Advocacy, a nonprofit organization currently developing programs focused on helping underserved homeowners and promoting workforce development in disaster recovery. Program availability may be limited by region as initiatives scale.
            </div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.7 }}>
              Chapter Presidents may choose to personally volunteer their time in support of UPA's mission. This participation is entirely optional and is separate from commercial territory operations. UPA operates independently as a 501(c)(3), and nonprofit resources do not flow to Chapter Presidents or their businesses.
            </div>
          </div>
        </div>
      </Section>

      {/* ── APPLICATION ── */}
      <Section id="apply">
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "start" }}>
            <div>
              <div className="pulse" style={{ color: "#E03030", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16 }}>● TERRITORIES BEING ASSIGNED NOW</div>
              <div style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, fontFamily: "'Courier New',monospace", lineHeight: 1.1, marginBottom: 20 }}>
                Apply to<br /><span style={{ color: "#C9A84C" }}>Secure Your<br />Territory.</span>
              </div>
              <div style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 1.85, marginBottom: 32 }}>
                This is not a signup form. This is an application. Territories are selectively assigned to operators who are ready to build. A senior team member reviews every application before access is granted.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {["We are not onboarding everyone", "Territories are selectively assigned", "This is for operators ready to build — not just try", "Once filled, territories are closed"].map(line => (
                  <div key={line} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ color: "#E03030", fontFamily: "'Courier New',monospace", flexShrink: 0 }}>✗</span>
                    <span style={{ color: "#FFFFFF", fontSize: 15 }}>{line}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: C.panel, border: `1px solid ${C.gold}55`, padding: "36px 32px", borderRadius: 2 }}>
              <div style={{ color: "#C9A84C", fontWeight: 900, fontSize: 13, fontFamily: "'Courier New',monospace", letterSpacing: 2, marginBottom: 24 }}>TERRITORY APPLICATION</div>
              <ApplicationForm />
            </div>
          </div>
        </div>
      </Section>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ color: "#C9A84C", fontWeight: 900, fontSize: 14, fontFamily: "'Courier New',monospace", letterSpacing: 3 }}>CLAIM RUSH™</div>
        <div style={{ color: "#FFFFFF", fontSize: 13, fontFamily: "'Courier New',monospace" }}>Powered by RIN™ · ACI · Unified Public Advocacy · Maximus.software</div>
        <div style={{ color: "#FFFFFF", fontSize: 12, fontFamily: "'Courier New',monospace" }}>Secure Territory. Capture Leads. Build Empire.</div>
      </div>
    </div>
  );
}
