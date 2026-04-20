import { useState, useEffect } from "react";

const THEMES = [
  { id: "dark", label: "Dark", desc: "Default dark interface", icon: "\u{1F31A}" },
  { id: "light", label: "Light", desc: "Light interface (coming soon)", icon: "\u2600\uFE0F", disabled: true },
  { id: "auto", label: "System", desc: "Follow OS preference (coming soon)", icon: "\u{1F4BB}", disabled: true },
];

const LAYOUTS = [
  { id: "compact", label: "Compact", desc: "Denser information layout", disabled: true },
  { id: "comfortable", label: "Comfortable", desc: "Balanced spacing (default)" },
  { id: "spacious", label: "Spacious", desc: "More breathing room", disabled: true },
];

export default function DisplayTab() {
  const [theme, setTheme] = useState(() => localStorage.getItem("cr_theme") || "dark");
  const [layout, setLayout] = useState(() => localStorage.getItem("cr_layout") || "comfortable");
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem("cr_theme", theme);
    localStorage.setItem("cr_layout", layout);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>Display Settings</h2>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 24, fontFamily: "'Inter', sans-serif" }}>
        Customize the look and feel of your portal.
      </p>

      {/* Theme */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>Theme</div>
        <div style={{ display: "flex", gap: 10 }}>
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => !t.disabled && setTheme(t.id)}
              disabled={t.disabled}
              style={{
                flex: 1, padding: "14px 12px", borderRadius: 8, textAlign: "center",
                background: theme === t.id ? "rgba(0,230,168,0.08)" : "#0D1526",
                border: theme === t.id ? "1px solid rgba(0,230,168,0.3)" : "1px solid rgba(255,255,255,0.08)",
                color: t.disabled ? "rgba(255,255,255,0.25)" : "#fff",
                cursor: t.disabled ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>Dashboard Layout</div>
        <div style={{ display: "flex", gap: 10 }}>
          {LAYOUTS.map(l => (
            <button
              key={l.id}
              onClick={() => !l.disabled && setLayout(l.id)}
              disabled={l.disabled}
              style={{
                flex: 1, padding: "14px 12px", borderRadius: 8, textAlign: "center",
                background: layout === l.id ? "rgba(0,230,168,0.08)" : "#0D1526",
                border: layout === l.id ? "1px solid rgba(0,230,168,0.3)" : "1px solid rgba(255,255,255,0.08)",
                color: l.disabled ? "rgba(255,255,255,0.25)" : "#fff",
                cursor: l.disabled ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{l.label}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{l.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} style={{
          padding: "10px 24px", borderRadius: 8,
          background: "#00E6A8", color: "#000", fontSize: 13, fontWeight: 700,
          border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif",
        }}>
          Save Display Settings
        </button>
        {saved && <span style={{ fontSize: 13, color: "#00E6A8", fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>Saved</span>}
      </div>
    </div>
  );
}
