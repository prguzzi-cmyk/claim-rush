import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

/**
 * Phase 15 — Franchise-style CP/RVP/Agent website template.
 * Modeled on aciadjustment.com. 10 sections, 90% corporate content.
 * Route: /preview/:role/:slug
 */

const GOLD = "#C9A84C";
const NAVY = "#0A1628";
const MAROON = "#800020";
const WHITE = "#FFFFFF";
const GRAY_BG = "#F8F9FA";

const ROLE_LABELS = {
  cp: "Chapter President",
  rvp: "Regional Vice President",
  agent: "Licensed Agent",
};

const SERVICES = [
  { icon: "🔥", title: "Fire Damage", desc: "Structure fires, smoke damage, electrical fires. We fight for full coverage of rebuilding and personal property loss." },
  { icon: "💧", title: "Water Damage", desc: "Flooding, pipe bursts, roof leaks. We document hidden damage the insurance company's adjuster won't look for." },
  { icon: "🧊", title: "Hail Damage", desc: "Roof damage, siding, windows, gutters. Hail claims are routinely underpaid — we ensure every dent is counted." },
  { icon: "⛈️", title: "Storm Damage", desc: "Wind, tornado, hurricane, fallen trees. Emergency response available 24/7 for storm-impacted properties." },
  { icon: "🏢", title: "Commercial Claims", desc: "Business interruption, inventory loss, property damage. Enterprise-grade claims management for any size operation." },
];

const WHY_CHOOSE = [
  "Licensed & bonded public adjusters in multiple states",
  "40+ years of combined claims and insurance experience",
  "Powered by The ACI Team — AI-assisted claims intelligence",
  "Backed by UPA (Unified Public Advocacy) 501(c)(3) nonprofit",
  "No fee unless we recover money for you — contingency basis only",
  "24/7 emergency response — adjuster dispatched within 24 hours",
  "Free property inspections and claim consultations",
  "#1 Customer Service & Satisfaction — 3 consecutive years",
];

const DAMAGE_TYPES = ["Fire Damage", "Water Damage", "Hail Damage", "Storm Damage", "Commercial", "Other"];

function getToken() {
  const raw = localStorage.getItem("access_token");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export default function SitePreview() {
  const { role, slug } = useParams();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Lead form state
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", address: "", damage_type: "", description: "" });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch(`/v1/website-manager/resolve?host=claimrush.com&path=/${role}/${slug}`)
      .then(r => {
        if (r.ok) return r.json();
        // Fallback with auth
        const token = getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        return fetch(`/v1/website-manager/sites`, { headers })
          .then(r2 => r2.json())
          .then(sites => {
            const matched = sites.find(s => s.subdomain === slug);
            if (!matched) throw new Error("Site not found");
            return fetch(`/v1/website-manager/sites/${matched.id}/content`, { headers })
              .then(r3 => r3.json())
              .then(contents => {
                const content = contents[0];
                let fields = {};
                try { fields = typeof content?.fields === "string" ? JSON.parse(content.fields) : (content?.fields || {}); } catch {}
                return { site: matched, content, fields };
              });
          });
      })
      .then(data => {
        let fields = data.content?.fields || data.fields || {};
        if (typeof fields === "string") try { fields = JSON.parse(fields); } catch {}
        setSite({ ...(data.site || {}), content: data.content, fields });
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [role, slug]);

  if (loading) return <div style={{ minHeight: "100vh", background: WHITE, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontFamily: "'Segoe UI', sans-serif" }}>Loading...</div>;
  if (error) return <div style={{ minHeight: "100vh", background: WHITE, display: "flex", alignItems: "center", justifyContent: "center", color: MAROON, fontFamily: "'Segoe UI', sans-serif" }}>Error: {error}</div>;

  const f = site?.fields || {};
  const cpName = f.name || f.hero_title || `${role?.toUpperCase()} — ${slug}`;
  const cpTagline = f.hero_subtitle || "Here to help you recover what you're owed.";
  const cpEmail = f.email || "";
  const cpPhone = f.phone || "1-800-809-4302";
  const territory = site?.territory_state || f.territory || "";
  const roleLabel = ROLE_LABELS[role] || "Representative";
  const territoryLabel = territory ? `${territory} Territory` : "Your Territory";

  const sectionStyle = { padding: "60px 40px", maxWidth: 1100, margin: "0 auto" };
  const headingStyle = { fontSize: 28, fontWeight: 700, color: NAVY, textAlign: "center", marginBottom: 12, fontFamily: "'Segoe UI', sans-serif" };

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#333", background: WHITE }}>

      {/* PREVIEW BANNER */}
      <div style={{ background: GOLD, color: NAVY, padding: "6px 20px", fontSize: 12, fontWeight: 700, textAlign: "center", letterSpacing: 1 }}>
        PREVIEW — This is how the site appears at claimrush.com/{role}/{slug}
      </div>

      {/* 1. TOP BAR */}
      <div style={{ background: MAROON, color: WHITE, padding: "8px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <span>📞 1-800-809-4302</span>
          <span style={{ background: GOLD, color: NAVY, padding: "2px 12px", borderRadius: 3, fontWeight: 700, fontSize: 11 }}>24/7 Emergency Response</span>
        </div>
        <div>{cpPhone !== "1-800-809-4302" && <span>Local: {cpPhone}</span>} <span style={{ marginLeft: 16 }}>claims@aciadjustment.com</span></div>
      </div>

      {/* 2. NAV */}
      <nav style={{ padding: "12px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", background: WHITE, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, letterSpacing: 1 }}>
          <span style={{ color: MAROON }}>ACI</span> ADJUSTMENT GROUP
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center", fontSize: 14, fontWeight: 500 }}>
          {["Home", "Services", "About", "Free Inspection", "Contact"].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} style={{ color: "#555", textDecoration: "none" }}>{item}</a>
          ))}
          <a href="#free-inspection" style={{ background: GOLD, color: NAVY, padding: "8px 20px", borderRadius: 3, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>File a Claim</a>
        </div>
      </nav>

      {/* 3. HERO */}
      <section style={{
        background: `linear-gradient(rgba(10,22,40,0.75), rgba(10,22,40,0.85)), url('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1400&q=80') center/cover`,
        padding: "100px 40px 80px", textAlign: "center", color: WHITE,
      }}>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 16px", maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
          Maximum Settlement.<br /><span style={{ color: GOLD }}>Minimum Stress.</span>
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.8)", maxWidth: 600, margin: "0 auto 24px", lineHeight: 1.6 }}>
          Licensed Public Adjusters fighting for maximum insurance claim settlements. Free inspections available 24/7.
        </p>
        <div style={{ display: "inline-block", padding: "6px 20px", border: `1px solid ${GOLD}80`, borderRadius: 20, marginBottom: 28 }}>
          <span style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>Your Local Representative for {territoryLabel}</span>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <a href="#free-inspection" style={{ background: GOLD, color: NAVY, padding: "14px 32px", borderRadius: 3, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>File a Claim</a>
          <a href={`tel:${cpPhone}`} style={{ background: MAROON, color: WHITE, padding: "14px 32px", borderRadius: 3, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>Call {cpPhone}</a>
        </div>
      </section>

      {/* 4. YOUR LOCAL REPRESENTATIVE */}
      <section id="about" style={{ ...sectionStyle, textAlign: "center", paddingTop: 50, paddingBottom: 50 }}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", background: `linear-gradient(135deg, ${MAROON}, ${NAVY})`, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, color: WHITE, fontWeight: 700 }}>
          {cpName.charAt(0)}
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: NAVY, margin: "0 0 6px" }}>{cpName}</h2>
        <div style={{ fontSize: 15, color: MAROON, fontWeight: 600, marginBottom: 8 }}>{roleLabel} · {territoryLabel}</div>
        <p style={{ fontSize: 16, color: "#666", maxWidth: 500, margin: "0 auto", lineHeight: 1.6, fontStyle: "italic" }}>"{cpTagline}"</p>
      </section>

      {/* 5. WHAT'S COVERED */}
      <section id="services" style={{ background: GRAY_BG, padding: "60px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={headingStyle}>What's Covered?</h2>
          <p style={{ textAlign: "center", color: "#666", fontSize: 15, marginBottom: 32 }}>ACI Adjustment Group handles all types of property damage claims. Our licensed adjusters work for you — not the insurance company.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            {SERVICES.map(s => (
              <div key={s.title} style={{ background: WHITE, border: "1px solid #e8e8e8", borderRadius: 8, padding: "24px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{s.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. WHY CHOOSE ACI */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Why Choose ACI Adjustment Group?</h2>
        <div style={{ maxWidth: 650, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {WHY_CHOOSE.map(item => (
            <div key={item} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 15, color: "#444" }}>
              <span style={{ color: MAROON, fontWeight: 700, fontSize: 18, flexShrink: 0 }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 7. FREE INSPECTION FORM */}
      <section id="free-inspection" style={{ background: GRAY_BG, padding: "60px 40px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={headingStyle}>Request a FREE Inspection</h2>
          <p style={{ textAlign: "center", color: "#666", fontSize: 15, marginBottom: 24 }}>Call for a FREE inspection at any time of day or night.</p>

          {formSubmitted ? (
            <div style={{ textAlign: "center", padding: 32, background: WHITE, borderRadius: 8, border: `2px solid ${GOLD}` }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <h3 style={{ color: NAVY, fontSize: 20, marginBottom: 8 }}>Thank You!</h3>
              <p style={{ color: "#666", fontSize: 15 }}>We'll contact you within 24 hours to schedule your free inspection.</p>
            </div>
          ) : (
            <div style={{ background: WHITE, borderRadius: 8, padding: 28, border: "1px solid #e8e8e8" }}>
              {[
                ["Your Name", "name", "text"],
                ["Email Address", "email", "email"],
                ["Phone Number", "phone", "tel"],
                ["Property Address", "address", "text"],
              ].map(([label, key, type]) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 }}>{label}</label>
                  <input type={type} value={formData[key]} onChange={e => setFormData(d => ({ ...d, [key]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 4, fontSize: 15, boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 }}>Type of Damage</label>
                <select value={formData.damage_type} onChange={e => setFormData(d => ({ ...d, damage_type: e.target.value }))}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 4, fontSize: 15, boxSizing: "border-box" }}>
                  <option value="">Select...</option>
                  {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 }}>Brief Description</label>
                <textarea value={formData.description} onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
                  rows={3} style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 4, fontSize: 15, boxSizing: "border-box", resize: "vertical" }} />
              </div>
              {formError && <div style={{ color: MAROON, fontSize: 13, marginBottom: 12 }}>{formError}</div>}
              <button onClick={() => {
                if (!formData.name || !formData.email || !formData.phone) { setFormError("Please fill in name, email, and phone."); return; }
                setFormSubmitted(true);
              }} style={{ width: "100%", padding: "14px", background: GOLD, color: NAVY, border: "none", borderRadius: 4, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                Request Free Inspection
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 8. AWARDS */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Awards & Recognition</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 800, margin: "0 auto" }}>
          {[
            { badge: "🏆", title: "UPenn Wharton", sub: "100 Fastest Growing Businesses" },
            { badge: "📈", title: "Inc. 500", sub: "500 Fastest Growing Businesses in USA" },
            { badge: "🥇", title: "#1 Customer Service", sub: "3 Consecutive Years — Gold Medal" },
          ].map(a => (
            <div key={a.title} style={{ textAlign: "center", padding: 24, border: "1px solid #e8e8e8", borderRadius: 8 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{a.badge}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{a.title}</div>
              <div style={{ fontSize: 13, color: "#888" }}>{a.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 9. CTA BLOCK */}
      <section style={{ background: MAROON, padding: "50px 40px", textAlign: "center" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: WHITE, margin: "0 0 12px" }}>Don't Leave Money on the Table</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, maxWidth: 600, margin: "0 auto 24px", lineHeight: 1.6 }}>
          Many home and business owners are unaware that they have thousands of dollars rightfully due to them. Let our licensed adjusters review your claim.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <a href="#free-inspection" style={{ background: GOLD, color: NAVY, padding: "14px 32px", borderRadius: 3, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>File a Claim Now</a>
          <a href={`tel:${cpPhone}`} style={{ background: WHITE, color: MAROON, padding: "14px 32px", borderRadius: 3, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>Call {cpPhone}</a>
        </div>
      </section>

      {/* 10. FOOTER */}
      <footer id="contact" style={{ background: NAVY, color: "rgba(255,255,255,0.7)", padding: "40px 40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 40 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, marginBottom: 16 }}>Services</div>
            {["Storm Claims", "Fire Claims", "Water Claims", "Commercial Claims", "Policy Review", "Free Inspection"].map(s => (
              <div key={s} style={{ fontSize: 13, marginBottom: 6 }}>{s}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, marginBottom: 16 }}>Contact {cpName}</div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>📞 {cpPhone}</div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>✉️ {cpEmail}</div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>📍 {territoryLabel}</div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>🏢 {roleLabel}</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, marginBottom: 16 }}>Compliance</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.5)" }}>
              ACI Adjustment Group · Licensed Public Adjusters since 2004<br />
              803 Park Avenue, Newtown, PA 18940<br />
              UPA (Unified Public Advocacy) 501(c)(3) nonprofit affiliate<br />
              All claims handled on contingency — no fee unless we win.
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1100, margin: "24px auto 0", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
          © 2026 ACI Adjustment Group™ · All Rights Reserved · Pax Equitas Network
        </div>
      </footer>
    </div>
  );
}
