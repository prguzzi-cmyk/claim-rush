import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import "./FileClaim.css";

function useChapterContext() {
  const [searchParams] = useSearchParams();
  return useMemo(() => {
    const cpName = searchParams.get("cp_name");
    const territory = searchParams.get("territory");
    const cpPhone = searchParams.get("cp_phone");
    const cpEmail = searchParams.get("cp_email");
    const source = searchParams.get("source");
    const hasContext = !!(cpName || territory || source);
    return { cpName, territory, cpPhone, cpEmail, source, hasContext };
  }, [searchParams]);
}

export default function FileClaim() {
  const chapter = useChapterContext();
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    damageType: "",
  });

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const [submitError, setSubmitError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(false);

    // Territory: CP context if available, otherwise hardcoded default region.
    // Will be replaced with geocoding/lookup when territory mapping is built.
    const territory = chapter.territory || "Bucks County, PA";

    const payload = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      damageType: formData.damageType,
      cp_name: chapter.cpName || null,
      territory,
      cp_phone: chapter.cpPhone || null,
      cp_email: chapter.cpEmail || null,
      source: chapter.source || "direct",
    };

    console.log("[ClaimRush] Submitting lead:", JSON.stringify(payload, null, 2));

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      const data = await res.json();
      console.log("[ClaimRush] Lead accepted:", data);

      // Build structured lead record and persist locally
      const lead = {
        id: data.id || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        lead: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          damageType: formData.damageType,
        },
        chapter: {
          name: chapter.cpName || null,
          territory: chapter.territory || null,
          phone: chapter.cpPhone || null,
          email: chapter.cpEmail || null,
        },
        source: chapter.source || "direct",
      };

      try {
        const existing = JSON.parse(localStorage.getItem("claimrush_leads") || "[]");
        existing.push(lead);
        localStorage.setItem("claimrush_leads", JSON.stringify(existing));
        console.log("[ClaimRush] LEAD SAVED TO LOCAL STORAGE");
        console.log("[ClaimRush] Lead record:", JSON.stringify(lead, null, 2));
        console.log("[ClaimRush] Total leads in storage:", existing.length);
      } catch (storageErr) {
        console.warn("[ClaimRush] localStorage save failed:", storageErr);
      }

      // CP alert
      console.log("🚨 NEW LEAD ALERT");
      try {
        const audio = new Audio("/notification.mp3");
        audio.play().catch(() => {});
      } catch {}

      // Floating toast notification
      setToast({ name: formData.name, phone: formData.phone });
      setTimeout(() => setToast(null), 5000);

      // Per-lead email disabled — leads collected for batched CSV export only
      console.log("[ClaimRush] Lead stored — no per-lead email (batch CSV only)");

      setSubmitted(true);
    } catch (err) {
      console.error("[ClaimRush] Lead submit failed:", err);
      setSubmitError(true);
    }
  };

  return (
    <div className="fc">
      {/* ── DEV LINK ──────────────────────────────────── */}
      <div className="fc-dev-bar">
        <Link to="/leads">View Leads (dev only)</Link>
      </div>

      {/* ── CHAPTER TRUST BAR ─────────────────────────── */}
      {chapter.hasContext && (
        <div className="fc-chapter-bar">
          <div className="fc-wrap">
            <div className="fc-chapter-bar-inner">
              <span className="fc-chapter-bar-badge">
                Connected from your local chapter
              </span>
              <div className="fc-chapter-bar-details">
                {chapter.cpName && (
                  <span className="fc-chapter-detail">
                    <strong>{chapter.cpName}</strong>
                  </span>
                )}
                {chapter.territory && (
                  <span className="fc-chapter-detail">{chapter.territory}</span>
                )}
                {chapter.cpPhone && (
                  <span className="fc-chapter-detail">
                    <a href={`tel:${chapter.cpPhone.replace(/[^0-9]/g, "")}`}>
                      {chapter.cpPhone}
                    </a>
                  </span>
                )}
                {chapter.cpEmail && (
                  <span className="fc-chapter-detail">
                    <a href={`mailto:${chapter.cpEmail}`}>{chapter.cpEmail}</a>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────── */}
      <section className="fc-hero">
        <div className="fc-wrap">
          <h1 className="fc-hero-headline">Start Your Claim the Right Way</h1>
          <p className="fc-hero-sub">
            If your property has been damaged or your insurance claim is not
            being handled properly, take the first step toward getting the
            outcome you deserve.
          </p>
          <div className="fc-hero-cta">
            <a
              href="#claim-form"
              className="fc-btn fc-btn-primary"
              onClick={(e) => { e.preventDefault(); document.getElementById("claim-form")?.scrollIntoView({ behavior: "smooth" }); }}
            >
              Start Your Claim Now
            </a>
            <a
              href="#help-first"
              className="fc-btn fc-btn-secondary"
              onClick={(e) => { e.preventDefault(); document.getElementById("help-first")?.scrollIntoView({ behavior: "smooth" }); }}
            >
              Get Help First
            </a>
          </div>
        </div>
      </section>

      {/* ── TRUST ─────────────────────────────────────── */}
      <section id="help-first" className="fc-trust">
        <div className="fc-wrap">
          <p className="fc-trust-badge">
            Powered by Unified Public Advocacy
          </p>
          <ul className="fc-trust-list">
            <li>Independent policyholder advocacy</li>
            <li>No pressure, no obligation</li>
            <li>Designed to protect your interests</li>
          </ul>
        </div>
      </section>

      {/* ── INTAKE FORM / SUCCESS ─────────────────────── */}
      <section id="claim-form" className="fc-form-section">
        <div className="fc-wrap">
          {submitted ? (
            <div className="fc-success">
              <div className="fc-success-icon">✓</div>
              <h2 className="fc-section-title">Request Received</h2>
              <p className="fc-success-msg">
                Your request has been received. An enrollment agent will
                contact you shortly to guide you through your next steps.
              </p>
              <p className="fc-success-msg">
                You may also receive a call or text within minutes.
              </p>
              <p className="fc-success-notified">
                Your local Chapter President has been notified
              </p>
              {chapter.cpName && (
                <p className="fc-success-cp">
                  Your chapter contact: <strong>{chapter.cpName}</strong>
                  {chapter.territory && ` — ${chapter.territory}`}
                </p>
              )}
            </div>
          ) : (
            <>
              <h2 className="fc-section-title">Tell Us About Your Situation</h2>
              <form className="fc-form" onSubmit={handleSubmit}>
                <input type="hidden" name="source" value={chapter.source || "direct"} />
                {chapter.territory && (
                  <input type="hidden" name="territory" value={chapter.territory} />
                )}
                {chapter.cpName && (
                  <input type="hidden" name="cp_name" value={chapter.cpName} />
                )}
                {chapter.cpPhone && (
                  <input type="hidden" name="cp_phone" value={chapter.cpPhone} />
                )}
                {chapter.cpEmail && (
                  <input type="hidden" name="cp_email" value={chapter.cpEmail} />
                )}

                <div className="fc-field">
                  <label htmlFor="fc-name">Full Name</label>
                  <input
                    id="fc-name"
                    name="name"
                    type="text"
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="fc-row">
                  <div className="fc-field">
                    <label htmlFor="fc-phone">Phone</label>
                    <input
                      id="fc-phone"
                      name="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="fc-field">
                    <label htmlFor="fc-email">Email</label>
                    <input
                      id="fc-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="fc-field">
                  <label htmlFor="fc-address">Property Address</label>
                  <input
                    id="fc-address"
                    name="address"
                    type="text"
                    placeholder="Street address, city, state, zip"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="fc-field">
                  <label htmlFor="fc-damage">Type of Damage</label>
                  <select
                    id="fc-damage"
                    name="damageType"
                    value={formData.damageType}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select...</option>
                    <option value="fire">Fire</option>
                    <option value="roof">Roof</option>
                    <option value="storm">Storm / Wind / Hail</option>
                    <option value="water">Water / Flood</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {submitError && (
                  <p className="fc-form-error">
                    Something went wrong. Please try again or call{" "}
                    {chapter.cpPhone || "1-800-809-4302"}.
                  </p>
                )}
                <button type="submit" className="fc-btn fc-btn-primary fc-btn-block">
                  Submit &amp; Get Help
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── REASSURANCE ───────────────────────────────── */}
      <section className="fc-reassure">
        <div className="fc-wrap">
          <h2 className="fc-reassure-title">
            You are not committing to anything.
          </h2>
          <div className="fc-reassure-body">
            <p>This is simply a first step.</p>
            <p>
              A licensed professional will review your situation and help you
              understand your options — with no obligation.
            </p>
            <p>
              You stay in control of the process at every point.
            </p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────── */}
      <section className="fc-final">
        <div className="fc-wrap">
          <h2 className="fc-final-title">Prefer to speak to someone now?</h2>
          <a
            href={`tel:${(chapter.cpPhone || "18008094302").replace(/[^0-9]/g, "")}`}
            className="fc-btn fc-btn-primary"
          >
            Call {chapter.cpPhone || "1-800-809-4302"}
          </a>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────── */}
      <footer className="fc-footer">
        <p>
          © {new Date().getFullYear()} Unified Public Advocacy ·{" "}
          <a href="https://upaclaim.org">UPAclaim.org</a>
        </p>
      </footer>

      {/* ── FLOATING TOAST ─────────────────────────────── */}
      {toast && (
        <div className="fc-toast">
          <div className="fc-toast-title">🚨 New Lead Received</div>
          <div className="fc-toast-detail">{toast.name} · {toast.phone}</div>
        </div>
      )}
    </div>
  );
}
