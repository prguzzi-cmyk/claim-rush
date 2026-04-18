import { useState, useEffect } from "react";

/**
 * Phase 17e — Storm Alerts for CP/RVP/Agent.
 * Shows active storm triggers in their territory with one-click seminar scheduling.
 */

const GOLD = "#C9A84C";
const GREEN = "#00E6A8";
const RED = "#E05050";
const mono = { fontFamily: "'Courier New', monospace" };

const EVENT_ICONS = { tornado: "🌪️", hail: "🧊", hurricane: "🌀", flooding: "💧", fire: "🔥", wind: "💨" };
const SEVERITY_COLORS = { extreme: RED, severe: RED, high: "#E08050", moderate: GOLD, low: "rgba(255,255,255,0.4)" };

function getToken() {
  const raw = localStorage.getItem("access_token");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export default function StormAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(null);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    const token = getToken();
    fetch("/v1/seminars/storm-triggers/alerts/me", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setAlerts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  function scheduleSeminar(triggerId) {
    setScheduling(triggerId);
    const token = getToken();
    fetch(`/v1/seminars/storm-triggers/${triggerId}/schedule-seminar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(() => { setScheduling(null); load(); })
      .catch(() => setScheduling(null));
  }

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", padding: 40, ...mono }}>Checking storm alerts...</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ ...mono, fontSize: 22, color: "#fff", fontWeight: 700, marginBottom: 6 }}>Storm Alerts</h1>
      <p style={{ ...mono, fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>Severe weather events in your territory. Schedule a seminar to capture affected homeowner leads.</p>

      {alerts.length === 0 && (
        <div style={{ padding: "40px 20px", textAlign: "center", background: "#131A2E", border: "1px solid #1F2742", borderRadius: 8 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>☀️</div>
          <div style={{ ...mono, fontSize: 15, color: "rgba(255,255,255,0.5)" }}>No active storm alerts in your territory.</div>
          <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>Alerts appear when severe weather is detected in your assigned states.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {alerts.map(alert => {
          const meta = alert.metadata_json ? JSON.parse(alert.metadata_json) : {};
          const icon = EVENT_ICONS[alert.event_type] || "⛈️";
          const sevColor = SEVERITY_COLORS[alert.severity] || GOLD;
          const counties = (alert.affected_counties || []).join(", ");
          const states = (alert.affected_states || []).join(", ");
          const age = Math.round((Date.now() - new Date(alert.triggered_at).getTime()) / 3600000);

          return (
            <div key={alert.id} style={{
              padding: "18px 20px", background: "#131A2E",
              border: `1px solid ${sevColor}30`, borderLeft: `4px solid ${sevColor}`,
              borderRadius: 8,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span style={{ ...mono, fontSize: 15, fontWeight: 700, color: "#fff" }}>
                      {alert.event_type.charAt(0).toUpperCase() + alert.event_type.slice(1)} — {states}
                    </span>
                    <span style={{
                      padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                      background: `${sevColor}20`, color: sevColor,
                    }}>
                      {alert.severity?.toUpperCase()}
                    </span>
                  </div>
                  {counties && <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Counties: {counties}</div>}
                  <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Detected {age}h ago · {meta.total_events || "?"} events tracked</div>
                </div>
                <button
                  onClick={() => scheduleSeminar(alert.id)}
                  disabled={scheduling === alert.id || alert.alert_sent}
                  style={{
                    padding: "8px 16px", background: alert.alert_sent ? "rgba(255,255,255,0.05)" : `${GREEN}15`,
                    border: `1px solid ${alert.alert_sent ? "rgba(255,255,255,0.1)" : GREEN + "40"}`,
                    borderRadius: 4, color: alert.alert_sent ? "rgba(255,255,255,0.3)" : GREEN,
                    fontSize: 12, fontWeight: 700, cursor: alert.alert_sent ? "default" : "pointer", ...mono,
                    flexShrink: 0,
                  }}
                >
                  {alert.alert_sent ? "Seminar Requested" : scheduling === alert.id ? "Scheduling..." : "Schedule Seminar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
