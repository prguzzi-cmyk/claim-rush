import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, fetchCurrentUser } from "../lib/api";
import logoIcon from "../assets/logo/claimrush-icon.svg";

// Map RIN role → ClaimRush internal role + landing route
const ROLE_ROUTES = {
  cp:                 { crRole: "CP",          route: "/portal" },
  manager:            { crRole: "CP",          route: "/portal" },
  rvp:                { crRole: "RVP",         route: "/portal" },
  agent:              { crRole: "agent",       route: "/portal" },
  "call-center-agent":{ crRole: "agent",       route: "/portal" },
  "sales-rep":        { crRole: "agent",       route: "/portal" },
  agency:             { crRole: "home_office", route: "/portal" },
  admin:              { crRole: "home_office", route: "/portal" },
  "super-admin":      { crRole: "home_office", route: "/portal" },
};

const FIELD_ROLES = new Set(["cp", "manager", "rvp", "agent", "call-center-agent", "sales-rep", "agency"]);

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      const user = await fetchCurrentUser();
      const roleName = user?.role?.name || "";
      const mapping = ROLE_ROUTES[roleName];

      if (!mapping) {
        setError(`Role "${roleName}" does not have access to this portal. The UPA network portal is for field roles (CP, RVP, Agency, Agent).`);
        localStorage.removeItem("access_token");
        setLoading(false);
        return;
      }

      // Store user context for AxisContext to pick up
      localStorage.setItem("cr_role", mapping.crRole);
      localStorage.setItem("cr_user", JSON.stringify({
        user_id: user.id,
        display_name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
        email: user.email,
        rin_role: roleName,
      }));

      navigate(mapping.route, { replace: true });
    } catch (err) {
      setError(err?.detail || "Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070D18",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      <div style={{
        width: 400,
        padding: 40,
        background: "#0A1020",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src={logoIcon} alt="" style={{ width: 48, height: 48, marginBottom: 14 }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: 1.2, lineHeight: 1.25, textTransform: "uppercase" }}>
            Unified Public Advocacy<br />Portal
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, marginTop: 10, fontWeight: 500 }}>
            Access your claims, clients, and advocacy tools
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: 0.5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "#131A2E",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: 0.5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "#131A2E",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(224,80,80,0.1)",
              border: "1px solid rgba(224,80,80,0.3)",
              borderRadius: 6,
              color: "#E05050",
              fontSize: 13,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "#1a2440" : "linear-gradient(135deg, #00E6A8, #00C896)",
              border: "none",
              borderRadius: 6,
              color: loading ? "rgba(255,255,255,0.4)" : "#070D18",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          Use your UPA network credentials
        </div>
      </div>
    </div>
  );
}
