import { useEffect } from "react";

/**
 * RIN redirect shell. rin.aciunited.com is the single entry point for
 * RIN features; this component previously iframe-embedded RIN pages but
 * now just redirects the browser to the equivalent route on rin.aciunited.com.
 *
 * Mounted behind aciunited.com/portal/rin/* routes so existing sidebar
 * links and bookmarks keep working — users land here briefly, then their
 * browser navigates to rin.aciunited.com/<rinRoute>.
 *
 * Props match the previous iframe contract so App.jsx doesn't have to change:
 *   rinRoute  — path on rin.aciunited.com (e.g. "/app/fire-leads")
 *   rinQuery  — optional query string appended with "?"
 *   readonly  — when true, forwarded as ?mode=readonly
 *   title     — label shown during the redirect moment
 */

const RIN_ORIGIN = "https://rin.aciunited.com";

export default function IframeFeature({ rinRoute, readonly = false, title = "", rinQuery = "" }) {
  const params = new URLSearchParams(rinQuery || "");
  if (readonly) params.set("mode", "readonly");
  const qs = params.toString();
  const target = `${RIN_ORIGIN}${rinRoute}${qs ? `?${qs}` : ""}`;

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "60vh", textAlign: "center", padding: "0 24px",
    }}>
      <div style={{
        fontSize: 15, fontWeight: 600, color: "#fff",
        fontFamily: "'Inter', sans-serif", marginBottom: 8,
      }}>
        Opening {title || "ClaimRush Portal"}…
      </div>
      <div style={{
        fontSize: 13, color: "rgba(255,255,255,0.55)",
        fontFamily: "'Inter', sans-serif",
      }}>
        If the page doesn't open automatically,{" "}
        <a href={target} style={{ color: "#00E6A8", textDecoration: "underline" }}>
          click here
        </a>.
      </div>
    </div>
  );
}
