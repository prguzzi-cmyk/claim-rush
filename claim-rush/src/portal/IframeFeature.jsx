import { useEffect, useRef, useState } from "react";

/**
 * Phase 5 — Reusable iframe shell for embedding RIN Angular pages inside ClaimRush.
 *
 * In development: loads RIN at localhost:4200 via iframe.
 * In production: if VITE_RIN_URL is not set, shows a clean placeholder.
 */

const RIN_ORIGIN = import.meta.env.VITE_RIN_URL || "http://127.0.0.1:4200";
const IS_PRODUCTION = RIN_ORIGIN.startsWith("http://127.0.0.1") && typeof window !== "undefined" && !window.location.hostname.includes("localhost");

function getToken() {
  const raw = localStorage.getItem("access_token");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

function ProductionPlaceholder({ title }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "60vh", textAlign: "center", padding: "0 24px",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: "rgba(0,230,168,0.06)", border: "1px solid rgba(0,230,168,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, marginBottom: 20,
      }}>
        {"\u{1F527}"}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>
        {title || "Feature"}
      </div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", maxWidth: 400, lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>
        This feature is available in the local development environment. Production access is being deployed and will be available soon.
      </div>
      <div style={{
        marginTop: 20, padding: "8px 20px", borderRadius: 8,
        background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)",
        fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#A855F7",
        fontFamily: "'Inter', sans-serif",
      }}>
        PRODUCTION DEPLOYMENT IN PROGRESS
      </div>
    </div>
  );
}

export default function IframeFeature({ rinRoute, readonly = false, title = "", rinQuery = "" }) {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // In production without RIN URL, show placeholder immediately
  if (IS_PRODUCTION) {
    return <ProductionPlaceholder title={title} />;
  }

  // Build the full RIN URL with hash routing
  const params = new URLSearchParams();
  const role = localStorage.getItem("cr_role") || "";
  const userRaw = localStorage.getItem("cr_user");
  let user = {};
  try { user = JSON.parse(userRaw || "{}"); } catch {}

  params.set("src", "claimrush-embed");
  const jwt = getToken();
  if (jwt) params.set("jwt", jwt);
  if (role) params.set("role", role);
  if (readonly) params.set("mode", "readonly");

  const hashPart = rinQuery ? `${rinRoute}?${rinQuery}` : rinRoute;
  const iframeUrl = `${RIN_ORIGIN}/?${params.toString()}#${hashPart}`;

  // Send JWT via postMessage after iframe loads
  useEffect(() => {
    let didLoad = false;

    function sendContext() {
      if (!iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        {
          type: "rin:context",
          role: role,
          user_id: user.user_id || null,
          display_name: user.display_name || "",
          jwt: jwt,
          src: "claimrush-shell",
        },
        RIN_ORIGIN
      );
    }

    function onLoad() {
      didLoad = true;
      setLoading(false);
      setError(false);
      setTimeout(sendContext, 500);
    }

    const iframe = iframeRef.current;
    if (iframe) iframe.addEventListener("load", onLoad);

    function handleMessage(event) {
      if (event.origin !== RIN_ORIGIN) return;
      if (event.data?.type === "rin:request_context") sendContext();
    }
    window.addEventListener("message", handleMessage);

    const timeout = setTimeout(() => {
      if (!didLoad) setError(true);
    }, 10000);

    return () => {
      if (iframe) iframe.removeEventListener("load", onLoad);
      window.removeEventListener("message", handleMessage);
      clearTimeout(timeout);
    };
  }, [rinRoute]);

  return (
    <div style={{
      position: "relative", width: "100%",
      height: "calc(100vh - 60px)", background: "#070D18",
    }}>
      {loading && !error && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.5)", fontFamily: "'Courier New', monospace", fontSize: 14, zIndex: 2,
        }}>
          Loading {title || rinRoute}...
        </div>
      )}

      {error && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 12,
          color: "rgba(255,255,255,0.5)", fontFamily: "'Courier New', monospace", fontSize: 14, zIndex: 2,
        }}>
          <div>Could not connect to {title || rinRoute}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            Ensure the RIN portal is running locally
          </div>
          <button
            onClick={() => { setError(false); setLoading(true); }}
            style={{
              padding: "8px 20px", background: "rgba(0,230,168,0.1)",
              border: "1px solid rgba(0,230,168,0.3)", borderRadius: 6,
              color: "#00E6A8", cursor: "pointer", fontSize: 13,
              fontFamily: "'Courier New', monospace",
            }}
          >
            Retry
          </button>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={iframeUrl}
        title={title || rinRoute}
        style={{
          width: "100%", height: "100%", border: "none",
          background: "#070D18",
          opacity: loading ? 0 : 1, transition: "opacity 0.3s ease",
        }}
        allow="clipboard-write"
      />
    </div>
  );
}
