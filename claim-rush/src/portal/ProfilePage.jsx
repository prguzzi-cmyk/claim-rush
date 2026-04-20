import { useState, useEffect } from "react";
import { C } from "./theme";
import { apiJson } from "../lib/api";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiJson("/users/me").then(setUser).catch(e => setError(e.detail || "Failed to load profile"));
  }, []);

  if (error) return <div style={{ padding: 40, color: "#f66" }}>{error}</div>;
  if (!user) return <div style={{ padding: 40, color: "rgba(255,255,255,0.5)" }}>Loading...</div>;

  return (
    <div style={{ padding: "32px 24px", maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 24 }}>My Profile</h1>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
        {[
          ["Name", `${user.first_name || ""} ${user.last_name || ""}`.trim() || "—"],
          ["Email", user.email || "—"],
          ["Role", user.role?.display_name || user.role?.name || "—"],
          ["Status", user.is_active ? "Active" : "Inactive"],
          ["Member since", user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 14, color: "#fff", fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        To update your profile or change your password, contact your administrator.
      </p>
    </div>
  );
}
