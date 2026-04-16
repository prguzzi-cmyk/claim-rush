import "./GetHelp.css";

export default function GetHelp() {
  return (
    <div className="gh">
      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="gh-hero">
        <div className="gh-wrap">
          <h1 className="gh-hero-headline">
            Think Your Insurance Claim Was Underpaid?
          </h1>
          <p className="gh-hero-sub">
            Most homeowners and business owners receive less than they are
            entitled to. You do not have to go through the claims process alone.
          </p>
          <p className="gh-hero-body">
            Insurance companies control the process, the paperwork, and the
            numbers. Without proper representation or guidance, important damage
            is often missed, delayed, or underpaid.
          </p>
          <p className="gh-hero-body">
            Unified Public Advocacy exists to help policyholders understand
            their rights and connect them with professionals who can properly
            handle their claim.
          </p>
          <div className="gh-hero-cta">
            <a
              href="/file-a-claim"
              className="gh-btn gh-btn-primary"
            >
              Get Professional Help Now
            </a>
            <a href="#when-to-help" className="gh-btn gh-btn-secondary">
              Learn Your Rights
            </a>
          </div>
        </div>
      </section>

      {/* ── TRUST ─────────────────────────────────────────── */}
      <section className="gh-trust">
        <div className="gh-wrap">
          <h2 className="gh-section-title">Why Policyholders Start Here</h2>
          <div className="gh-trust-grid">
            {[
              {
                icon: "🛡️",
                text: "Independent policyholder advocacy",
              },
              {
                icon: "⚖️",
                text: "Focused on fair claim outcomes",
              },
              {
                icon: "📚",
                text: "Educational, not high-pressure",
              },
              {
                icon: "🤝",
                text: "Connection to licensed claim professionals when needed",
              },
            ].map((item) => (
              <div key={item.text} className="gh-trust-card">
                <span className="gh-trust-icon">{item.icon}</span>
                <span className="gh-trust-text">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM / EDUCATION ───────────────────────────── */}
      <section className="gh-problem">
        <div className="gh-wrap">
          <h2 className="gh-section-title">
            What Usually Goes Wrong in Insurance Claims
          </h2>
          <div className="gh-problem-body">
            <p>
              Many policyholders do not realize how often legitimate damage is
              missed, undervalued, or delayed.
            </p>
            <p>
              By the time the insurance company finishes its process, people are
              often left with unanswered questions, unrepaired damage, and
              settlements that do not reflect the true loss.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT UPA DOES ─────────────────────────────────── */}
      <section className="gh-how">
        <div className="gh-wrap">
          <h2 className="gh-section-title">
            How Unified Public Advocacy Helps
          </h2>
          <div className="gh-how-body">
            <p>
              Unified Public Advocacy helps policyholders understand the claims
              process, identify common claim problems, and take the right next
              step.
            </p>
            <p>
              When professional adjusting support is needed, policyholders can
              be connected to experienced licensed public adjusters who work on
              their behalf — not for the insurance company.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHEN TO GET HELP ──────────────────────────────── */}
      <section id="when-to-help" className="gh-when">
        <div className="gh-wrap">
          <h2 className="gh-section-title">When to Seek Help</h2>
          <ul className="gh-when-list">
            {[
              "Your claim feels underpaid",
              "Damage was missed or minimized",
              "Communication has stalled",
              "You are overwhelmed by the process",
              "You want professional representation before things get worse",
            ].map((item) => (
              <li key={item} className="gh-when-item">
                <span className="gh-when-check">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <section className="gh-final">
        <div className="gh-wrap">
          <h2 className="gh-final-title">
            You Do Not Have To Handle This Alone
          </h2>
          <p className="gh-final-body">
            Start with trusted advocacy. If your situation requires professional
            claim representation, we will help you take the next step.
          </p>
          <div className="gh-final-cta">
            <a
              href="/file-a-claim"
              className="gh-btn gh-btn-primary"
            >
              Get Professional Help Now
            </a>
            <a href="#" className="gh-btn gh-btn-secondary">
              Start a Claim
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className="gh-footer">
        <p>
          © {new Date().getFullYear()} Unified Public Advocacy · {""}
          <a href="https://upaclaim.org">UPAclaim.org</a>
        </p>
      </footer>
    </div>
  );
}
