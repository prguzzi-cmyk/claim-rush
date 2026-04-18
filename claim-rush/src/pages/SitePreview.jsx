import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

/**
 * Phase 13 — Local site preview renderer.
 * Renders a CP/RVP/Agent branded website page using data from the backend.
 * Route: /preview/:role/:slug
 *
 * Fetches site content from /v1/website-manager/sites and renders
 * using the gold/navy editorial template matching RoleSitePage.
 */

const GOLD = "#C9A84C";
const NAVY = "#0A1628";

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

  useEffect(() => {
    // The resolver is a PUBLIC endpoint (no auth needed)
    // Try the resolver first, fall back to direct content query
    fetch(`/v1/website-manager/resolve?host=claimrush.com&path=/${role}/${slug}`)
      .then(r => {
        if (r.ok) return r.json();
        // Resolver failed — try fetching sites with auth
        const token = getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        return fetch(`/v1/website-manager/sites`, { headers })
          .then(r2 => r2.json())
          .then(sites => {
            const matched = sites.find(s => s.subdomain === slug);
            if (!matched) throw new Error("Site not found for slug: " + slug);
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
        // Handle resolver response format vs direct format
        if (data.content && data.content.fields) {
          let fields = data.content.fields;
          try { if (typeof fields === "string") fields = JSON.parse(fields); } catch {}
          setSite({ ...data.site, content: data.content, fields });
        } else if (data.fields) {
          setSite(data);
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [role, slug]);

  if (loading) return <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Georgia, serif" }}>Loading preview...</div>;
  if (error) return <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: "#E05050", fontFamily: "'Courier New', monospace" }}>Error: {error}</div>;

  const f = site?.fields || {};
  const name = f.name || f.hero_title || `${role?.toUpperCase()} — ${slug}`;
  const subtitle = f.hero_subtitle || `Your local ${role?.toUpperCase()} representative`;
  const email = f.email || "";
  const phone = f.phone || "";
  const cta = f.cta || "Get Started";

  const roleBadge = { cp: "Chapter President", rvp: "Regional Vice President", agent: "Licensed Agent" }[role] || role?.toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: "#fff" }}>
      {/* Preview banner */}
      <div style={{ background: "#C9A84C", color: NAVY, padding: "8px 20px", fontSize: 13, fontWeight: 700, textAlign: "center", fontFamily: "'Courier New', monospace", letterSpacing: 1 }}>
        PREVIEW MODE — This is how the site will appear at claimrush.com/{role}/{slug}
      </div>

      {/* Header */}
      <header style={{ padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${GOLD}22` }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 18, fontWeight: 700, color: GOLD, letterSpacing: 2 }}>
          CLAIM RUSH<span style={{ fontSize: 10, verticalAlign: "super" }}>™</span>
        </div>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>
          POWERED BY ACI UNITED
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: "80px 40px", textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "4px 16px", border: `1px solid ${GOLD}40`, borderRadius: 20, marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: 2, fontFamily: "'Courier New', monospace" }}>{roleBadge}</span>
        </div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, lineHeight: 1.15, margin: "0 0 16px", color: "#fff" }}>
          {name}
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", fontFamily: "Georgia, serif", lineHeight: 1.7, maxWidth: 600, margin: "0 auto 32px" }}>
          {subtitle}
        </p>
        <a href={`mailto:${email}`} style={{
          display: "inline-block", padding: "14px 40px", background: GOLD, color: NAVY,
          fontWeight: 900, fontSize: 14, fontFamily: "'Courier New', monospace", letterSpacing: 2,
          textDecoration: "none", borderRadius: 3,
        }}>
          {cta.toUpperCase()}
        </a>
      </section>

      {/* Contact card */}
      <section style={{ padding: "40px", maxWidth: 500, margin: "0 auto" }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${GOLD}20`, borderRadius: 8, padding: "28px 32px" }}>
          <h3 style={{ fontSize: 14, color: GOLD, fontWeight: 700, letterSpacing: 2, fontFamily: "'Courier New', monospace", margin: "0 0 16px" }}>CONTACT</h3>
          {email && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>Email</span>
              <span style={{ color: "#fff" }}>{email}</span>
            </div>
          )}
          {phone && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>Phone</span>
              <span style={{ color: "#fff" }}>{phone}</span>
            </div>
          )}
          {site?.territory_state && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>Territory</span>
              <span style={{ color: "#fff" }}>{site.territory_state}</span>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "32px 40px", borderTop: `1px solid ${GOLD}15`, textAlign: "center", marginTop: 60 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'Courier New', monospace" }}>
          Claim Rush™ · Powered by ACI United · Pax Equitas Network
        </div>
      </footer>
    </div>
  );
}
