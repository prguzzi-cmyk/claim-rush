import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "./theme";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Parse user info
  let displayName = "", email = "", initials = "?";
  try {
    const u = JSON.parse(localStorage.getItem("cr_user") || "{}");
    displayName = u.display_name || u.email || "";
    email = u.email || "";
    const parts = displayName.split(" ");
    initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : displayName.slice(0, 2).toUpperCase();
  } catch {}

  // Close on click outside
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handler(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("cr_role");
    localStorage.removeItem("cr_user");
    localStorage.removeItem("rin-readonly-mode");
    navigate("/login", { replace: true });
  }

  const items = [
    { label: "Profile", icon: "\u{1F464}", action: () => { navigate("/portal/profile"); setOpen(false); } },
    { label: "Settings", icon: "\u2699\uFE0F", action: () => { navigate("/portal/settings"); setOpen(false); } },
    { sep: true },
    { label: "Log out", icon: "\u{1F6AA}", action: handleLogout, danger: true },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="User menu"
        style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "transparent", border: "none", cursor: "pointer",
          padding: "6px 10px", borderRadius: 8,
          transition: "background 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
        onMouseLeave={e => !open && (e.currentTarget.style.background = "transparent")}
      >
        {/* Avatar circle with initials */}
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, #00E6A8 0%, #0A9B70 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: 0.5,
          fontFamily: "'Inter', sans-serif",
        }}>
          {initials}
        </div>
        <div style={{ textAlign: "left", lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'Inter', sans-serif" }}>
            {displayName || "Account"}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Courier New', monospace" }}>
            {localStorage.getItem("cr_role")?.toUpperCase() || ""}
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 2, opacity: 0.4, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#111827", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "6px 0", minWidth: 200,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          zIndex: 100, animation: "fadeIn 0.15s ease",
        }}>
          {/* Email header */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'Courier New', monospace" }}>{email}</div>
          </div>
          {items.map((item, i) =>
            item.sep ? (
              <div key={i} style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
            ) : (
              <button
                key={i}
                onClick={item.action}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 14px",
                  background: "transparent", border: "none",
                  color: item.danger ? "#EF4444" : "rgba(255,255,255,0.8)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  transition: "background 0.1s", textAlign: "left",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
