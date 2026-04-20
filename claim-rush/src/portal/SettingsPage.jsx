import { useState, Component } from "react";
import PasswordTab from "./settings/PasswordTab";
import NotificationsTab from "./settings/NotificationsTab";
import DisplayTab from "./settings/DisplayTab";
import TwoFactorTab from "./settings/TwoFactorTab";

const TABS = [
  { id: "password", label: "Password", icon: "\u{1F512}" },
  { id: "notifications", label: "Notifications", icon: "\u{1F514}" },
  { id: "display", label: "Display", icon: "\u{1F3A8}" },
  { id: "2fa", label: "Two-Factor Auth", icon: "\u{1F6E1}\uFE0F" },
];

class TabErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error: error.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, background: "#111827", borderRadius: 12, border: "1px solid rgba(239,68,68,0.2)" }}>
          <div style={{ color: "#EF4444", fontSize: 14, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>This tab encountered an error</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6, fontFamily: "'Courier New', monospace" }}>{this.state.error}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SettingsPage() {
  const [active, setActive] = useState("password");

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 24, fontFamily: "'Inter', sans-serif" }}>Settings</h1>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 16px",
              background: "transparent", border: "none",
              borderBottom: active === tab.id ? "2px solid #00E6A8" : "2px solid transparent",
              color: active === tab.id ? "#fff" : "rgba(255,255,255,0.4)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              transition: "all 0.15s",
              marginBottom: -1,
            }}
          >
            <span style={{ fontSize: 15 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — each wrapped in error boundary */}
      <TabErrorBoundary key={active}>
        {active === "password" && <PasswordTab />}
        {active === "notifications" && <NotificationsTab />}
        {active === "display" && <DisplayTab />}
        {active === "2fa" && <TwoFactorTab />}
      </TabErrorBoundary>
    </div>
  );
}
