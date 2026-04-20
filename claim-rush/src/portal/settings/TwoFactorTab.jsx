import { C } from "../theme";

export default function TwoFactorTab() {
  return (
    <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>Two-Factor Authentication</h2>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 24, fontFamily: "'Inter', sans-serif" }}>
        Add an extra layer of security to your account.
      </p>

      <div style={{
        padding: 24, borderRadius: 10,
        background: "#0D1526", border: "1px solid rgba(255,255,255,0.06)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{"\u{1F6E1}\uFE0F"}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>
          TOTP Authenticator
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20, maxWidth: 360, margin: "0 auto 20px", fontFamily: "'Inter', sans-serif" }}>
          Use an authenticator app like Google Authenticator or Authy to generate one-time codes when you sign in.
        </div>
        <div style={{
          display: "inline-block",
          padding: "8px 20px", borderRadius: 8,
          background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
          fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#A855F7",
          fontFamily: "'Inter', sans-serif",
        }}>
          COMING SOON
        </div>
      </div>

      <div style={{ marginTop: 20, padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "'Inter', sans-serif" }}>Passkey (WebAuthn)</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2, fontFamily: "'Inter', sans-serif" }}>
              Sign in with fingerprint, face, or security key
            </div>
          </div>
          <div style={{
            padding: "6px 14px", borderRadius: 8,
            background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
            fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#A855F7",
            fontFamily: "'Inter', sans-serif",
          }}>
            COMING SOON
          </div>
        </div>
      </div>
    </div>
  );
}
