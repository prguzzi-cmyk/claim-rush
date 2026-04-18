/**
 * Page 2: ACI Corporate /community-impact
 * Brand positioning with UPA alignment.
 * COMPLIANCE: "currently in development" / "expanding over time"
 * Legal separation footer MANDATORY.
 */

const GOLD = "#C9A84C";
const NAVY = "#0A1628";
const MAROON = "#800020";
const WHITE = "#FFFFFF";
const GRAY = "#F8F9FA";

export default function CommunityImpact() {
  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#333", background: WHITE }}>

      {/* NAV */}
      <nav style={{ padding: "12px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: NAVY }}><span style={{ color: MAROON }}>ACI</span> ADJUSTMENT GROUP</div>
        <div style={{ display: "flex", gap: 20, fontSize: 14, fontWeight: 500 }}>
          <a href="/" style={{ color: "#555", textDecoration: "none" }}>Home</a>
          <a href="/community-impact" style={{ color: MAROON, textDecoration: "none", fontWeight: 700 }}>Community Impact</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        background: `linear-gradient(rgba(10,22,40,0.75), rgba(10,22,40,0.88)), url('https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1400&q=80') center/cover`,
        padding: "80px 40px 70px", textAlign: "center", color: WHITE,
      }}>
        <h1 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 12px" }}>Committed to Communities — Beyond the Claim</h1>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>
          ACI supports community recovery and workforce development initiatives through alignment with nonprofit efforts led by Unified Public Advocacy.
        </p>
      </section>

      {/* OUR COMMITMENT */}
      <section style={{ padding: "60px 40px", maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: NAVY, textAlign: "center", marginBottom: 24 }}>Our Commitment</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            "Supporting homeowners through the claims process",
            "Encouraging community recovery efforts",
            "Promoting workforce development pathways",
          ].map(item => (
            <div key={item} style={{ display: "flex", gap: 12, fontSize: 16, color: "#444" }}>
              <span style={{ color: MAROON, fontWeight: 700 }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* COMMUNITY RECOVERY */}
      <section style={{ padding: "50px 40px", background: GRAY }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: NAVY, marginBottom: 16 }}>Community Recovery</h2>
          <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7, marginBottom: 16 }}>
            Through nonprofit-led initiatives currently in development, underserved homeowners may eventually receive support for recovery needs when traditional coverage falls short. Programs and eligibility vary by region and are expanding over time.
          </p>
          <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7 }}>
            ACI professionals may assist by identifying needs and helping connect homeowners to appropriate nonprofit resources.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "60px 40px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: NAVY, textAlign: "center", marginBottom: 24 }}>How It Works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { step: "1", title: "Identify Needs", desc: "Recognize homeowner recovery needs during the claims process" },
            { step: "2", title: "Provide Guidance", desc: "Offer professional claims support and advocacy" },
            { step: "3", title: "Refer to Resources", desc: "Connect to appropriate nonprofit support when applicable" },
            { step: "4", title: "Continue Assisting", desc: "Support the homeowner through the full recovery journey" },
          ].map(s => (
            <div key={s.step} style={{ textAlign: "center", padding: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: MAROON, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, margin: "0 auto 12px" }}>{s.step}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <section style={{ padding: "50px 40px", background: GRAY }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            "Supports Unified Public Advocacy initiatives",
            "Focused on ethical claims recovery",
            "Community-first approach",
          ].map(item => (
            <div key={item} style={{ display: "flex", gap: 12, fontSize: 15, color: "#444" }}>
              <span style={{ color: GOLD, fontWeight: 700 }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* LEGAL SEPARATION FOOTER — MANDATORY */}
      <div style={{ padding: "20px 40px", background: "#f0f0f0", borderTop: "1px solid #ddd", fontSize: 12, color: "#888", lineHeight: 1.8, textAlign: "center" }}>
        UPA's community and workforce initiatives are actively developing and operate independently under 501(c)(3) standards. ACI's role is supportive and does not include disbursement of nonprofit funds. ACI and UPA are separate legal entities.
      </div>

      {/* FOOTER */}
      <footer style={{ background: NAVY, color: "rgba(255,255,255,0.5)", padding: "30px 40px", fontSize: 12, textAlign: "center", lineHeight: 1.8 }}>
        ACI Adjustment Group · 803 Park Avenue, Newtown, PA 18940<br />
        © 2026 ACI Adjustment Group™ · All Rights Reserved
      </footer>
    </div>
  );
}
