import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

/**
 * Page 3: Chapter President local /community page (template).
 * Dynamic per CP — city, state, contact injected.
 * COMPLIANCE: UPA described as "developing programs"
 * Legal separation footer MANDATORY on every CP /community page.
 * ALL content locked at template level — NOT editable by CPs.
 */

const GOLD = "#C9A84C";
const NAVY = "#0A1628";
const MAROON = "#800020";
const WHITE = "#FFFFFF";
const GRAY = "#F8F9FA";

export default function CommunityLocal() {
  const { slug } = useParams();

  // Dynamic fields — in production, pulled from site_content via resolver
  const [cp, setCp] = useState({ name: "", city: "", state: "", phone: "", email: "", business_name: "" });

  useEffect(() => {
    // Try to load from resolver
    apiFetch(`/website-manager/resolve?host=claimrush.com&path=/cp/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.content?.fields) {
          const f = typeof data.content.fields === "string" ? JSON.parse(data.content.fields) : data.content.fields;
          setCp({
            name: f.name || slug,
            city: f.city || "",
            state: data.site?.territory_state || "",
            phone: f.phone || "1-800-809-4302",
            email: f.email || "",
            business_name: f.name ? `${f.name} — ACI Adjustment Group` : "ACI Adjustment Group",
          });
        }
      })
      .catch(() => {});
  }, [slug]);

  const city = cp.city || "Your Community";
  const state = cp.state || "";
  const businessName = cp.business_name || "ACI Adjustment Group";

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#333", background: WHITE }}>

      {/* NAV */}
      <nav style={{ padding: "12px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee" }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: NAVY }}><span style={{ color: MAROON }}>ACI</span> ADJUSTMENT GROUP</div>
        <a href="#contact" style={{ background: GOLD, color: NAVY, padding: "8px 20px", borderRadius: 3, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>Contact Us</a>
      </nav>

      {/* HERO */}
      <section style={{
        background: `linear-gradient(rgba(10,22,40,0.75), rgba(10,22,40,0.88)), url('https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1400&q=80') center/cover`,
        padding: "80px 40px", textAlign: "center", color: WHITE,
      }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 12px" }}>
          Helping {city}{state ? `, ${state}` : ""} Homeowners Recover and Rebuild
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>
          We are committed to supporting our local community through professional claims guidance and personal engagement with broader recovery initiatives.
        </p>
      </section>

      {/* HOW WE HELP */}
      <section style={{ padding: "60px 40px", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: NAVY, textAlign: "center", marginBottom: 20 }}>How We Help</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            "Claims support and advocacy",
            "Guidance through the recovery process",
            "Connection to additional nonprofit resources when needed",
          ].map(item => (
            <div key={item} style={{ display: "flex", gap: 12, fontSize: 16, color: "#444" }}>
              <span style={{ color: MAROON, fontWeight: 700 }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* COMMUNITY INVOLVEMENT */}
      <section style={{ padding: "50px 40px", background: GRAY }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: NAVY, marginBottom: 16 }}>Community Involvement</h2>
          <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7 }}>
            Many members of our team personally volunteer in support of community-focused initiatives led by nonprofit organizations such as Unified Public Advocacy, which are developing programs to assist underserved homeowners. These are individual volunteer efforts and are separate from our commercial claims services.
          </p>
        </div>
      </section>

      {/* WORKFORCE & COMMUNITY */}
      <section style={{ padding: "50px 40px", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: NAVY, marginBottom: 16 }}>Workforce & Community</h2>
        <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7 }}>
          We believe in building stronger communities by supporting both homeowners and the next generation of skilled professionals involved in property recovery and restoration.
        </p>
      </section>

      {/* CONTACT CTA */}
      <section id="contact" style={{ background: MAROON, padding: "50px 40px", textAlign: "center" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: WHITE, margin: "0 0 12px" }}>Need Help?</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, marginBottom: 20 }}>We're here to help {city} homeowners recover.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <a href={`tel:${cp.phone}`} style={{ background: GOLD, color: NAVY, padding: "12px 28px", borderRadius: 3, fontWeight: 800, textDecoration: "none" }}>Request Help</a>
          {cp.email && <a href={`mailto:${cp.email}`} style={{ background: WHITE, color: MAROON, padding: "12px 28px", borderRadius: 3, fontWeight: 800, textDecoration: "none" }}>Contact Us</a>}
        </div>
      </section>

      {/* LEGAL SEPARATION FOOTER — MANDATORY ON EVERY CP /community PAGE */}
      <div style={{ padding: "20px 40px", background: "#f0f0f0", borderTop: "1px solid #ddd", fontSize: 12, color: "#888", lineHeight: 1.8, textAlign: "center" }}>
        {businessName} is an independent commercial operation affiliated with ACI Adjustment Group. Any references to nonprofit initiatives reflect personal volunteer engagement only. {businessName} does not receive, distribute, or administer nonprofit funds.
      </div>

      {/* FOOTER */}
      <footer style={{ background: NAVY, color: "rgba(255,255,255,0.5)", padding: "30px 40px", fontSize: 12, textAlign: "center", lineHeight: 1.8 }}>
        ACI Adjustment Group · 803 Park Avenue, Newtown, PA 18940<br />
        © 2026 ACI Adjustment Group™ · All Rights Reserved
      </footer>
    </div>
  );
}
