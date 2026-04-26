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
  const label = { secured: "ASEGURADO", limited: "LIMITADO", open: "DISPONIBLE" };

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
            <span style={{ color: hovered === s.name ? "#fff" : color[s.status], fontSize: 9, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>{s.name}</span>
          </div>
        ) : (
          <div key={i} style={{ background: "transparent" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        {[["secured", "ASEGURADO"], ["limited", "LIMITADO"], ["open", "DISPONIBLE"]].map(([k, l]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color[k] }} />
            <span style={{ color: "#FFFFFF", fontSize: 9, fontFamily: "'Courier New',monospace", letterSpacing: 1.5 }}>{l}</span>
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
      <div style={{ color: "#FFFFFF", fontSize: 9, letterSpacing: 2, marginTop: 6, fontFamily: "'Courier New',monospace" }}>{label}</div>
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
        <div style={{ color: "#FFFFFF", fontSize: 15, fontFamily: "Georgia,serif", fontWeight: 600 }}>{q}</div>
        <div style={{ color: "#C9A84C", fontSize: 18, flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(45deg)" : "none" }}>+</div>
      </div>
      {open && <div style={{ color: "#FFFFFF", fontSize: 14, marginTop: 12, lineHeight: 1.8, fontFamily: "Georgia,serif", borderLeft: `2px solid ${C.gold}`, paddingLeft: 14 }}>{a}</div>}
    </div>
  );
}

// ── APPLICATION FORM ──────────────────────────────────────────────────────────
function ApplicationForm() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({ name: "", email: "", phone: "", state: "", role: "", experience: "" });
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  if (step === 3) return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
      <div style={{ color: "#C9A84C", fontWeight: 900, fontSize: 22, fontFamily: "'Courier New',monospace", letterSpacing: 2, marginBottom: 12 }}>SOLICITUD RECIBIDA</div>
      <div style={{ color: "#FFFFFF", fontSize: 14, fontFamily: "Georgia,serif", lineHeight: 1.7 }}>Tu solicitud de territorio está bajo revisión. Un operador senior se comunicará contigo dentro de las 24 horas para discutir el posicionamiento y los próximos pasos.</div>
      <div style={{ marginTop: 20, color: "#E03030", fontSize: 11, fontFamily: "'Courier New',monospace", letterSpacing: 2 }}>● TU TERRITORIO ESTÁ SIENDO RETENIDO PENDIENTE DE REVISIÓN</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 0, marginBottom: 24 }}>
        {[1, 2].map(s => (
          <div key={s} style={{ flex: 1, height: 3, background: step >= s ? C.gold : C.border, transition: "all 0.3s" }} />
        ))}
      </div>

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 3, fontFamily: "'Courier New',monospace", marginBottom: 4 }}>PASO 1 — IDENTIFICACIÓN</div>
          {[["Nombre Completo", "name", "text"], ["Correo Electrónico", "email", "email"], ["Número de Teléfono", "phone", "tel"]].map(([label, key, type]) => (
            <div key={key}>
              <div style={{ color: "#FFFFFF", fontSize: 10, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 6 }}>{label}</div>
              <input type={type} value={data[key]} onChange={e => set(key, e.target.value)}
                style={{ width: "100%", background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "10px 14px", color: "#F4F0E8", fontSize: 13, fontFamily: "Georgia,serif", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <button onClick={() => setStep(2)} style={{ background: C.gold, color: "#060810", fontWeight: 900, fontSize: 13, padding: "13px 0", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "'Courier New',monospace", letterSpacing: 2, marginTop: 6 }}>CONTINUAR →</button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 3, fontFamily: "'Courier New',monospace", marginBottom: 4 }}>PASO 2 — TU POSICIÓN</div>
          <div>
            <div style={{ color: "#FFFFFF", fontSize: 10, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 6 }}>Territorio Objetivo (Estado)</div>
            <input value={data.state} onChange={e => set("state", e.target.value)} placeholder="ej. Florida, Texas, California"
              style={{ width: "100%", background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "10px 14px", color: "#F4F0E8", fontSize: 13, fontFamily: "Georgia,serif", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ color: "#FFFFFF", fontSize: 10, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 6 }}>Estoy Solicitando Como</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["Presidente de Capítulo — Quiero construir un equipo", "Ajustador Licenciado — Quiero gestionar mi propio pipeline", "Dueño de Agencia — Quiero despliegue empresarial", "Explorando — Quiero más información"].map(opt => (
                <div key={opt} onClick={() => set("role", opt)}
                  style={{ background: data.role === opt ? `${C.gold}18` : C.panel2, border: `1px solid ${data.role === opt ? C.gold : C.border}`, borderRadius: 4, padding: "10px 14px", cursor: "pointer", color: data.role === opt ? C.gold : C.muted, fontSize: 12, fontFamily: "Georgia,serif", transition: "all 0.2s" }}>
                  {opt}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, background: "transparent", color: "#FFFFFF", fontWeight: 700, fontSize: 12, padding: "13px 0", borderRadius: 4, border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: "'Courier New',monospace" }}>← ATRÁS</button>
            <button onClick={() => setStep(3)} style={{ flex: 2, background: C.red, color: "#fff", fontWeight: 900, fontSize: 13, padding: "13px 0", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "'Courier New',monospace", letterSpacing: 1.5 }}>ASEGURAR MI TERRITORIO</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN LANDING PAGE ─────────────────────────────────────────────────────────
export default function ClaimRushES({ lang, onSetLang }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    document.title = "Asegura Territorio. Captura Oportunidades. Construye Tu Imperio | ACI United";
    document.documentElement.lang = "es";
    const setMeta = (name, content, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", "Unified Public Advocacy — Asegura tu posición, captura oportunidades reales de propiedad y construye tu imperio. Posiciones limitadas disponibles.");
    setMeta("og:title", "Asegura Territorio. Captura Oportunidades. Construye Tu Imperio | ACI United", "property");
    setMeta("og:description", "Unified Public Advocacy — Oportunidad territorial por tiempo limitado. Proyecciones conservadoras de $339K en el Año 1.", "property");
    const addLink = (rel, attrs) => {
      let el = document.querySelector(`link[rel="${rel}"][hreflang="${attrs.hreflang || ""}"]`) || document.querySelector(`link[rel="${rel}"]:not([hreflang])`);
      if (!el) { el = document.createElement("link"); document.head.appendChild(el); }
      el.setAttribute("rel", rel);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    };
    addLink("canonical", { href: "https://claimrush.aciunited.com/es" });
    addLink("alternate", { hreflang: "en", href: "https://claimrush.aciunited.com/" });
    addLink("alternate", { hreflang: "es", href: "https://claimrush.aciunited.com/es" });
  }, []);

  const emailSeq = [
    { day: "DÍA 1", subject: "Programa de territorios lanzado. 3 territorios bloqueados hoy.", preview: "Oregón, Nevada y Washington asegurados en las primeras 24 horas..." },
    { day: "DÍA 3", subject: "Tu condado sigue disponible — por ahora.", preview: "Estamos viendo un interés significativo en tu estado. Esto es lo que queda..." },
    { day: "DÍA 5", subject: "X agentes ya posicionados. ¿El tuyo es el siguiente?", preview: "Los operadores que actuaron rápido ya están recibiendo oportunidades..." },
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
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ color: "#C9A84C", fontWeight: 900, fontSize: 14, fontFamily: "'Courier New',monospace", letterSpacing: 2.5 }}>UNIFIED PUBLIC ADVOCACY</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 9, fontFamily: "'Courier New',monospace", letterSpacing: 1.5 }}>Impulsado por ACI Adjustment Group</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, fontFamily: "'Courier New',monospace", fontSize: 10, letterSpacing: 1 }}>
            <span onClick={() => onSetLang("en")} style={{ color: C.muted, fontWeight: 600, padding: "4px 8px", cursor: "pointer", background: `${C.border}44`, borderRadius: "3px 0 0 3px", border: `1px solid ${C.border}` }}>EN</span>
            <span style={{ color: "#F4F0E8", fontWeight: 900, padding: "4px 8px", background: `${C.gold}22`, borderRadius: "0 3px 3px 0", border: `1px solid ${C.gold}66`, borderLeft: "none" }}>ES</span>
          </div>
          <a href="#apply" style={{ background: C.red, color: "#fff", fontWeight: 900, fontSize: 11, padding: "8px 20px", borderRadius: 3, textDecoration: "none", fontFamily: "'Courier New',monospace", letterSpacing: 2 }}>ASEGURAR TERRITORIO</a>
        </div>
      </div>

      {/* TICKER */}
      <div style={{ paddingTop: 52 }}><Ticker /></div>

      {/* ── HERO ── */}
      <div style={{ minHeight: "92vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 40px 60px", textAlign: "center", position: "relative", animation: "slideDown 0.8s ease" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 40%, ${C.gold}08 0%, transparent 65%)`, pointerEvents: "none" }} />

        <div className="pulse" style={{ color: "#E03030", fontSize: 10, letterSpacing: 5, fontFamily: "'Courier New',monospace", marginBottom: 24, fontWeight: 700 }}>● UNIFIED PUBLIC ADVOCACY — TERRITORIOS SIENDO ASIGNADOS AHORA</div>

        <div style={{ fontSize: "clamp(42px, 7vw, 86px)", fontWeight: 900, lineHeight: 1.0, fontFamily: "'Courier New',monospace", letterSpacing: -1, marginBottom: 8 }}>
          <div style={{ color: "#F4F0E8" }}>ASEGURAR TERRITORIO.</div>
          <div style={{ color: "#C9A84C" }}>CAPTURA OPORTUNIDADES.</div>
          <div style={{ color: "#F4F0E8" }}>CONSTRUYE TU IMPERIO.</div>
        </div>

        <div style={{ color: "#FFFFFF", fontSize: 12, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 40 }}>ANTES DE QUE SEA RECLAMADO.</div>

        <div style={{ maxWidth: 580, color: "#FFFFFF", fontSize: 16, lineHeight: 1.85, marginBottom: 16, fontFamily: "Georgia,serif" }}>
          Unified Public Advocacy abre un programa territorial por tiempo limitado, diseñado para generar, distribuir y convertir oportunidades reales de pérdida de propiedad en reclamaciones firmadas. Una vez que los territorios son asignados y los equipos están formados, el acceso se restringe.
        </div>

        <div style={{ maxWidth: 660, color: "#FFFFFF", fontSize: 11, lineHeight: 1.9, marginBottom: 48, fontFamily: "'Courier New',monospace", letterSpacing: 0.5, borderLeft: "2px solid #8A6E2A", paddingLeft: 16 }}>
          Unified Public Advocacy · Organización sin fines de lucro 501(c)(3) · Impulsado por ACI Adjustment Group · Construido sobre una Plataforma Avanzada de Inteligencia de Reclamaciones propia · Expandido por Maximus.software · Fortalecido por Academy of Adjusters
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <a href="#apply" className="glow-btn" style={{ background: C.gold, color: "#060810", fontWeight: 900, fontSize: 13, padding: "16px 36px", borderRadius: 3, textDecoration: "none", fontFamily: "'Courier New',monospace", letterSpacing: 2 }}>SOLICITAR TERRITORIO →</a>
          <a href="#how" style={{ background: "transparent", color: "#F4F0E8", fontWeight: 700, fontSize: 13, padding: "16px 36px", borderRadius: 3, textDecoration: "none", fontFamily: "'Courier New',monospace", letterSpacing: 1.5, border: `1px solid ${C.border}` }}>VER CÓMO FUNCIONA</a>
        </div>

        <div style={{ display: "flex", gap: 40, marginTop: 64, flexWrap: "wrap", justifyContent: "center" }}>
          <LiveCounter value={845} label="INCENDIOS DETECTADOS HOY" color={C.red} />
          <LiveCounter value={850} label="OPORTUNIDADES GENERADAS HOY" color={C.gold} />
          <LiveCounter value={7} label="TERRITORIES SECURED" color={C.blue} />
        </div>
      </div>

      {/* ── ECOSISTEMA ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: "1px solid #1A2840", background: "#0E1628" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16, textAlign: "center" }}>EL PANORAMA COMPLETO</div>
            <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 16, lineHeight: 1.1, color: "#F4F0E8" }}>
              Esto No Es Software.<br /><span style={{ color: "#C9A84C" }}>Esto Es un Ecosistema.</span>
            </div>
            <div style={{ color: "#FFFFFF", fontSize: 15, textAlign: "center", maxWidth: 560, margin: "0 auto 56px", lineHeight: 1.7 }}>
              Construido sobre confianza, operaciones, ingresos, crecimiento y desarrollo de personal.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 2 }}>
              {[
                { icon: "🏛", label: "UPA", sub: "CAPA DE CONFIANZA", color: "#4A6CF7", points: ["Organización 501(c)(3)", "Posicionamiento de educación y defensa", "Credibilidad pública", "Legitimidad de alcance"] },
                { icon: "📋", label: "ACI", sub: "CAPA DE INGRESOS", color: "#C9A84C", points: ["Ejecución de reclamaciones licenciadas", "Participación en ingresos", "Infraestructura de ajuste", "Operaciones con licencia estatal"] },
                { icon: "⚡", label: "Claims Intelligence Platform", sub: "CAPA DE OPERACIONES", color: "#E03030", points: ["Detección de incidentes en vivo", "Enrutamiento y automatización", "Contacto e ingreso con IA", "Distribución por territorio"] },
                { icon: "🚀", label: "MAXIMUS", sub: "CAPA DE CRECIMIENTO", color: "#A855F7", points: ["Motor de marketing", "Sistema de reclutamiento", "Páginas de aterrizaje", "Presencia digital"] },
                { icon: "🎓", label: "ACADEMY", sub: "CAPA DE PERSONAL", color: "#22C55E", points: ["Apoyo en licencias", "Programas de entrenamiento", "Camino de aprendizaje", "Desarrollo futuro de agentes"] },
              ].map(item => (
                <div key={item.label} style={{ background: "#060810", border: "1px solid #1A2840", padding: "28px 22px" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                  <div style={{ color: item.color, fontWeight: 900, fontSize: 13, fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>{item.label}</div>
                  <div style={{ color: "#FFFFFF", fontSize: 9, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 14 }}>{item.sub}</div>
                  {item.points.map(p => (
                    <div key={p} style={{ color: "#FFFFFF", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #1A2840", display: "flex", gap: 8 }}>
                      <span style={{ color: item.color, flexShrink: 0 }}>·</span>{p}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 32, color: "#FFFFFF", fontSize: 13, fontStyle: "italic", fontFamily: "Georgia,serif" }}>
              "La mayoría de los competidores ofrecen herramientas. Esto ofrece un ecosistema completo de construcción de mercado."
            </div>
          </div>
        </div>
      </Section>

      {/* ── UPA CAPA DE CONFIANZA ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: "1px solid #1A2840" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
            <div>
              <div style={{ color: "#4A6CF7", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14 }}>INFRAESTRUCTURA DE CONFIANZA</div>
              <div style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 20, lineHeight: 1.1, color: "#F4F0E8" }}>
                Respaldado por Unified<br />Public Advocacy —<br /><span style={{ color: "#4A6CF7" }}>Una Ventaja 501(c)(3).</span>
              </div>
              <div style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>
                Unified Public Advocacy es una organización sin fines de lucro 501(c)(3) construida para educar y defender a los propietarios durante el proceso de reclamaciones. No es una capa de marketing — es un activo de confianza estructural. En un mercado donde los propietarios desconfían de los contratistas y ajustadores, entrar respaldado por una organización sin fines de lucro cambia la conversación antes de que comience.
              </div>
              <div style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 1.8, marginBottom: 32 }}>
                UPA maneja la educación y el alcance. ACI maneja el ajuste. La separación es intencional, legal y poderosa.
              </div>
              <div style={{ background: "#4A6CF722", border: "1px solid #4A6CF744", borderRadius: 6, padding: "14px 18px" }}>
                <div style={{ color: "#FFFFFF", fontSize: 15, fontStyle: "italic", fontFamily: "Georgia,serif", lineHeight: 1.7 }}>"En un mercado lleno de ruido, la confianza se convierte en un arma."</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                { icon: "🏛", title: "Credibilidad Sin Fines de Lucro", body: "La designación 501(c)(3) señala misión pública — no solo motivación de ganancia. Eso importa enormemente cuando te acercas a propietarios que ya han sido contactados por diez contratistas." },
                { icon: "📚", title: "Posicionamiento Educativo", body: "UPA educa a los propietarios sobre sus derechos. Eso crea la apertura. ACI entra una vez que se establece la confianza. Esta secuencia es la diferencia entre un discurso frío y una consulta cálida." },
                { icon: "⚖️", title: "Legitimidad de Alcance", body: "Porque UPA opera como una organización de defensa, el primer contacto con un propietario se enmarca en ayudar — no en vender. Eso cambia las tasas de cierre." },
                { icon: "🛡", title: "Separación Estructural", body: "La separación legal y operativa entre UPA, ACI y Respro es arquitectura intencional. Cada entidad hace lo que está diseñada para hacer — nada más, nada menos." },
              ].map(item => (
                <div key={item.title} style={{ background: "#0E1628", border: "1px solid #1A2840", padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 13, fontFamily: "'Courier New',monospace", marginBottom: 5 }}>{item.title}</div>
                    <div style={{ color: "#FFFFFF", fontSize: 12, lineHeight: 1.6 }}>{item.body}</div>
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
                  { icon: "📜", label: "Apoyo en Licencias", desc: "Orientación a través de los requisitos de licencia estatal para que los nuevos agentes entren al campo completamente acreditados.", color: "#22C55E" },
                  { icon: "🎯", label: "Programas de Entrenamiento", desc: "Currículo estructurado que cubre identificación de reclamaciones, ingreso, negociación y operaciones de plataforma.", color: "#22C55E" },
                  { icon: "🔗", label: "Camino de Aprendizaje", desc: "Los nuevos agentes aprenden bajo operadores experimentados — construyendo habilidades y pipeline simultáneamente.", color: "#22C55E" },
                  { icon: "📈", label: "Motor de Crecimiento", desc: "Los Presidentes de Capítulo no solo reclutan — desarrollan. La Academy convierte prospectos en productores.", color: "#22C55E" },
                ].map(item => (
                  <div key={item.label} style={{ background: "#060810", border: "1px solid #1A2840", padding: "22px 18px" }}>
                    <div style={{ fontSize: 26, marginBottom: 10 }}>{item.icon}</div>
                    <div style={{ color: item.color, fontWeight: 700, fontSize: 11, fontFamily: "'Courier New',monospace", marginBottom: 8 }}>{item.label}</div>
                    <div style={{ color: "#FFFFFF", fontSize: 12, lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ color: "#22C55E", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14 }}>INFRAESTRUCTURA DE PERSONAL</div>
                <div style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 20, lineHeight: 1.1, color: "#F4F0E8" }}>
                  Academy of Adjusters —<br /><span style={{ color: "#22C55E" }}>Construida para<br />Alimentar el Sistema.</span>
                </div>
                <div style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>
                  Escalar una operación territorial tiene un factor limitante: las personas. La Academy of Adjusters está construida para resolver ese problema directamente — proporcionando apoyo en licencias, entrenamiento estructurado y caminos de aprendizaje que convierten candidatos motivados en agentes licenciados productivos.
                </div>
                <div style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 1.8, marginBottom: 32 }}>
                  Los Presidentes de Capítulo que construyen junto a la Academy no solo tienen un equipo — tienen un pipeline. Los nuevos agentes no son un cuello de botella. Son una ventaja compuesta.
                </div>
                <div style={{ background: "#22C55E22", border: "1px solid #22C55E44", borderRadius: 6, padding: "14px 18px" }}>
                  <div style={{ color: "#FFFFFF", fontSize: 15, fontStyle: "italic", fontFamily: "Georgia,serif", lineHeight: 1.7 }}>"Los mejores territorios no esperan talento. Lo desarrollan."</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── WHAT YOU'RE SECURING ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16, textAlign: "center" }}>LO QUE REALMENTE ESTÁS ASEGURANDO</div>
          <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 16, lineHeight: 1.1 }}>No Estás Comprando Software.<br /><span style={{ color: "#C9A84C" }}>Estás Asegurando Tu Posición.</span></div>
          <div style={{ color: "#FFFFFF", fontSize: 15, textAlign: "center", maxWidth: 560, margin: "0 auto 56px", lineHeight: 1.7 }}>
            Las herramientas están en todos lados. Las posiciones no. Esto es propiedad de territorio con flujo de oportunidades integrado.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
            {[
              { icon: "📍", label: "Posición de Capítulo", desc: "Construye y lidera tu propio capítulo dentro de la red" },
              { icon: "⚡", label: "Acceso a Oportunidades", desc: "Oportunidades en vivo de incendio, tormenta, techo y crimen fluyen hacia ti" },
              { icon: "🔄", label: "Apalancamiento del Sistema", desc: "La IA hace el contacto inicial mientras tú te enfocas en cerrar" },
              { icon: "👥", label: "Infraestructura de Equipo", desc: "Recluta agentes bajo tu mando — comisión en cada reclamación" },
              { icon: "📈", label: "Escalabilidad de Ingresos", desc: "Tus ingresos escalan con la producción de tu equipo y red" },
              { icon: "🏆", label: "Ventaja del Primer Movimiento", desc: "El primero en llegar construye el equipo. Los tardíos compiten contra él" },
            ].map(item => (
              <div key={item.label} style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "28px 24px" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
                <div style={{ color: "#FFFFFF", fontWeight: 800, fontSize: 14, fontFamily: "'Courier New',monospace", letterSpacing: 1, marginBottom: 8 }}>{item.label}</div>
                <div style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 1.7 }}>{item.desc}</div>
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
                <div style={{ color: "#E03030", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14 }}>● ESTADO DE TERRITORIOS — EN VIVO</div>
                <div style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 20, lineHeight: 1.1 }}>Once a Territory<br />Is Assigned —<br /><span style={{ color: "#E03030" }}>Desaparece.</span></div>
                <div style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 1.75, marginBottom: 28 }}>
                  Esta no es una plataforma a la que te unes después. Las oportunidades fluyen a los Presidentes de Capítulo que operan dentro del sistema. Cuanto antes asegures tu posición, más rápido construyes tu equipo y capturas tu mercado.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { stat: "3", label: "Estados Completamente Asegurados", color: "#E03030" },
                    { stat: "4", label: "Estados con Posiciones Limitadas", color: "#C9A84C" },
                    { stat: "43+", label: "Estados Aún Disponibles", color: "#22C55E" },
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

      {/* ── CÓMO FUNCIONA EL MODELO DE INGRESOS ── */}
      <Section id="how">
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16, textAlign: "center" }}>CÓMO FUNCIONA EL MODELO DE INGRESOS</div>
          <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 56, lineHeight: 1.1 }}>Del Incidente a los Ingresos.<br /><span style={{ color: "#C9A84C" }}>Automatizado.</span></div>

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
                  <div style={{ background: `${s.color}18`, border: `1px solid ${s.color}55`, borderRadius: 10, width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{s.icon}</div>
                  <div style={{ color: '#FFFFFF', fontSize: 13, fontFamily: "'Courier New',monospace", fontWeight: 700, textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.3 }}>{s.label}</div>
                </div>
                {i < arr.length - 1 && <div style={{ color: "#FFFFFF", fontSize: 20, marginBottom: 18 }}>→</div>}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "32px 28px" }}>
              <div style={{ color: "#2A70D0", fontWeight: 900, fontSize: 11, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 20 }}>FLUJO DE INGRESOS — SOFTWARE</div>
              {["Suscripción SaaS por usuario", "Tarifas de licencia de plataforma", "Expansión de asientos al crecer el equipo", "Contratos de despliegue empresarial"].map(i => (
                <div key={i} style={{ color: "#F4F0E8", fontSize: 15, padding: "13px 0", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
                  <span style={{ color: "#2A70D0" }}>·</span> {i}
                </div>
              ))}
            </div>
            <div style={{ background: C.panel, border: `1px solid ${C.gold}44`, padding: "32px 28px" }}>
              <div style={{ color: "#C9A84C", fontWeight: 900, fontSize: 11, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 20 }}>FLUJO DE INGRESOS — RECLAMACIONES</div>
              {["Comisión en cada reclamación", "Participación en tarifas de ajuste", "Participación en márgenes de restauración", "Escala con la producción del equipo"].map(i => (
                <div key={i} style={{ color: "#F4F0E8", fontSize: 15, padding: "13px 0", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
                  <span style={{ color: "#C9A84C" }}>·</span> {i}
                </div>
              ))}
            </div>
          </div>


        </div>
      </Section>

      {/* ── INVERSIÓN Y CALIFICACIÓN ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16, textAlign: "center" }}>PANORAMA COMPLETO DE INVERSIÓN</div>
            <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 16, lineHeight: 1.1 }}>
              Esto Es un Negocio.<br /><span style={{ color: "#C9A84C" }}>No una Suscripción.</span>
            </div>
            <div style={{ color: "#FFFFFF", fontSize: 15, textAlign: "center", maxWidth: 560, margin: "0 auto 48px", lineHeight: 1.7 }}>
              Las posiciones de Presidente de Capítulo de Unified Public Advocacy están reservadas para operadores serios. La estructura de inversión está diseñada para filtrar por compromiso — y para entregar retornos superiores a quienes ejecutan.
            </div>

            <div style={{ border: `1px solid ${C.gold}`, borderRadius: 4, padding: "36px 32px", marginBottom: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                <div style={{ background: C.panel, borderRadius: 6, padding: "24px 20px", border: `1px solid ${C.gold}55` }}>
                  <div style={{ color: C.gold, fontSize: 10, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 8 }}>PRESIDENTE DE CAPÍTULO FUNDADOR</div>
                  <div style={{ color: "#F4F0E8", fontSize: 32, fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 4 }}>$0</div>
                  <div style={{ color: C.gold, fontSize: 12, fontFamily: "'Courier New',monospace", fontWeight: 700 }}>Cuota de entrada exonerada durante ventana de lanzamiento</div>
                  <div style={{ color: C.muted, fontSize: 12, fontFamily: "'Courier New',monospace", marginTop: 10 }}>Tarifa operativa de $2,000/mes</div>
                  <div style={{ color: C.muted, fontSize: 11, fontFamily: "'Courier New',monospace", marginTop: 6 }}>20% de comisión sobre tarifas SaaS de miembros reclutados personalmente</div>
                </div>
                <div style={{ background: C.panel, borderRadius: 6, padding: "24px 20px" }}>
                  <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 8 }}>PRESIDENTE DE CAPÍTULO ESTÁNDAR</div>
                  <div style={{ color: "#F4F0E8", fontSize: 32, fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 4 }}>$100,000</div>
                  <div style={{ color: C.muted, fontSize: 12, fontFamily: "'Courier New',monospace" }}>Cuota de entrada única</div>
                  <div style={{ color: C.muted, fontSize: 12, fontFamily: "'Courier New',monospace", marginTop: 10 }}>Tarifa operativa de $2,000/mes</div>
                  <div style={{ color: C.muted, fontSize: 11, fontFamily: "'Courier New',monospace", marginTop: 6 }}>20% de comisión sobre tarifas SaaS de miembros reclutados personalmente</div>
                </div>
              </div>

              <div style={{ background: C.panel, borderRadius: 6, padding: "20px 24px", marginBottom: 24 }}>
                <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 16, textAlign: "center" }}>ROI CON PROYECCIONES CONSERVADORAS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: C.green, fontSize: 28, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>$339K</div>
                    <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New',monospace" }}>Ingresos Año 1</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: C.green, fontSize: 28, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>$24K</div>
                    <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New',monospace" }}>Tarifa anual (7% de ingresos)</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: C.green, fontSize: 28, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>$315K</div>
                    <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New',monospace" }}>Neto Año 1</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: C.panel, borderRadius: 6, padding: "18px 20px", textAlign: "center" }}>
                  <div style={{ color: C.green, fontSize: 24, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>$847K</div>
                  <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New',monospace" }}>Modelo de crecimiento Año 1</div>
                </div>
                <div style={{ background: C.panel, borderRadius: 6, padding: "18px 20px", textAlign: "center" }}>
                  <div style={{ color: C.green, fontSize: 24, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>6 meses</div>
                  <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New',monospace" }}>Para alcanzar ritmo completo</div>
                </div>
              </div>
            </div>

            <div style={{ color: "#3D4F6A", fontSize: 10, textAlign: "center", lineHeight: 1.8, fontFamily: "'Courier New',monospace" }}>
              Las proyecciones de ingresos son estimaciones basadas en actividad del mercado y no son garantías de ganancias.<br />
              Los resultados individuales dependen del equipo de agentes, volumen del mercado y ejecución operativa del CP.
            </div>
          </div>
        </div>
      </Section>

      {/* ── MARKETING MAXIMUS INCLUIDO ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, background: C.panel }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{ background: C.black, border: `1px solid ${C.gold}`, borderRadius: 6, padding: "10px 18px", color: C.gold, fontSize: 14, fontWeight: 700, fontFamily: "'Courier New',monospace", flexShrink: 0 }}>maximus.software</div>
              <div>
                <div style={{ color: "#F4F0E8", fontSize: 18, fontWeight: 700, fontFamily: "'Courier New',monospace" }}>Equipo de marketing dedicado de 100 personas <span style={{ background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}44`, borderRadius: 3, fontSize: 9, fontWeight: 700, padding: "2px 8px", letterSpacing: 0.5, marginLeft: 8 }}>INCLUIDO</span></div>
                <div style={{ color: C.muted, fontSize: 13 }}>Cada Presidente de Capítulo recibe una operación de marketing completa promoviendo su mercado — sin costo adicional.</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
              {[
                { title: "Promoción de mercado", desc: "Campañas dedicadas generando conocimiento y oportunidades en tu geografía específica." },
                { title: "Marketing digital", desc: "Redes sociales, búsqueda y marketing de contenido manejado por un equipo profesional." },
                { title: "Soporte de marca", desc: "Activos de marca UPA, campañas y mensajería — listos para desplegar." },
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

      {/* ── PARA QUIÉN ES ESTO ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, background: C.panel }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
              <div>
                <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 14 }}>PARA QUIÉN ES ESTO</div>
                <div style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, fontFamily: "'Courier New',monospace", marginBottom: 20, lineHeight: 1.1 }}>Estamos Seleccionando<br /><span style={{ color: "#C9A84C" }}>Operadores.</span><br />No Usuarios.</div>
                <div style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 1.75, marginBottom: 28 }}>
                  Esta plataforma no es para participantes casuales. Estamos construyendo operaciones de capítulo con líderes serios que tienen la intención de hacer crecer un equipo y capturar un mercado. Las solicitudes son revisadas antes de otorgar acceso.
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {[
                  { role: "Ajustadores Públicos", desc: "Operadores licenciados que quieren un flujo activo en lugar de esperar referencias", icon: "📋", fit: true },
                  { role: "Dueños de Agencias", desc: "Organizaciones con múltiples agentes que quieren control de red de nivel empresarial", icon: "🏢", fit: true },
                  { role: "Constructores de Equipos", desc: "Líderes que quieren reclutar agentes bajo su mando y ganar sobre su producción", icon: "👥", fit: true },
                  { role: "Participantes Pasivos", desc: "No somos la opción correcta para quienes no están listos para construir y operar", icon: "✗", fit: false },
                ].map(item => (
                  <div key={item.role} style={{ background: item.fit ? C.black : `${C.redDim}44`, border: `1px solid ${item.fit ? C.border : C.redDim}`, padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <div style={{ color: item.fit ? "#FFFFFF" : C.muted, fontWeight: 700, fontSize: 14, fontFamily: "'Courier New',monospace", marginBottom: 4 }}>{item.role}</div>
                      <div style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 1.6 }}>{item.desc}</div>
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
          <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16, textAlign: "center" }}>LA VENTAJA DE LA IA</div>
          <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 16, lineHeight: 1.1 }}>
            Más Conversaciones.<br /><span style={{ color: "#C9A84C" }}>Más Cierres. Más Reclamaciones.</span>
          </div>
          <div style={{ color: "#FFFFFF", fontSize: 15, textAlign: "center", maxWidth: 560, margin: "0 auto 56px", lineHeight: 1.7 }}>
            La plataforma no reemplaza al ajustador. Le da apalancamiento. Un agente con este sistema puede iniciar contacto con cientos de oportunidades por día. Un agente tradicional tiene un límite de 50–60 llamadas manuales.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2 }}>
            {[
              { name: "Contacto de Voz IA", icon: "📞", color: "#2A70D0", desc: "Realiza cientos de llamadas de primer contacto automáticamente. Registra cada resultado. Enruta los interesados directamente a un agente en vivo." },
              { name: "Agente de Ventas IA", icon: "🧠", color: "#C9A84C", desc: "Manejo de objeciones en tiempo real, guiones personalizados por tipo de peligro y señales de cierre para cada conversación." },
              { name: "Calificación de Oportunidades IA", icon: "🤖", color: "#22C55E", desc: "Conversaciones de calificación estructuradas las 24 horas. Datos completos recopilados antes de que cualquier agente intervenga." },
              { name: "Secretaria IA", icon: "📅", color: "#E03030", desc: "Gestiona tu cola de seguimiento, redacta mensajes, resume tu pipeline cada mañana. Nada se escapa." },
            ].map(t => (
              <div key={t.name} style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "28px 24px" }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{t.icon}</div>
                <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 14, fontFamily: "'Courier New',monospace", letterSpacing: 1, marginBottom: 10 }}>{t.name}</div>
                <div style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 1.7 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── MAXIMUS ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, background: C.panel }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16, textAlign: "center" }}>LA CAPA DE CRECIMIENTO</div>
            <div style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 20, lineHeight: 1.1 }}>
              Impulsado por <span style={{ color: "#C9A84C" }}>Maximus.software</span>
            </div>
            <div style={{ color: "#FFFFFF", fontSize: 15, textAlign: "center", maxWidth: 620, margin: "0 auto 48px", lineHeight: 1.7 }}>
              El portal impulsa las operaciones. Maximus impulsa la visibilidad y el crecimiento. Juntos crean un sistema de expansión escalable — desde la generación de oportunidades hasta el dominio del mercado.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <div style={{ background: C.black, border: `1px solid ${C.border}`, padding: "32px 28px" }}>
                <div style={{ color: "#2A70D0", fontWeight: 900, fontSize: 11, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 20 }}>⚡ PLATAFORMA DE OPERACIONES</div>
                {["Generación de oportunidades en vivo desde incidentes reales", "Automatización de contacto y calificación con IA", "Gestión de territorios y rotación", "Seguimiento del pipeline de reclamaciones", "Operaciones y supervisión del equipo"].map(i => (
                  <div key={i} style={{ color: "#F4F0E8", fontSize: 13, padding: "9px 0", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10 }}><span style={{ color: "#2A70D0" }}>·</span>{i}</div>
                ))}
              </div>
              <div style={{ background: C.black, border: `1px solid ${C.gold}44`, padding: "32px 28px" }}>
                <div style={{ color: "#C9A84C", fontWeight: 900, fontSize: 11, letterSpacing: 2, fontFamily: "'Courier New',monospace", marginBottom: 20 }}>🚀 MAXIMUS — MOTOR DE CRECIMIENTO</div>
                {["Páginas de aterrizaje para territorio y reclutamiento", "Mensajería de reclutamiento y marca digital", "Promoción local del territorio", "Operaciones de marketing impulsadas por IA", "Soporte de oportunidades entrantes y conversión"].map(i => (
                  <div key={i} style={{ color: "#F4F0E8", fontSize: 13, padding: "9px 0", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10 }}><span style={{ color: "#C9A84C" }}>·</span>{i}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── EMAIL SEQUENCE PREVIEW ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16, textAlign: "center" }}>QUÉ PASA DESPUÉS DE QUE LOS TERRITORIOS SE LLENAN</div>
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
                    <div style={{ color: "#FFFFFF", fontSize: 12 }}>{email.preview}</div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}`, padding: "20px 24px", textAlign: "center" }}>
              <div style={{ color: "#E03030", fontWeight: 900, fontSize: 13, fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>TU TERRITORIO FUE ASEGURADO POR OTRO OPERADOR.</div>
              <div style={{ color: "#FFFFFF", fontSize: 12, marginTop: 6 }}>Ellos reciben las oportunidades. Ellos construyen el equipo. Tú compites contra ellos.</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── OBJECTIONS ── */}
      <Section>
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}`, background: C.panel }}>
          <div style={{ maxWidth: 740, margin: "0 auto" }}>
            <div style={{ color: "#C9A84C", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16, textAlign: "center" }}>RESPUESTAS A TUS DUDAS</div>
            <div style={{ fontSize: "clamp(24px, 3vw, 38px)", fontWeight: 900, fontFamily: "'Courier New',monospace", textAlign: "center", marginBottom: 40, lineHeight: 1.2 }}>Cada Razón para Esperar<br /><span style={{ color: "#C9A84C" }}>Es una Razón por la que Otro No Esperará.</span></div>
            {[
              { q: "¿Es esto solo otra herramienta de oportunidades?", a: "No. Es una posición de Presidente de Capítulo con flujo de oportunidades integrado. Las herramientas están en todos lados. Las posiciones no. Los que entran primero construyen equipos y capturan mercados antes de que otros entren." },
              { q: "¿Qué pasa si me lo pierdo?", a: "Entonces alguien más construye el equipo primero. Ellos establecen el dominio primero. Cuanto antes entres, más grande tu red y mayores tus ingresos por comisión." },
              { q: "¿Puedo hacerlo después?", a: "Las posiciones de Presidente de Capítulo Fundador están limitadas a la ventana de lanzamiento. Una vez cerrada, la entrada requiere la cuota Estándar de $100,000. La economía favorece a quienes actúan primero." },
              { q: "¿Cuánto cuesta?", a: "Los Presidentes de Capítulo Fundadores entran por $0 durante la ventana de lanzamiento con una tarifa operativa de $2,000/mes. La entrada Estándar es de $100,000 más la misma tarifa mensual. Ambos niveles ganan 20% de comisión sobre tarifas SaaS de miembros reclutados personalmente. Las proyecciones conservadoras del Año 1 muestran $339K de ingresos contra $24K en tarifas — un retorno de 6x+." },
              { q: "¿Cómo sé que las oportunidades son reales?", a: "El sistema detecta incidentes de feeds de emergencia en vivo incluyendo PulsePoint — la misma fuente que usan los departamentos de bomberos. Estos son eventos reales despachados en direcciones reales, puntuados por IA, en tiempo casi real." },
            ].map(obj => <Objection key={obj.q} q={obj.q} a={obj.a} />)}
          </div>
        </div>
      </Section>

      {/* ── APPLICATION ── */}
      <Section id="apply">
        <div style={{ padding: "80px 40px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "start" }}>
            <div>
              <div className="pulse" style={{ color: "#E03030", fontSize: 10, letterSpacing: 4, fontFamily: "'Courier New',monospace", marginBottom: 16 }}>● TERRITORIOS SIENDO ASIGNADOS AHORA</div>
              <div style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, fontFamily: "'Courier New',monospace", lineHeight: 1.1, marginBottom: 20 }}>
                Apply to<br /><span style={{ color: "#C9A84C" }}>Secure Your<br />Territory.</span>
              </div>
              <div style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 1.8, marginBottom: 32 }}>
                Este no es un formulario de registro. Es una solicitud. Los territorios se asignan selectivamente a operadores que están listos para construir. Un miembro senior del equipo revisa cada solicitud antes de otorgar acceso.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {["No estamos incorporando a todos", "Los territorios se asignan selectivamente", "Esto es para operadores listos para construir — no solo intentar", "Una vez llenos, los territorios se cierran"].map(line => (
                  <div key={line} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ color: "#E03030", fontFamily: "'Courier New',monospace", flexShrink: 0 }}>✗</span>
                    <span style={{ color: "#FFFFFF", fontSize: 13 }}>{line}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: C.panel, border: `1px solid ${C.gold}55`, padding: "36px 32px", borderRadius: 2 }}>
              <div style={{ color: "#C9A84C", fontWeight: 900, fontSize: 13, fontFamily: "'Courier New',monospace", letterSpacing: 2, marginBottom: 24 }}>SOLICITUD DE TERRITORIO</div>
              <ApplicationForm />
            </div>
          </div>
        </div>
      </Section>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ color: "#C9A84C", fontWeight: 900, fontSize: 13, fontFamily: "'Courier New',monospace", letterSpacing: 2.5 }}>UNIFIED PUBLIC ADVOCACY</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 9, fontFamily: "'Courier New',monospace", letterSpacing: 1.5 }}>Impulsado por ACI Adjustment Group</div>
        </div>
        <div style={{ color: "#FFFFFF", fontSize: 10, fontFamily: "'Courier New',monospace" }}>Unified Public Advocacy · Impulsado por ACI Adjustment Group · Construido sobre una Plataforma de Inteligencia de Reclamaciones propia</div>
        <div style={{ color: "#FFFFFF", fontSize: 10, fontFamily: "'Courier New',monospace" }}>Asegura Territorio. Captura Oportunidades. Construye tu Imperio.</div>
      </div>
    </div>
  );
}
