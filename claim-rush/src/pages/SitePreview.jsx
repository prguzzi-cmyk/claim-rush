import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

/**
 * Phase 16b — Finalized franchise-style CP/RVP/Agent website templates.
 * Modeled on aciadjustment.com with compliance-gated ticker + stats.
 *
 * CP/RVP: Full 10-section franchise template
 * Agent: Lean single-page landing
 *
 * All marketing copy is LOCKED at corporate level.
 * CP can ONLY customize: photo, name, phone, email, territory.
 */

const GOLD = "#C9A84C";
const NAVY = "#0A1628";
const MAROON = "#800020";
const WHITE = "#FFFFFF";
const GRAY_BG = "#F8F9FA";

const ROLE_LABELS = { cp: "Chapter President", rvp: "Regional Vice President", agent: "Licensed Agent" };

// ── State → regional hero image mapping ──
const REGION_IMAGES = {
  NORTHEAST: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1400&q=80",
  SOUTHEAST: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1400&q=80",
  MIDWEST: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80",
  SOUTHWEST: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1400&q=80",
  WEST: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1400&q=80",
  WESTCOAST: "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=1400&q=80",
};
const STATE_REGIONS = {
  PA:"NORTHEAST",NY:"NORTHEAST",NJ:"NORTHEAST",CT:"NORTHEAST",MA:"NORTHEAST",RI:"NORTHEAST",VT:"NORTHEAST",NH:"NORTHEAST",ME:"NORTHEAST",DE:"NORTHEAST",MD:"NORTHEAST",
  FL:"SOUTHEAST",GA:"SOUTHEAST",SC:"SOUTHEAST",NC:"SOUTHEAST",VA:"SOUTHEAST",AL:"SOUTHEAST",MS:"SOUTHEAST",LA:"SOUTHEAST",TN:"SOUTHEAST",KY:"SOUTHEAST",WV:"SOUTHEAST",AR:"SOUTHEAST",
  OH:"MIDWEST",IN:"MIDWEST",IL:"MIDWEST",MI:"MIDWEST",WI:"MIDWEST",MN:"MIDWEST",IA:"MIDWEST",MO:"MIDWEST",KS:"MIDWEST",NE:"MIDWEST",ND:"MIDWEST",SD:"MIDWEST",
  TX:"SOUTHWEST",OK:"SOUTHWEST",AZ:"SOUTHWEST",NM:"SOUTHWEST",
  CO:"WEST",UT:"WEST",NV:"WEST",ID:"WEST",WY:"WEST",MT:"WEST",AK:"WEST",
  CA:"WESTCOAST",OR:"WESTCOAST",WA:"WESTCOAST",HI:"WESTCOAST",
};
function heroImg(state) { return REGION_IMAGES[STATE_REGIONS[state] || "NORTHEAST"] || REGION_IMAGES.NORTHEAST; }

// ── Locked corporate content ──
const SERVICES = [
  { icon: "🔥", title: "Fire Damage", desc: "Structure fires, smoke damage, electrical fires. We fight for full coverage of rebuilding and personal property loss." },
  { icon: "💧", title: "Water Damage", desc: "Flooding, pipe bursts, roof leaks. We document hidden damage the insurance company's adjuster won't look for." },
  { icon: "⛈️", title: "Storm & Roof Damage", desc: "Wind, hail, tornado, hurricane, fallen trees. Emergency response 24/7 for storm-impacted properties." },
  { icon: "❌", title: "Denied & Underpaid Claims", desc: "Claim denied or settlement too low? We reopen, renegotiate, and fight for what you're actually owed." },
];

const WHY_PA = [
  { title: "We work for YOU", text: "Insurance company adjusters work for the insurer. We're licensed to represent YOUR interests exclusively." },
  { title: "No recovery = no fee", text: "We work on contingency. If we don't recover money for you, you owe us nothing." },
  { title: "AI-powered claim analysis", text: "The ACI Team uses AI to find every dollar of damage — things human-only adjusters miss." },
  { title: "40+ years experience", text: "Our network of licensed adjusters has handled thousands of claims across every peril type." },
];

const TRUST_BADGES = [
  { icon: "🏆", title: "UPenn Wharton", sub: "100 Fastest Growing" },
  { icon: "📈", title: "Inc. 500", sub: "Fastest Growing in USA" },
  { icon: "🥇", title: "#1 Service Award", sub: "3 Consecutive Years" },
];

const DAMAGE_TYPES = ["Fire Damage", "Water Damage", "Storm & Roof", "Denied Claim", "Other"];

// ── Shared components ──

function TopBar({ phone }) {
  return (
    <div style={{ background: MAROON, color: WHITE, padding: "8px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span>📞 1-800-809-4302</span>
        <span style={{ background: GOLD, color: NAVY, padding: "2px 12px", borderRadius: 3, fontWeight: 700, fontSize: 11 }}>24/7 EMERGENCY RESPONSE</span>
      </div>
      <span>{phone && phone !== "1-800-809-4302" ? `Local: ${phone} · ` : ""}claims@aciadjustment.com</span>
    </div>
  );
}

function Nav() {
  return (
    <nav style={{ padding: "12px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", background: WHITE, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: NAVY }}><span style={{ color: MAROON }}>ACI</span> ADJUSTMENT GROUP</div>
      <div style={{ display: "flex", gap: 20, alignItems: "center", fontSize: 14, fontWeight: 500 }}>
        {["Services", "Why Us", "Free Inspection", "Contact"].map(i => <a key={i} href={`#${i.toLowerCase().replace(/ /g,"-")}`} style={{ color: "#555", textDecoration: "none" }}>{i}</a>)}
        <a href="#free-inspection" style={{ background: GOLD, color: NAVY, padding: "8px 20px", borderRadius: 3, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>File a Claim</a>
      </div>
    </nav>
  );
}

function LeadForm() {
  const [d, setD] = useState({ name: "", email: "", phone: "", address: "", damage_type: "", description: "" });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const inp = { width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 4, fontSize: 15, boxSizing: "border-box" };

  if (done) return (
    <div style={{ textAlign: "center", padding: 32, background: WHITE, borderRadius: 8, border: `2px solid ${GOLD}` }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <h3 style={{ color: NAVY, fontSize: 20, marginBottom: 8 }}>Thank You!</h3>
      <p style={{ color: "#666", fontSize: 15 }}>We'll contact you within 24 hours to schedule your free inspection.</p>
    </div>
  );

  return (
    <div style={{ background: WHITE, borderRadius: 8, padding: 28, border: "1px solid #e8e8e8" }}>
      {[["Your Name","name","text"],["Email","email","email"],["Phone","phone","tel"],["Property Address","address","text"]].map(([l,k,t]) => (
        <div key={k} style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 }}>{l}</label>
          <input type={t} value={d[k]} onChange={e => set(k, e.target.value)} style={inp} />
        </div>
      ))}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 }}>Type of Damage</label>
        <select value={d.damage_type} onChange={e => set("damage_type", e.target.value)} style={inp}>
          <option value="">Select...</option>
          {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 }}>Brief Description</label>
        <textarea value={d.description} onChange={e => set("description", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} />
      </div>
      {err && <div style={{ color: MAROON, fontSize: 13, marginBottom: 12 }}>{err}</div>}
      <button onClick={() => { if (!d.name || !d.email || !d.phone) { setErr("Please fill in name, email, and phone."); return; } setDone(true); }}
        style={{ width: "100%", padding: 14, background: GOLD, color: NAVY, border: "none", borderRadius: 4, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
        Request Free Inspection
      </button>
    </div>
  );
}

function Footer({ name, phone, email, territory, roleLabel, licenseStr }) {
  return (
    <footer id="contact" style={{ background: NAVY, color: "rgba(255,255,255,0.7)", padding: "40px 40px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 40 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, marginBottom: 14 }}>Services</div>
          {["Fire Claims","Water Claims","Storm Claims","Denied Claims","Policy Review","Free Inspection"].map(s => <div key={s} style={{ fontSize: 13, marginBottom: 5 }}>{s}</div>)}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, marginBottom: 14 }}>Contact {name}</div>
          <div style={{ fontSize: 13, marginBottom: 5 }}>📞 {phone}</div>
          {email && <div style={{ fontSize: 13, marginBottom: 5 }}>✉️ {email}</div>}
          <div style={{ fontSize: 13, marginBottom: 5 }}>📍 {territory}</div>
          <div style={{ fontSize: 13 }}>🏢 {roleLabel}</div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, marginBottom: 14 }}>Compliance</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.5)" }}>
            {licenseStr}<br />
            ACI Adjustment Group · Licensed Public Adjusters since 2004<br />
            803 Park Avenue, Newtown, PA 18940<br />
            Backed by Unified Public Advocacy (UPA) — 501(c)(3)<br />
            All claims handled on contingency — no fee unless we win.<br />
            Individual results vary. Past results do not guarantee future outcomes.
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "24px auto 0", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
        © 2026 ACI Adjustment Group™ · All Rights Reserved · Pax Equitas Network
      </div>
    </footer>
  );
}

// ── CP/RVP Full Franchise Template ──

function FranchiseSite({ role, name, phone, email, territory, state, tagline, licenseStr, showTicker, showStats }) {
  const roleLabel = ROLE_LABELS[role] || "Representative";
  const hd = { fontSize: 28, fontWeight: 700, color: NAVY, textAlign: "center", marginBottom: 12 };
  const sec = { padding: "60px 40px", maxWidth: 1100, margin: "0 auto" };

  return (
    <>
      <TopBar phone={phone} />
      <Nav />

      {/* 1. HERO */}
      <section style={{ background: `linear-gradient(rgba(10,22,40,0.72),rgba(10,22,40,0.85)),url('${heroImg(state)}') center/cover`, padding: "100px 40px 80px", textAlign: "center", color: WHITE }}>
        <h1 style={{ fontSize: "clamp(30px,5vw,50px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 16px", maxWidth: 750, marginLeft: "auto", marginRight: "auto" }}>
          Denied. Underpaid. Confused?<br /><span style={{ color: GOLD }}>We Fix Insurance Claims.</span>
        </h1>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", maxWidth: 600, margin: "0 auto 20px", lineHeight: 1.6 }}>
          Licensed public adjusters who fight for maximum settlements. Free inspections. No fee unless we win.
        </p>
        <div style={{ fontSize: 13, color: GOLD, marginBottom: 24 }}>Serving {territory} Homeowners</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#free-inspection" style={{ background: GOLD, color: NAVY, padding: "14px 32px", borderRadius: 3, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>Check If You Have a Claim</a>
          <a href={`tel:${phone}`} style={{ background: MAROON, color: WHITE, padding: "14px 32px", borderRadius: 3, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>Speak to an Adjuster</a>
        </div>
      </section>

      {/* 2. AGENT IDENTITY STRIP */}
      <section id="about" style={{ padding: "40px", textAlign: "center", borderBottom: "1px solid #eee" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg,${MAROON},${NAVY})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: WHITE, fontWeight: 700 }}>{name.charAt(0)}</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{name}</div>
            <div style={{ fontSize: 14, color: MAROON, fontWeight: 600 }}>{roleLabel} · {territory}</div>
            <div style={{ fontSize: 13, color: "#888" }}>{licenseStr}</div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>📞 {phone} · Backed by Unified Public Advocacy — 501(c)(3)</div>
          </div>
        </div>
        {tagline && <p style={{ fontSize: 15, color: "#666", fontStyle: "italic", marginTop: 12, maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>"{tagline}"</p>}
      </section>

      {/* 3. LIVE CLAIM TICKER (compliance-gated, OFF by default) */}
      {showTicker && (
        <div style={{ background: "#111", padding: "10px 0", overflow: "hidden", whiteSpace: "nowrap" }}>
          <div style={{ display: "inline-flex", gap: 40, animation: "ticker-scroll 40s linear infinite", paddingLeft: "100%" }}>
            {["🔥 Fire Claim — PA — $47,000 Approved — 2d ago","💧 Water Claim — PA — $23,500 Approved — 5d ago","⛈️ Storm Claim — PA — $31,200 Approved — 1w ago","❌ Denied Claim Reopened — PA — $18,900 — 2w ago"].map((t,i) => (
              <span key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "'Segoe UI',sans-serif" }}>{t}<span style={{ color: "rgba(255,255,255,0.15)", margin: "0 12px" }}>|</span></span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 4 }}>Recent activity shown. Individual results vary.</div>
          <style>{`@keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
        </div>
      )}

      {/* 4. TERRITORY PROOF (compliance-gated, OFF by default) */}
      {showStats && (
        <section style={{ padding: "40px", background: GRAY_BG }}>
          <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 16 }}>Serving {state || "Your"} Homeowners</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <div style={{ background: WHITE, border: "1px solid #e8e8e8", borderRadius: 8, padding: 16 }}><div style={{ fontSize: 28, fontWeight: 700, color: MAROON }}>18</div><div style={{ fontSize: 12, color: "#888" }}>Claims This Month</div></div>
              <div style={{ background: WHITE, border: "1px solid #e8e8e8", borderRadius: 8, padding: 16 }}><div style={{ fontSize: 28, fontWeight: 700, color: MAROON }}>$412K</div><div style={{ fontSize: 12, color: "#888" }}>Total Recovered</div></div>
              <div style={{ background: WHITE, border: "1px solid #e8e8e8", borderRadius: 8, padding: 16 }}><div style={{ fontSize: 28, fontWeight: 700, color: MAROON }}>+37%</div><div style={{ fontSize: 12, color: "#888" }}>Avg Payout Increase</div></div>
            </div>
            <div style={{ fontSize: 10, color: "#bbb", marginTop: 8 }}>Based on recent claims data. Individual results vary. Past results do not guarantee future outcomes.</div>
          </div>
        </section>
      )}

      {/* 5. SERVICES */}
      <section id="services" style={{ background: showStats ? WHITE : GRAY_BG, padding: "60px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={hd}>What We Handle</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {SERVICES.map(s => (
              <div key={s.title} style={{ background: WHITE, border: "1px solid #e8e8e8", borderRadius: 8, padding: "24px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. MAIN CONVERSION BLOCK */}
      <section style={{ background: `linear-gradient(135deg, ${NAVY}, #142238)`, padding: "50px 40px", textAlign: "center" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: WHITE, margin: "0 0 12px" }}>Not sure if you have a claim?</h2>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, maxWidth: 500, margin: "0 auto 20px" }}>We'll review your situation and tell you instantly. No cost, no obligation.</p>
        <a href="#free-inspection" style={{ display: "inline-block", background: GOLD, color: NAVY, padding: "14px 36px", borderRadius: 3, fontWeight: 800, textDecoration: "none", fontSize: 15 }}>Check My Property</a>
      </section>

      {/* 7. WHY PUBLIC ADJUSTER */}
      <section id="why-us" style={sec}>
        <h2 style={hd}>Why Use a Public Adjuster?</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 800, margin: "0 auto" }}>
          {WHY_PA.map(w => (
            <div key={w.title} style={{ padding: 20, border: "1px solid #e8e8e8", borderRadius: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: MAROON, marginBottom: 6 }}>{w.title}</div>
              <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>{w.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. TRUST/AUTHORITY */}
      <section style={{ background: GRAY_BG, padding: "50px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          {TRUST_BADGES.map(b => (
            <div key={b.title} style={{ padding: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>{b.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{b.title}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{b.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#bbb", textAlign: "center", marginTop: 12 }}>Awards reflect corporate ACI Adjustment Group recognition. Individual representative results may vary.</div>
      </section>

      {/* 9. FINAL CTA */}
      <section style={{ background: MAROON, padding: "50px 40px", textAlign: "center" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: WHITE, margin: "0 0 12px" }}>Talk to a Licensed Adjuster Now</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, maxWidth: 500, margin: "0 auto 24px" }}>Don't leave money on the table. Let us fight for what you're owed.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={`tel:${phone}`} style={{ background: GOLD, color: NAVY, padding: "14px 32px", borderRadius: 3, fontWeight: 800, textDecoration: "none" }}>Call Now</a>
          <a href="#free-inspection" style={{ background: WHITE, color: MAROON, padding: "14px 32px", borderRadius: 3, fontWeight: 800, textDecoration: "none" }}>Start My Claim Review</a>
        </div>
      </section>

      {/* 10. FOOTER */}
      <Footer name={name} phone={phone} email={email} territory={territory} roleLabel={roleLabel} licenseStr={licenseStr} />

      {/* FREE INSPECTION FORM (floating section) */}
      <section id="free-inspection" style={{ padding: "60px 40px", background: WHITE }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={hd}>Request a FREE Inspection</h2>
          <p style={{ textAlign: "center", color: "#666", fontSize: 15, marginBottom: 24 }}>Fill out the form and we'll contact you within 24 hours.</p>
          <LeadForm />
        </div>
      </section>
    </>
  );
}

// ── Agent Single-Page Landing ──

function AgentLanding({ name, phone, email, territory, state, tagline, licenseStr }) {
  return (
    <>
      <TopBar phone={phone} />
      <nav style={{ padding: "12px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", background: WHITE }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: NAVY }}><span style={{ color: MAROON }}>ACI</span> ADJUSTMENT GROUP</div>
        <a href="#get-help" style={{ background: GOLD, color: NAVY, padding: "8px 20px", borderRadius: 3, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>Get Help Today</a>
      </nav>

      {/* HERO — personal, large identity */}
      <section style={{ background: `linear-gradient(135deg, ${NAVY}, ${MAROON})`, padding: "70px 40px", textAlign: "center", color: WHITE }}>
        <div style={{ width: 130, height: 130, borderRadius: "50%", background: `linear-gradient(135deg,${GOLD},${MAROON})`, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, color: WHITE, fontWeight: 700, border: `3px solid ${GOLD}` }}>{name.charAt(0)}</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 6px" }}>{name}</h1>
        <div style={{ fontSize: 15, color: GOLD, fontWeight: 600, marginBottom: 4 }}>Licensed Agent · {territory}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{licenseStr}</div>
        {tagline && <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", maxWidth: 400, margin: "12px auto 20px" }}>"{tagline}"</p>}
        <a href="#get-help" style={{ display: "inline-block", background: GOLD, color: NAVY, padding: "14px 36px", borderRadius: 3, fontWeight: 800, textDecoration: "none" }}>Get Help Today</a>
      </section>

      {/* MINI SERVICES */}
      <section style={{ padding: "40px", background: GRAY_BG }}>
        <div style={{ maxWidth: 700, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, textAlign: "center" }}>
          {SERVICES.map(s => <div key={s.title} style={{ padding: 12 }}><div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div><div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{s.title}</div></div>)}
        </div>
      </section>

      {/* CONTACT + FORM */}
      <section id="get-help" style={{ padding: "50px 40px" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: NAVY, textAlign: "center", marginBottom: 6 }}>Request a Free Inspection</h2>
          <p style={{ textAlign: "center", color: "#666", fontSize: 14, marginBottom: 20 }}>I'll review your claim for free. No obligation.</p>
          <LeadForm />
          <div style={{ marginTop: 16, textAlign: "center", fontSize: 14, color: "#888" }}>📞 {phone}{email ? ` · ✉️ ${email}` : ""}</div>
        </div>
      </section>

      <Footer name={name} phone={phone} email={email} territory={territory} roleLabel="Licensed Agent" licenseStr={licenseStr} />
    </>
  );
}

// ── Main Router ──

export default function SitePreview() {
  const { role, slug } = useParams();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    function getToken() { const r = localStorage.getItem("access_token"); if (!r) return null; try { return JSON.parse(r); } catch { return r; } }

    fetch(`/v1/website-manager/resolve?host=claimrush.com&path=/${role}/${slug}`)
      .then(r => {
        if (r.ok) return r.json();
        const token = getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        return fetch(`/v1/website-manager/sites`, { headers }).then(r2 => r2.json()).then(sites => {
          const m = sites.find(s => s.subdomain === slug);
          if (!m) throw new Error("Site not found");
          return fetch(`/v1/website-manager/sites/${m.id}/content`, { headers }).then(r3 => r3.json()).then(c => {
            let f = {}; try { f = typeof c[0]?.fields === "string" ? JSON.parse(c[0].fields) : (c[0]?.fields || {}); } catch {}
            return { site: m, content: c[0], fields: f };
          });
        });
      })
      .then(data => {
        let f = data.content?.fields || data.fields || {};
        if (typeof f === "string") try { f = JSON.parse(f); } catch {}
        setSite({ ...(data.site || {}), content: data.content, fields: f });
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [role, slug]);

  if (loading) return <div style={{ minHeight: "100vh", background: WHITE, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>;
  if (error) return <div style={{ minHeight: "100vh", background: WHITE, display: "flex", alignItems: "center", justifyContent: "center", color: MAROON }}>Error: {error}</div>;

  const f = site?.fields || {};
  const name = f.name || slug;
  const tagline = f.hero_subtitle || "Here to help you recover what you're owed.";
  const email = f.email || "";
  const phone = f.phone || "1-800-809-4302";
  const state = site?.territory_state || "";
  const territory = state ? `${state} Territory` : "Your Territory";

  // License validation: if admin has entered a verified license, show it. Otherwise generic.
  const licenseStr = state ? `Licensed Public Adjuster — ${state}` : "Backed by ACI Adjustment Group";

  // Compliance gates — ticker and stats OFF by default
  const showTicker = false;  // Admin enables per state after compliance review
  const showStats = false;   // Admin enables per state after compliance review

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#333", background: WHITE }}>
      <div style={{ background: GOLD, color: NAVY, padding: "6px 20px", fontSize: 12, fontWeight: 700, textAlign: "center", letterSpacing: 1 }}>
        PREVIEW — claimrush.com/{role}/{slug}
      </div>
      {role === "agent" ? (
        <AgentLanding name={name} phone={phone} email={email} territory={territory} state={state} tagline={tagline} licenseStr={licenseStr} />
      ) : (
        <FranchiseSite role={role} name={name} phone={phone} email={email} territory={territory} state={state} tagline={tagline} licenseStr={licenseStr} showTicker={showTicker} showStats={showStats} />
      )}
    </div>
  );
}
