import { useNavigate } from "react-router-dom";
import { ENGINE_LINKS, openEngine } from "../lib/engineLinks.js";
import { useAxisContext } from "./AxisContext";

/**
 * In-shell placeholder for /portal/rin/* routes.
 *
 * These 29 routes used to either iframe-embed or hard-redirect to the
 * legacy Angular console at rin.aciunited.com — both violated portal
 * containment (users ended up in a different app). This component
 * renders a ClaimRush-themed "in development" card INSIDE the portal
 * shell so the sidebar, ticker, and chrome stay intact.
 *
 * Component contract unchanged from earlier versions (rinRoute, title,
 * readonly, rinQuery are still accepted) so App.jsx route declarations
 * don't need edits. The props are displayed/ignored as appropriate.
 *
 * Top-right "Open in RIN ↗" link — additive only, does NOT change the
 * placeholder behavior. Subtle pop-out for users who need the real
 * engine before the in-shell version ships. Auth handoff is automatic
 * (shared localStorage.access_token between ClaimRush and RIN).
 *
 * When a given feature ships natively in ClaimRush, replace the specific
 * route's element in App.jsx with the real component.
 */

const mono = { fontFamily: "'Courier New', monospace" };

// Fallback for routes not in ENGINE_LINKS — same env-var convention as
// the helper module, identical localhost:4200 default to keep dev paths
// in sync.
const RIN_URL = import.meta.env.VITE_RIN_URL || "http://localhost:4200";

// Reverse lookup: RIN path (e.g. "/app/estimating") → engine key. Lets
// us prefer openEngine() for the explicitly-named engines and fall back
// to a direct URL build for everything else.
const ROUTE_TO_ENGINE_KEY = Object.fromEntries(
  Object.entries(ENGINE_LINKS).map(([key, url]) => [url.replace(RIN_URL, ""), key]),
);

export default function IframeFeature({ title = "", rinRoute = "", rinQuery = "" }) {
  const navigate = useNavigate();
  const { userRole } = useAxisContext();

  // RIN pop-out is admin-only. CP/RVP/Agent/Adjuster never see the link —
  // RIN is internal command-and-control, not a destination external roles
  // are supposed to reach.
  const canSeeRinPopout = userRole === "home_office";

  const engineKey = ROUTE_TO_ENGINE_KEY[rinRoute] || null;
  const directUrl = rinRoute
    ? `${RIN_URL}${rinRoute}${rinQuery ? `?${rinQuery}` : ""}`
    : null;
  const popoutHref = canSeeRinPopout ? (engineKey ? ENGINE_LINKS[engineKey] : directUrl) : null;
  const handlePopout = (e) => {
    e.preventDefault();
    if (engineKey) {
      openEngine(engineKey);
    } else if (directUrl) {
      window.location.href = directUrl;
    }
  };

  return (
    <div style={{
      maxWidth: 900,
      margin: "0 auto",
      padding: "40px 24px",
    }}>
      <div style={{
        background: "linear-gradient(135deg, rgba(0,230,168,0.04) 0%, rgba(0,230,168,0.01) 100%)",
        border: "1px solid rgba(0,230,168,0.18)",
        borderRadius: 14,
        padding: "48px 36px",
        textAlign: "center",
        position: "relative",
      }}>
        {/* Pop-out to RIN — top-right, subtle. Additive only; the rest of
            the placeholder card is unchanged. Hidden when the route has
            no RIN target (e.g. coming-soon stubs). */}
        {popoutHref && (
          <a
            href={popoutHref}
            onClick={handlePopout}
            title={`Open ${title || "this engine"} in RIN`}
            style={{
              position: "absolute",
              top: 12,
              right: 16,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.4,
              color: "rgba(0,230,168,0.65)",
              textDecoration: "none",
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid rgba(0,230,168,0.20)",
              background: "rgba(0,230,168,0.04)",
              transition: "all 0.15s",
              ...mono,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#00E6A8";
              e.currentTarget.style.borderColor = "rgba(0,230,168,0.50)";
              e.currentTarget.style.background = "rgba(0,230,168,0.10)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(0,230,168,0.65)";
              e.currentTarget.style.borderColor = "rgba(0,230,168,0.20)";
              e.currentTarget.style.background = "rgba(0,230,168,0.04)";
            }}
          >
            Open in RIN ↗
          </a>
        )}

        {/* Status pill */}
        <div style={{
          display: "inline-block",
          padding: "6px 14px",
          background: "rgba(168,85,247,0.08)",
          border: "1px solid rgba(168,85,247,0.30)",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          color: "#A855F7",
          marginBottom: 24,
          ...mono,
        }}>
          IN DEVELOPMENT
        </div>

        {/* Title */}
        <div style={{
          fontSize: 26,
          fontWeight: 700,
          color: "#FFFFFF",
          fontFamily: "'Georgia', 'Times New Roman', serif",
          letterSpacing: 0.5,
          marginBottom: 10,
        }}>
          {title || "Feature"}
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.6,
          maxWidth: 520,
          margin: "0 auto 28px",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        }}>
          This UPA Platform module is being finalized for production. You'll see it here in the command center when it's ready.
        </div>

        {/* Back to Dashboard */}
        <button
          onClick={() => navigate("/portal")}
          style={{
            padding: "11px 24px",
            background: "rgba(0,230,168,0.10)",
            border: "1px solid rgba(0,230,168,0.35)",
            borderRadius: 8,
            color: "#00E6A8",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.5,
            cursor: "pointer",
            transition: "all 0.15s",
            ...mono,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(0,230,168,0.18)";
            e.currentTarget.style.borderColor = "rgba(0,230,168,0.60)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(0,230,168,0.10)";
            e.currentTarget.style.borderColor = "rgba(0,230,168,0.35)";
          }}
        >
          ← BACK TO COMMAND CENTER
        </button>
      </div>
    </div>
  );
}
