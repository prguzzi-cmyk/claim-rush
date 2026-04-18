import { useEffect, useRef, useState } from "react";

/**
 * Phase 5 — Reusable iframe shell for embedding RIN Angular pages inside ClaimRush.
 *
 * Renders an iframe pointing to RIN at :4200 with the specified hash route.
 * Passes JWT via postMessage (strict origin) so RIN picks up auth context.
 * Fills available space below the identity header. Dark theme, no visible borders.
 *
 * Props:
 *   rinRoute  — the RIN hash route, e.g. "/app/claims" → loads localhost:4200/#/app/claims
 *   readonly  — if true, appends ?mode=readonly to the RIN URL
 *   title     — optional label shown during loading
 */

const RIN_ORIGIN = "http://127.0.0.1:4200";

function getToken() {
  const raw = localStorage.getItem("access_token");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export default function IframeFeature({ rinRoute, readonly = false, title = "", rinQuery = "" }) {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  // Auth params go BEFORE the hash so Angular's window.location.search can read them.
  // Feature-specific query params (like peril=flood) go AFTER the hash route
  // because Angular reads them via ActivatedRoute.snapshot.queryParamMap.
  const hashPart = rinQuery ? `${rinRoute}?${rinQuery}` : rinRoute;
  const iframeUrl = `${RIN_ORIGIN}/?${params.toString()}#${hashPart}`;

  // Send JWT via postMessage after iframe loads (backup delivery method)
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
      // Small delay to let Angular bootstrap before sending postMessage
      setTimeout(sendContext, 500);
    }

    // Attach load handler
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener("load", onLoad);
    }

    // Also listen for context requests from the iframe
    function handleMessage(event) {
      if (event.origin !== RIN_ORIGIN) return;
      if (event.data?.type === "rin:request_context") {
        sendContext();
      }
    }
    window.addEventListener("message", handleMessage);

    // Timeout — use didLoad flag (not stale React state)
    const timeout = setTimeout(() => {
      if (!didLoad) setError(true);
    }, 15000);

    return () => {
      if (iframe) iframe.removeEventListener("load", onLoad);
      window.removeEventListener("message", handleMessage);
      clearTimeout(timeout);
    };
  }, [rinRoute]);

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "calc(100vh - 60px)",
      background: "#070D18",
    }}>
      {/* Loading state */}
      {loading && !error && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "'Courier New', monospace",
          fontSize: 14,
          zIndex: 2,
        }}>
          Loading {title || rinRoute}...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 12,
          color: "rgba(255,255,255,0.5)",
          fontFamily: "'Courier New', monospace",
          fontSize: 14,
          zIndex: 2,
        }}>
          <div>Failed to load {title || rinRoute}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            Make sure the RIN portal is running at {RIN_ORIGIN}
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

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        title={title || rinRoute}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: "#070D18",
          opacity: loading ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
        allow="clipboard-write"
      />
    </div>
  );
}
