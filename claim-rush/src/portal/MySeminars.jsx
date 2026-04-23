import { useState, useEffect } from "react";
import { apiFetch as rawApiFetch } from "../lib/api";

/**
 * Phase 17c — My Seminars page.
 * Request seminars, view upcoming/past, see registrations.
 */

const NAVY = "#0A1628";
const GOLD = "#C9A84C";
const GREEN = "#00E6A8";
const mono = { fontFamily: "'Courier New', monospace" };

const TYPES = [
  { value: "storm_response", label: "Storm Response" },
  { value: "educational", label: "Educational" },
  { value: "seasonal", label: "Seasonal Preparedness" },
  { value: "custom", label: "Custom" },
];

// Delegates to the shared apiFetch so requests reach VITE_API_URL with
// the bearer token attached, instead of the Vercel origin.
function apiFetch(path) {
  return rawApiFetch(`/seminars${path}`).then(r => r.ok ? r.json() : []);
}

function apiPost(path, body) {
  return rawApiFetch(`/seminars${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then(r => r.json());
}

export default function MySeminars() {
  const [seminars, setSeminars] = useState([]);
  const [decks, setDecks] = useState([]);
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [selectedSeminar, setSelectedSeminar] = useState(null);
  const [registrations, setRegistrations] = useState([]);

  // Request form
  const [title, setTitle] = useState("");
  const [type, setType] = useState("educational");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [description, setDescription] = useState("");
  const [deckId, setDeckId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    Promise.all([
      apiFetch(""),
      apiFetch("/deck-templates"),
      apiFetch("/certification/me"),
    ]).then(([s, d, c]) => {
      setSeminars(Array.isArray(s) ? s : []);
      setDecks(Array.isArray(d) ? d : []);
      setCert(c);
      setLoading(false);
    });
  }

  function submitRequest() {
    if (!title || submitting) return;
    setSubmitting(true);
    apiPost("/request", {
      title, type, scheduled_at: scheduledAt || null,
      duration_minutes: duration, description: description || null,
      deck_template_id: deckId || null,
    }).then(() => {
      setShowRequest(false);
      setTitle(""); setDescription("");
      setSubmitting(false);
      load();
    });
  }

  function viewRegistrations(sem) {
    setSelectedSeminar(sem);
    apiFetch(`/${sem.id}/registrations`).then(r => setRegistrations(Array.isArray(r) ? r : []));
  }

  const isCertified = cert?.status === "active";
  const statusColors = { requested: "#2A70D0", approved: GREEN, scheduled: GREEN, live: "#E05050", completed: "rgba(255,255,255,0.4)", cancelled: "rgba(255,255,255,0.2)" };

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", padding: 40, ...mono }}>Loading seminars...</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ ...mono, fontSize: 22, color: "#fff", fontWeight: 700, margin: 0 }}>My Seminars</h1>
          <p style={{ ...mono, fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>Request, manage, and track your seminar events.</p>
        </div>
        <button onClick={() => setShowRequest(true)} disabled={!isCertified} style={{
          padding: "10px 24px", background: isCertified ? GREEN : "rgba(255,255,255,0.1)",
          border: "none", borderRadius: 4, color: isCertified ? NAVY : "rgba(255,255,255,0.3)",
          fontSize: 13, fontWeight: 700, cursor: isCertified ? "pointer" : "not-allowed", ...mono,
        }}>
          {isCertified ? "Request New Seminar" : "Certification Required"}
        </button>
      </div>

      {/* Seminar list */}
      {seminars.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)", ...mono }}>
          No seminars yet. {isCertified ? "Request your first seminar above." : "Complete training to get certified first."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {seminars.map(sem => (
          <div key={sem.id} onClick={() => viewRegistrations(sem)} style={{
            padding: "16px 20px", background: "#131A2E", border: "1px solid #1F2742",
            borderRadius: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ ...mono, fontSize: 14, fontWeight: 600, color: "#fff" }}>{sem.title}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                {sem.type} · {sem.scheduled_at ? new Date(sem.scheduled_at).toLocaleDateString() : "TBD"} · {sem.duration_minutes}min
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {sem.teams_join_url && <a href={sem.teams_join_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: "#2A70D0", ...mono }}>Join Teams</a>}
              <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: `${statusColors[sem.status] || "#555"}20`, color: statusColors[sem.status] || "#555" }}>
                {sem.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Registration detail */}
      {selectedSeminar && (
        <div style={{ marginTop: 20, padding: 20, background: "#131A2E", border: "1px solid #1F2742", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ ...mono, fontSize: 16, color: "#fff", margin: 0 }}>Registrations — {selectedSeminar.title}</h3>
            <button onClick={() => setSelectedSeminar(null)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", ...mono }}>Close</button>
          </div>
          {registrations.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.4)", ...mono, fontSize: 13 }}>No registrations yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>
                <th style={{ textAlign: "left", padding: "8px 0", color: "rgba(255,255,255,0.5)", borderBottom: "1px solid #1F2742" }}>Name</th>
                <th style={{ textAlign: "left", padding: "8px 0", color: "rgba(255,255,255,0.5)", borderBottom: "1px solid #1F2742" }}>Email</th>
                <th style={{ textAlign: "left", padding: "8px 0", color: "rgba(255,255,255,0.5)", borderBottom: "1px solid #1F2742" }}>Phone</th>
                <th style={{ textAlign: "left", padding: "8px 0", color: "rgba(255,255,255,0.5)", borderBottom: "1px solid #1F2742" }}>Attended</th>
              </tr></thead>
              <tbody>{registrations.map(r => (
                <tr key={r.id}><td style={{ padding: "6px 0", color: "#fff" }}>{r.name}</td><td style={{ color: "rgba(255,255,255,0.6)" }}>{r.email}</td><td style={{ color: "rgba(255,255,255,0.6)" }}>{r.phone || "—"}</td><td>{r.attended ? "✅" : "—"}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {/* Request seminar modal */}
      {showRequest && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#131A2E", border: "1px solid #1F2742", borderRadius: 10, padding: 28, width: 500 }}>
            <h3 style={{ ...mono, fontSize: 16, color: "#fff", marginBottom: 16 }}>Request a Seminar</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Seminar Title" style={{ padding: "10px 14px", background: "#0A1628", border: "1px solid #1F2742", borderRadius: 4, color: "#fff", fontSize: 14 }} />
              <select value={type} onChange={e => setType(e.target.value)} style={{ padding: "10px 14px", background: "#0A1628", border: "1px solid #1F2742", borderRadius: 4, color: "#fff", fontSize: 14 }}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={{ padding: "10px 14px", background: "#0A1628", border: "1px solid #1F2742", borderRadius: 4, color: "#fff", fontSize: 14 }} />
              <select value={deckId} onChange={e => setDeckId(e.target.value)} style={{ padding: "10px 14px", background: "#0A1628", border: "1px solid #1F2742", borderRadius: 4, color: "#fff", fontSize: 14 }}>
                <option value="">Select deck template...</option>
                {decks.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} style={{ padding: "10px 14px", background: "#0A1628", border: "1px solid #1F2742", borderRadius: 4, color: "#fff", fontSize: 14, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowRequest(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, color: "#fff", cursor: "pointer", ...mono }}>Cancel</button>
              <button onClick={submitRequest} disabled={!title || submitting} style={{ padding: "8px 20px", background: GREEN, border: "none", borderRadius: 4, color: NAVY, fontWeight: 700, cursor: "pointer", ...mono, opacity: !title ? 0.4 : 1 }}>
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
