import { useState } from "react";

/**
 * Page 1: ACIUnited.com /chapter-president-opportunity
 * CP recruitment page with UPA nonprofit alignment.
 * COMPLIANCE: UPA programs described as "currently developing" / "in development"
 * Legal separation footer mandatory.
 */

const GOLD = "#C9A84C";
const NAVY = "#0A1628";
const MAROON = "#800020";
const WHITE = "#FFFFFF";
const GRAY = "#F8F9FA";

export default function ChapterPresidentOpportunity() {
  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#333", background: WHITE }}>

      {/* NAV */}
      <nav style={{ padding: "12px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", background: WHITE }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: NAVY }}><span style={{ color: MAROON }}>ACI</span> UNITED</div>
        <a href="#apply" style={{ background: GOLD, color: NAVY, padding: "8px 20px", borderRadius: 3, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>Apply Now</a>
      </nav>

      {/* HERO */}
      <section style={{
        background: `linear-gradient(rgba(10,22,40,0.8), rgba(10,22,40,0.9)), url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80') center/cover`,
        padding: "100px 40px 80px", textAlign: "center", color: WHITE,
      }}>
        <h1 style={{ fontSize: "clamp(30px,5vw,48px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 16px", maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
          Build a Territory. Lead Your Market.<br /><span style={{ color: GOLD }}>Make a Real Impact.</span>
        </h1>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", maxWidth: 600, margin: "0 auto 28px", lineHeight: 1.6 }}>
          As a Chapter President, you operate your own territory while supporting broader community recovery initiatives alongside Unified Public Advocacy.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <a href="#apply" style={{ background: GOLD, color: NAVY, padding: "14px 32px", borderRadius: 3, fontWeight: 800, textDecoration: "none" }}>Apply Now</a>
          <a href="https://calendly.com/prguzzi/30min" target="_blank" rel="noopener" style={{ background: "transparent", color: WHITE, padding: "14px 32px", borderRadius: 3, fontWeight: 700, textDecoration: "none", border: "1px solid rgba(255,255,255,0.3)" }}>Schedule Call</a>
        </div>
      </section>

      {/* DIFFERENTIATOR */}
      <section style={{ padding: "60px 40px", maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: NAVY, marginBottom: 16 }}>A Model Built for More Than Just Claims</h2>
        <p style={{ fontSize: 16, color: "#555", lineHeight: 1.7 }}>
          ACI Chapter Presidents operate within a system that drives business growth while also enabling personal engagement with nonprofit-led community recovery efforts.
        </p>
      </section>

      {/* BENEFITS GRID */}
      <section style={{ padding: "50px 40px", background: GRAY }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {[
            { title: "Build a High-Performance Team", desc: "Develop and scale your own team of inspectors, adjusters, and field personnel.", icon: "👥" },
            { title: "Market Authority Positioning", desc: "Establish yourself as the go-to resource in your territory for property claim guidance and recovery.", icon: "🏆" },
            { title: "Community Impact Alignment", desc: "Operate alongside nonprofit-led initiatives that support homeowners in need, with opportunity for personal volunteer engagement in your community.", icon: "🤝" },
            { title: "Scalable Territory Model", desc: "Control and grow your assigned territory with full operational support and infrastructure.", icon: "📈" },
          ].map(b => (
            <div key={b.title} style={{ background: WHITE, border: "1px solid #e8e8e8", borderRadius: 8, padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{b.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 8 }}>{b.title}</div>
              <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* NONPROFIT ALIGNMENT */}
      <section style={{ padding: "60px 40px", maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: NAVY, marginBottom: 16, textAlign: "center" }}>Aligned with Community Recovery Initiatives</h2>
        <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7, marginBottom: 16 }}>
          ACI supports the mission of Unified Public Advocacy, a nonprofit organization currently developing programs focused on helping underserved homeowners and promoting workforce development in disaster recovery. Program availability may be limited by region as initiatives scale.
        </p>
        <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7 }}>
          Chapter Presidents may choose to personally volunteer their time in support of UPA's mission. This participation is entirely optional and is separate from commercial territory operations. UPA operates independently as a 501(c)(3), and nonprofit resources do not flow to Chapter Presidents or their businesses.
        </p>
      </section>

      {/* FINAL CTA */}
      <section id="apply" style={{ background: MAROON, padding: "60px 40px", textAlign: "center" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: WHITE, margin: "0 0 12px" }}>Apply to Become a Chapter President</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, maxWidth: 500, margin: "0 auto 24px" }}>
          Limited territories available. Applications reviewed within 48 hours.
        </p>
        <a href="/#apply" style={{ display: "inline-block", background: GOLD, color: NAVY, padding: "14px 36px", borderRadius: 3, fontWeight: 800, textDecoration: "none", fontSize: 15 }}>
          Apply Now
        </a>
      </section>

      {/* FOOTER */}
      <footer style={{ background: NAVY, color: "rgba(255,255,255,0.5)", padding: "30px 40px", fontSize: 12, textAlign: "center", lineHeight: 1.8 }}>
        ACI Adjustment Group · 803 Park Avenue, Newtown, PA 18940<br />
        © 2026 ACI Adjustment Group™ · All Rights Reserved · Pax Equitas Network
      </footer>
    </div>
  );
}
