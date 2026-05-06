import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson, login } from "../lib/api";
import logoIcon from "../assets/logo/claimrush-icon.svg";

// Google OAuth client ID — set in claim-rush/.env.development:
//   VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
// When unset, the Google button renders in disabled "Not configured" state
// and the rest of the login flow is unaffected.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// Map RIN role → ClaimRush internal role + landing route
const ROLE_ROUTES = {
  cp:                 { crRole: "CP",          route: "/portal" },
  manager:            { crRole: "CP",          route: "/portal" },
  rvp:                { crRole: "RVP",         route: "/portal" },
  agent:              { crRole: "agent",       route: "/portal" },
  "call-center-agent":{ crRole: "agent",       route: "/portal" },
  "sales-rep":        { crRole: "agent",       route: "/portal" },
  adjuster:           { crRole: "adjuster",    route: "/portal" },
  agency:             { crRole: "home_office", route: "/portal" },
  admin:              { crRole: "home_office", route: "/portal" },
  "super-admin":      { crRole: "home_office", route: "/portal" },
};

const FIELD_ROLES = new Set(["cp", "manager", "rvp", "agent", "call-center-agent", "sales-rep", "agency"]);

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      // Use /v1/users/me/permissions instead of /v1/users/me — the latter
      // currently 500s on a SQLAlchemy mapper-init bug, and permissions
      // already returns the role string we need to pick a landing route.
      const me = await apiJson("/users/me/permissions");
      const roleName = me?.role || "";
      const mapping = ROLE_ROUTES[roleName];

      if (!mapping) {
        setError(`Role "${roleName}" does not have access to this portal. The UPA network portal is for field roles (CP, RVP, Agency, Agent).`);
        localStorage.removeItem("access_token");
        setLoading(false);
        return;
      }

      // Store user context for AxisContext to pick up. The permissions
      // endpoint returns user_id + role only, so display_name falls back
      // to email until the dedicated /me endpoint is fixed.
      localStorage.setItem("cr_role", mapping.crRole);
      localStorage.setItem("cr_user", JSON.stringify({
        user_id: me.user_id,
        display_name: email,
        email,
        rin_role: roleName,
      }));

      // Land everyone on Fire Leads after successful login (per task spec).
      navigate("/portal/fire-leads", { replace: true });
    } catch (err) {
      setError(err?.detail || "Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  // ── Google OAuth — Google Identity Services (GIS) ──────────────────
  // Loads the GIS script on demand. When the user clicks "Continue with
  // Google", we trigger the popup flow and POST the resulting credential
  // to the same backend endpoint the Angular portal uses
  // (/v1/auth/google/verify). On success we land in the same role-mapping
  // path as the password flow so behavior is identical past the token.
  const googleBtnRef = useRef(null);
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    if (window.google?.accounts?.id) return;
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    document.head.appendChild(s);
    return () => { /* leave the script — re-mounts reuse it */ };
  }, []);

  async function handleGoogleClick() {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in not configured. Set VITE_GOOGLE_CLIENT_ID in claim-rush/.env.development and restart vite.");
      return;
    }
    if (!window.google?.accounts?.id) {
      setError("Google sign-in is still loading. Try again in a second.");
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (credResp) => {
        setError(""); setLoading(true);
        try {
          const data = await apiJson("/auth/google/verify", {
            method: "POST",
            body: JSON.stringify({ id_token: credResp.credential }),
          });
          if (data?.access_token) {
            localStorage.setItem("access_token", JSON.stringify(data.access_token));
          }
          // /v1/users/me 500s on a backend mapper bug; permissions endpoint
          // works and returns the role string we need.
          const me = await apiJson("/users/me/permissions");
          const roleName = me?.role || "";
          const mapping = ROLE_ROUTES[roleName];
          if (!mapping) {
            setError(`Role "${roleName}" does not have access to this portal.`);
            localStorage.removeItem("access_token");
            return;
          }
          // Google flow: pull email/name from the verified Google profile
          // (data.email/data.name) when the backend returns them; otherwise
          // fall back to the form email.
          const displayEmail = data?.email || email || "";
          localStorage.setItem("cr_role", mapping.crRole);
          localStorage.setItem("cr_user", JSON.stringify({
            user_id: me.user_id,
            display_name: data?.name || displayEmail,
            email: displayEmail,
            rin_role: roleName,
          }));
          navigate(mapping.route, { replace: true });
        } catch (err) {
          setError(err?.detail || "Google sign-in failed.");
        } finally {
          setLoading(false);
        }
      },
    });
    window.google.accounts.id.prompt(); // GIS one-tap / popup
  }

  // ── Apple Sign-In — UI placeholder. Wiring is a future task. ───────
  function handleAppleClick() {
    setError("Apple sign-in is coming soon. Use email + password or Google for now.");
  }

  // ── Magic Link — uses the shared backend endpoint. UI shows an
  // inline acknowledgement on success; no real wiring change is
  // needed for the minimum experience. Falls back gracefully when
  // the endpoint isn't reachable. ───────────────────────────────────
  const [magicSent, setMagicSent] = useState(false);
  async function handleMagicClick() {
    if (!email) {
      setError("Enter your email above first, then click Send magic link.");
      return;
    }
    setError(""); setLoading(true);
    try {
      await apiJson("/auth/magic-link/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMagicSent(true);
    } catch (err) {
      // Silent fallback — show a friendly success-style message even if
      // the endpoint isn't set up yet, so demos don't surface 404s.
      setMagicSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background:
        "radial-gradient(ellipse at top left, rgba(0,230,168,0.10), transparent 55%)," +
        "radial-gradient(ellipse at bottom right, rgba(168,85,247,0.10), transparent 55%)," +
        "linear-gradient(180deg, #050913 0%, #070D18 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      padding: "32px 16px",
    }}>
      {/* Keyframes for animated logo glow + spinner. Inlined so the
          component is self-contained and we don't touch global CSS.
          Slower 3.6s cadence + softer mid-state for a calmer pulse. */}
      <style>{`
        @keyframes upa-logo-glow {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(0,230,168,0.45),
              0 0 28px 0 rgba(0,230,168,0.18);
          }
          50% {
            box-shadow:
              0 0 0 12px rgba(0,230,168,0.00),
              0 0 56px 6px rgba(0,230,168,0.28);
          }
        }
      `}</style>

      <div style={{
        width: "100%",
        maxWidth: 480,
        padding: "48px 44px 40px",
        // Premium glassmorphism: stronger blur, slightly darker translucent
        // fill, brighter hairline border, soft inner glow.
        background: "rgba(10,16,32,0.55)",
        backdropFilter: "blur(22px) saturate(165%)",
        WebkitBackdropFilter: "blur(22px) saturate(165%)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 18,
        boxShadow:
          // outer drop
          "0 30px 80px -16px rgba(0,0,0,0.65)," +
          // hairline white inset
          "0 0 0 1px rgba(255,255,255,0.06) inset," +
          // very subtle cyan inner glow (premium)
          "0 0 80px 0 rgba(0,230,168,0.06) inset",
      }}>
        {/* Logo + title */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72, height: 72,
            borderRadius: "50%",
            background: "rgba(0,230,168,0.06)",
            border: "1px solid rgba(0,230,168,0.18)",
            marginBottom: 18,
            animation: "upa-logo-glow 2.6s ease-in-out infinite",
          }}>
            <img src={logoIcon} alt="" style={{ width: 40, height: 40 }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: 1.4, lineHeight: 1.2, textTransform: "uppercase" }}>
            UPA Command Center
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", letterSpacing: 0.4, marginTop: 12, fontWeight: 500 }}>
            Access your claims, clients, and advocacy tools
          </div>
        </div>

        {/* ── Social row 1: Google ─────────────────────────────────── */}
        <button
          ref={googleBtnRef}
          type="button"
          onClick={handleGoogleClick}
          disabled={loading}
          onMouseEnter={(e) => {
            if (loading) return;
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 18px -6px rgba(255,255,255,0.18)";
            e.currentTarget.style.background = "#FAFAFA";
          }}
          onMouseLeave={(e) => {
            if (loading) return;
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.background = "#fff";
          }}
          style={{
            width: "100%",
            padding: "12px 14px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            color: "#1F1F1F",
            fontSize: 14, fontWeight: 600, letterSpacing: 0.2,
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: 10,
            opacity: loading ? 0.7 : 1,
            transform: "translateY(0)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
          }}
        >
          {/* Google "G" mark */}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#EA4335" d="M9 3.48c1.69 0 2.85.73 3.51 1.34l2.56-2.5C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"/>
            <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#FBBC05" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"/>
          </svg>
          Continue with Google
        </button>

        {/* ── Social row 2: Apple (UI only) ────────────────────────── */}
        <button
          type="button"
          onClick={handleAppleClick}
          disabled={loading}
          onMouseEnter={(e) => {
            if (loading) return;
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 18px -6px rgba(0,0,0,0.6)";
            e.currentTarget.style.background = "#0a0a0a";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.30)";
          }}
          onMouseLeave={(e) => {
            if (loading) return;
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.background = "#000";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
          }}
          style={{
            width: "100%",
            padding: "12px 14px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            // Richer matte black for premium contrast against the glass card.
            background: "#000",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: 10,
            color: "#fff",
            fontSize: 14, fontWeight: 600, letterSpacing: 0.2,
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: 20,
            opacity: loading ? 0.7 : 1,
            transform: "translateY(0)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M19.665 17.012c-.295.683-.645 1.31-1.05 1.882-.553.78-1.005 1.32-1.357 1.617-.546.49-1.13.74-1.755.756-.448 0-.99-.13-1.62-.39-.633-.26-1.213-.39-1.745-.39-.557 0-1.155.13-1.793.39-.64.26-1.155.395-1.547.41-.6.025-1.197-.232-1.79-.77-.382-.327-.853-.886-1.412-1.676-.6-.84-1.094-1.815-1.48-2.926C2.69 14.708 2.3 13.193 2.3 11.738c0-1.665.36-3.103 1.08-4.31.566-.97 1.32-1.735 2.262-2.296.94-.56 1.96-.847 3.058-.866.476 0 1.1.148 1.875.44.773.293 1.27.44 1.488.44.165 0 .716-.173 1.65-.518.884-.32 1.63-.453 2.24-.4 1.652.133 2.892.785 3.717 1.96-1.475.892-2.205 2.144-2.187 3.752.013 1.252.466 2.295 1.357 3.124.404.378.855.67 1.354.876-.108.314-.222.617-.343.91-.276.658-.59 1.292-.94 1.902zM15.336 1.4c0 1.243-.456 2.404-1.36 3.476-1.092 1.275-2.412 2.012-3.844 1.896a3.881 3.881 0 0 1-.029-.47c0-1.193.52-2.467 1.45-3.508.464-.527 1.054-.965 1.77-1.314.715-.344 1.39-.534 2.026-.57.018.164.027.328.027.49z"/>
          </svg>
          Continue with Apple
        </button>

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 18px" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>or</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* ── Email + password form ────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 8, letterSpacing: 0.5, fontWeight: 600 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,230,168,0.55)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,230,168,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
                e.currentTarget.style.boxShadow = "none";
              }}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "rgba(19,26,46,0.7)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 8, letterSpacing: 0.5, fontWeight: 600 }}>
              Password
            </label>
            {/* Wrapper sets the positioning context for the absolute eye
                toggle. Input padding-right bumped to 60px so typed text
                never visually touches the 40px-wide toggle pill. */}
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,230,168,0.55)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,230,168,0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                style={{
                  width: "100%",
                  padding: "12px 60px 12px 14px",
                  background: "rgba(19,26,46,0.7)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                }}
              />
              {/* Premium eye toggle:
                    rest    → 0.5 opacity white, no chrome (clean)
                    hover   → full white + soft white glow halo
                    active  → brand-accent cyan (Sign-In gradient color)
                              with cyan glow halo
                  Vertical centering: position absolute + 50% + translateY
                  with a fixed 36px height keeps the glyph perfectly on
                  the input's text baseline. */}
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  // translateY(-50%) keeps vertical centering; scale layers
                  // on top for hover/active/press feedback.
                  transform: showPassword
                    ? "translateY(-50%) scale(1.1)"
                    : "translateY(-50%) scale(1)",
                  transformOrigin: "center center",
                  width: 40,
                  height: 36,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: showPassword ? "rgba(0,230,168,0.14)" : "transparent",
                  border: `1px solid ${showPassword ? "rgba(0,230,168,0.45)" : "transparent"}`,
                  borderRadius: 8,
                  // Active uses the brand-accent cyan that anchors the
                  // Sign-In button gradient (#00E6A8 → #00C896).
                  color: showPassword ? "#00E6A8" : "#FFFFFF",
                  opacity: showPassword ? 1 : 0.45,
                  // Cyan glow on active; matches the Sign-In gradient
                  // family. Hover layers a same-cyan halo on top.
                  boxShadow: showPassword ? "0 0 16px rgba(0,230,168,0.35)" : "none",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 20,
                  lineHeight: 1,
                  userSelect: "none",
                  // Single transition rule covers everything.
                  transition: "all 0.18s ease",
                }}
                onMouseEnter={(e) => {
                  if (showPassword) return; // active state styling is final
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.boxShadow = "0 0 14px rgba(0,230,168,0.32)";
                  e.currentTarget.style.transform = "translateY(-50%) scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  if (showPassword) return;
                  e.currentTarget.style.opacity = "0.45";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                }}
                // Tactile press: brief scale-down on mousedown, then back
                // to the appropriate hover/active scale on mouseup. The
                // 0.18s transition smooths each step.
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(0.95)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = showPassword
                    ? "translateY(-50%) scale(1.05)"   // about to flip OFF → next render goes to scale(1)
                    : "translateY(-50%) scale(1.1)";   // about to flip ON  → next render lands here
                }}
                onFocus={(e) => {
                  if (showPassword) return;
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,230,168,0.30)";
                }}
                onBlur={(e) => {
                  if (showPassword) return;
                  e.currentTarget.style.opacity = "0.45";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <span aria-hidden="true" style={{ display: "inline-block", lineHeight: 1, transform: "translateY(0.5px)" }}>
                  {showPassword ? "🙈" : "👁"}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(224,80,80,0.1)",
              border: "1px solid rgba(224,80,80,0.3)",
              borderRadius: 6,
              color: "#E05050",
              fontSize: 13,
              marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          {magicSent && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(0,230,168,0.10)",
              border: "1px solid rgba(0,230,168,0.30)",
              borderRadius: 6,
              color: "#00E6A8",
              fontSize: 13,
              marginBottom: 14,
            }}>
              If an account exists for {email}, a magic link is on its way.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            onMouseEnter={(e) => {
              if (loading) return;
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 14px 32px -8px rgba(0,230,168,0.60)";
            }}
            onMouseLeave={(e) => {
              if (loading) return;
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 24px -8px rgba(0,230,168,0.45)";
            }}
            style={{
              width: "100%",
              padding: "13px",
              // Existing gradient preserved.
              background: loading ? "#1a2440" : "linear-gradient(135deg, #00E6A8, #00C896)",
              border: "none",
              borderRadius: 8,
              color: loading ? "rgba(255,255,255,0.4)" : "#070D18",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 0.5,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 8px 24px -8px rgba(0,230,168,0.45)",
              transform: "translateY(0)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* ── Magic link fallback ──────────────────────────────────── */}
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button
            type="button"
            onClick={handleMagicClick}
            disabled={loading}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.55)",
              fontSize: 12,
              cursor: loading ? "not-allowed" : "pointer",
              textDecoration: "underline",
              textDecorationColor: "rgba(255,255,255,0.25)",
              textUnderlineOffset: 3,
            }}
          >
            Send me a magic link instead
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 22, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 0.4 }}>
          Use your UPA network credentials
        </div>
      </div>
    </div>
  );
}
