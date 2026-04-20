import { C } from "./theme";

export default function SettingsPage() {
  return (
    <div style={{ padding: "32px 24px", maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 24 }}>Settings</h1>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
        {[
          ["Notifications", "Email and SMS notification preferences"],
          ["Display", "Theme and dashboard layout options"],
          ["Password", "Change your login password"],
          ["Two-Factor Auth", "Enable passkey or authenticator app"],
        ].map(([title, desc]) => (
          <div key={title} style={{
            padding: "16px 0",
            borderBottom: `1px solid ${C.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 14, color: "#fff", fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{desc}</div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1,
              padding: "4px 10px", borderRadius: 12,
              background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", color: "#A855F7",
            }}>SOON</span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        Settings features are rolling out soon. For urgent changes, contact your administrator.
      </p>
    </div>
  );
}
