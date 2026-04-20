import { useState } from "react";
import { apiFetch } from "../../lib/api";

const EyeOpen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosed = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function PasswordField({ label, value, onChange, error, show, onToggle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: "100%", padding: "12px 44px 12px 14px",
            background: "#0D1526", border: error ? "1px solid #EF4444" : "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "#fff", fontSize: 14,
            fontFamily: "'Inter', sans-serif",
            outline: "none", transition: "border-color 0.2s",
            boxSizing: "border-box",
          }}
          onFocus={e => { if (!error) e.target.style.borderColor = "#00E6A8"; }}
          onBlur={e => { if (!error) e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "transparent", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.35)", display: "flex", padding: 4,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
        >
          {show ? <EyeOpen /> : <EyeClosed />}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 4, fontFamily: "'Inter', sans-serif" }}>{error}</div>}
    </div>
  );
}

export default function PasswordTab() {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function validate() {
    const e = {};
    if (!current) e.current = "Current password is required";
    if (!newPw) e.newPw = "New password is required";
    else if (newPw.length < 8) e.newPw = "Minimum 8 characters";
    else if (!/\d/.test(newPw)) e.newPw = "Must include at least one number";
    if (!confirm) e.confirm = "Please confirm your new password";
    else if (newPw !== confirm) e.confirm = "Passwords do not match";
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setSuccess(false);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      const res = await apiFetch("/users/me/password", {
        method: "PUT",
        body: JSON.stringify({ current_password: current, new_password: newPw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 || res.status === 403) {
          setErrors({ current: data.detail || "Current password is incorrect" });
        } else {
          setErrors({ current: data.detail || "Failed to change password" });
        }
        return;
      }
      setSuccess(true);
      setCurrent(""); setNewPw(""); setConfirm("");
      setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    } catch (err) {
      setErrors({ current: "Network error — try again" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>Change Password</h2>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 24, fontFamily: "'Inter', sans-serif" }}>
        Update your password. You'll stay logged in after changing it.
      </p>

      {success && (
        <div style={{
          padding: "12px 16px", borderRadius: 8, marginBottom: 20,
          background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.2)",
          color: "#00E6A8", fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif",
        }}>
          Password changed successfully.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <PasswordField label="Current Password" value={current} onChange={setCurrent} error={errors.current} show={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} />
        <PasswordField label="New Password" value={newPw} onChange={setNewPw} error={errors.newPw} show={showNew} onToggle={() => setShowNew(!showNew)} />
        <PasswordField label="Confirm New Password" value={confirm} onChange={setConfirm} error={errors.confirm} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 28px", borderRadius: 8,
            background: loading ? "rgba(0,230,168,0.3)" : "#00E6A8",
            color: "#000", fontSize: 14, fontWeight: 700,
            border: "none", cursor: loading ? "wait" : "pointer",
            fontFamily: "'Inter', sans-serif",
            transition: "background 0.2s",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {loading && <span style={{ width: 14, height: 14, border: "2px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />}
          {loading ? "Changing..." : "Change Password"}
        </button>
      </form>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
