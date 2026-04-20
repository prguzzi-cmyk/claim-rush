import { useState, useEffect } from "react";
import { apiFetch, apiJson } from "../../lib/api";

function Toggle({ label, desc, checked, onChange }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div>
        <div style={{ fontSize: 14, color: "#fff", fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>{label}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2, fontFamily: "'Inter', sans-serif" }}>{desc}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        style={{
          width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
          background: checked ? "#00E6A8" : "rgba(255,255,255,0.15)",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3,
          left: checked ? 23 : 3,
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </button>
    </div>
  );
}

export default function NotificationsTab() {
  const [prefs, setPrefs] = useState({ email: true, sms: false, in_app: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiJson("/users/me").then(u => {
      if (u.notification_preferences) {
        try {
          const p = typeof u.notification_preferences === "string" ? JSON.parse(u.notification_preferences) : u.notification_preferences;
          setPrefs({ email: p.email ?? true, sms: p.sms ?? false, in_app: p.in_app ?? true });
        } catch {}
      }
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch("/users/me", {
        method: "PUT",
        body: JSON.stringify({ notification_preferences: prefs }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  }

  return (
    <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>Notification Preferences</h2>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>
        Control how you receive updates about your claims and account activity.
      </p>

      <Toggle label="Email Notifications" desc="Claim updates, status changes, and weekly digests" checked={prefs.email} onChange={v => setPrefs(p => ({ ...p, email: v }))} />
      <Toggle label="SMS Notifications" desc="Urgent alerts and time-sensitive updates" checked={prefs.sms} onChange={v => setPrefs(p => ({ ...p, sms: v }))} />
      <Toggle label="In-App Alerts" desc="Real-time notifications inside the portal" checked={prefs.in_app} onChange={v => setPrefs(p => ({ ...p, in_app: v }))} />

      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving} style={{
          padding: "10px 24px", borderRadius: 8,
          background: saving ? "rgba(0,230,168,0.3)" : "#00E6A8",
          color: "#000", fontSize: 13, fontWeight: 700, border: "none",
          cursor: saving ? "wait" : "pointer", fontFamily: "'Inter', sans-serif",
        }}>
          {saving ? "Saving..." : "Save Preferences"}
        </button>
        {saved && <span style={{ fontSize: 13, color: "#00E6A8", fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>Saved</span>}
      </div>
    </div>
  );
}
