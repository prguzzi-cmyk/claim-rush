import { useState, useEffect } from "react";
import { C } from "./theme";
import { apiJson, apiFetch } from "../lib/api";

function Field({ label, value, onChange, disabled, type = "text" }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6, fontFamily: "'Inter', sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%", padding: "11px 14px", boxSizing: "border-box",
          background: disabled ? "#0A0F1A" : "#0D1526",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8, color: disabled ? "rgba(255,255,255,0.35)" : "#fff",
          fontSize: 14, fontFamily: "'Inter', sans-serif",
          outline: "none", cursor: disabled ? "not-allowed" : "text",
          transition: "border-color 0.2s",
        }}
        onFocus={e => { if (!disabled) e.target.style.borderColor = "#00E6A8"; }}
        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
      />
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6, fontFamily: "'Inter', sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </label>
      <div style={{
        padding: "11px 14px", background: "#0A0F1A",
        border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8,
        color: "rgba(255,255,255,0.5)", fontSize: 14, fontFamily: "'Inter', sans-serif",
      }}>
        {value || "—"}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiJson("/users/me").then(u => {
      setUser(u);
      setFirstName(u.first_name || "");
      setLastName(u.last_name || "");
      setPhone(u.phone || "");
      setLoading(false);
    }).catch(e => {
      setError(e.detail || "Failed to load profile");
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await apiFetch("/users/me", {
        method: "PUT",
        body: JSON.stringify({ first_name: firstName, last_name: lastName, phone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Failed to save");
      } else {
        const updated = await res.json();
        setUser(updated);
        setSaved(true);
        // Update localStorage display name
        try {
          const crUser = JSON.parse(localStorage.getItem("cr_user") || "{}");
          crUser.display_name = `${firstName} ${lastName}`.trim();
          localStorage.setItem("cr_user", JSON.stringify(crUser));
        } catch {}
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 40, color: "rgba(255,255,255,0.5)", fontFamily: "'Inter', sans-serif" }}>Loading profile...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 24, fontFamily: "'Inter', sans-serif" }}>Profile</h1>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 16, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
          {error}
        </div>
      )}
      {saved && (
        <div style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 16, background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.2)", color: "#00E6A8", fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          Profile saved successfully.
        </div>
      )}

      {/* Editable fields */}
      <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 28, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>Personal Information</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <Field label="First Name" value={firstName} onChange={setFirstName} />
          <Field label="Last Name" value={lastName} onChange={setLastName} />
        </div>
        <Field label="Phone" value={phone} onChange={setPhone} type="tel" />

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "10px 24px", borderRadius: 8,
            background: saving ? "rgba(0,230,168,0.3)" : "#00E6A8",
            color: "#000", fontSize: 13, fontWeight: 700, border: "none",
            cursor: saving ? "wait" : "pointer", fontFamily: "'Inter', sans-serif",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {saving && <span style={{ width: 12, height: 12, border: "2px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Read-only fields */}
      <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 28 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>Account Details</h3>
        <ReadOnlyField label="Email" value={user?.email} />
        <ReadOnlyField label="Role" value={user?.role?.display_name || user?.role?.name} />
        <ReadOnlyField label="Status" value={user?.is_active ? "Active" : "Inactive"} />
        <ReadOnlyField label="Member Since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"} />
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 8, fontFamily: "'Inter', sans-serif" }}>
          To change your email, go to Settings → Password. To update your role or territory, contact your administrator.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
