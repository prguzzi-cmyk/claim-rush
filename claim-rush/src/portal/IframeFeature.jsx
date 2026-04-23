import { useNavigate } from "react-router-dom";

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
 * When a given feature ships natively in ClaimRush, replace the specific
 * route's element in App.jsx with the real component.
 */

const mono = { fontFamily: "'Courier New', monospace" };

export default function IframeFeature({ title = "" }) {
  const navigate = useNavigate();

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
      }}>
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
          This ClaimRush module is being finalized for production. You'll see it here in the command center when it's ready.
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
