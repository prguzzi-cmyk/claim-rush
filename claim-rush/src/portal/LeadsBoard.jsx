import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { C } from "./theme";

/**
 * Fire Leads — CP's downline lead board.
 *
 * Real data from GET /v1/dashboard/cp-leads (one entry per lead assigned
 * to any agent in the CP's downline). Filter chips by peril, status chips
 * per row, clean click-back to the Command Center.
 */

const mono = { fontFamily: "'Courier New', monospace" };

// Initial state for the New Lead form. Listing here keeps useState reads
// stable and lets handleCreateLead reset to the same shape on success.
const NEW_LEAD_INITIAL = {
  full_name: "",
  phone_number: "",
  email: "",
  address_loss: "",
  state_loss: "",
  peril: "",
  insurance_company: "",
  instructions_or_notes: "",
};

// Peril display — icon + label + accent colour. Any peril not in the list
// falls through to OTHER.
const PERIL_META = {
  fire:   { label: "Fire",   icon: "🔥", color: "#E05050" },
  storm:  { label: "Storm",  icon: "⛈️", color: "#3B82F6" },
  flood:  { label: "Flood",  icon: "💧", color: "#3B82F6" },
  hail:   { label: "Hail",   icon: "🧊", color: "#7DD3FC" },
  wind:   { label: "Wind",   icon: "💨", color: "#86EFAC" },
  theft:  { label: "Theft",  icon: "🔒", color: "#A855F7" },
  other:  { label: "Other",  icon: "📋", color: "rgba(255,255,255,0.55)" },
};

// Status pill colouring — lowercase-kebab slugs that match LeadStatusEnum.
const STATUS_META = {
  "signed-approved": { label: "CLOSED · APPROVED",  color: "#00E6A8" },
  "signed":          { label: "SIGNED",             color: "#00E6A8" },
  "pending-sign":    { label: "PENDING SIGN",       color: C.gold },
  "interested":      { label: "INTERESTED",         color: C.gold },
  "callback":        { label: "CALLBACK",           color: "#3B82F6" },
  "transfer":        { label: "TRANSFERRED",        color: "#A855F7" },
  "not-qualified":   { label: "NOT QUALIFIED",      color: "rgba(255,255,255,0.45)" },
  "not-interested":  { label: "NOT INTERESTED",     color: "rgba(255,255,255,0.45)" },
};
function statusPill(status) {
  const meta = STATUS_META[status] || { label: (status || "NEW").toUpperCase(), color: C.muted };
  return meta;
}
function perilMeta(p) {
  return PERIL_META[p] || PERIL_META.other;
}

// PulsePoint dispatches every emergency call type — Medical Emergency, Traffic
// Collision, Fire Alarm, EMS, etc. The lead board is for fire incidents only,
// so we filter against an explicit whitelist of call_type_description values
// before mapping. Add more fire-type descriptors here if needed.
const FIRE_TYPES = new Set([
  "Structure Fire", "Fire", "Working Fire", "Building Fire",
  "Outside Fire", "Grass Fire", "Brush Fire", "Vehicle Fire",
  "Commercial Fire", "Residential Fire",
]);
const isFireIncident = (inc) => FIRE_TYPES.has(inc?.call_type_description);

// Normalize a /v1/fire-incidents row into the same shape LeadRow renders.
// Tags type:"incident" so callers can distinguish from converted lead rows.
function mapIncidentToBoardRow(inc) {
  const receivedAt = inc.received_at || inc.created_at || null;
  const days_open = receivedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(receivedAt).getTime()) / 86400000))
    : 0;
  return {
    id: inc.id,
    type: "incident",
    ref_number: "INC-" + String(inc.id || "").slice(0, 4).toUpperCase(),
    peril: "fire",
    status: "incident",
    created_at: receivedAt,
    loss_date: receivedAt,
    days_open,
    agent_id: null,
    agent_name: inc.agency?.name || "Unassigned",
    is_unassigned: !inc.lead_id,
    insurance_company: null,
    policy_number: null,
    claim_number: null,
  };
}

export default function LeadsBoard() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  // Selected lead for the in-place detail panel. Click on a row sets it;
  // panel close clears it. No navigation away from /portal/fire-leads.
  const [selectedLead, setSelectedLead] = useState(null);

  // Manual lead creation (CP/RVP/admin). Modal state + form state. Talks
  // to the existing POST /v1/leads endpoint — no schema or backend change.
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState(NEW_LEAD_INITIAL);
  const [newLeadCreating, setNewLeadCreating] = useState(false);
  const [newLeadError, setNewLeadError] = useState(null);

  // Centralised close so Cancel / × / backdrop / success-path all leave
  // the modal in the same clean state on next open. Does NOT enforce the
  // "no close while creating" guard — call sites (Cancel/×/backdrop)
  // gate themselves on !newLeadCreating; the success path calls this
  // unconditionally.
  function closeNewLead() {
    setNewLeadForm(NEW_LEAD_INITIAL);
    setNewLeadError(null);
    setNewLeadCreating(false);
    setNewLeadOpen(false);
  }

  // Fetcher pulled out of the boot effect so handleCreateLead can re-run
  // it after a successful create. Identical merge logic to the original
  // boot path; preserved verbatim.
  function fetchLeads() {
    setLoading(true);
    return Promise.allSettled([
      apiJson("/dashboard/cp-leads"),
      apiJson("/fire-incidents?size=50"),
    ]).then(([leadsRes, incRes]) => {
      const leadRows = leadsRes.status === "fulfilled" && Array.isArray(leadsRes.value)
        ? leadsRes.value.map(l => ({ ...l, type: "lead" }))
        : [];
      const incBody = incRes.status === "fulfilled" ? incRes.value : null;
      const incItems = Array.isArray(incBody) ? incBody : (incBody?.items || []);
      const incRows = incItems.filter(isFireIncident).map(mapIncidentToBoardRow);
      const merged = [...leadRows, ...incRows].sort((a, b) => {
        const ad = a.created_at || a.loss_date || "";
        const bd = b.created_at || b.loss_date || "";
        return bd.localeCompare(ad);
      });
      if (leadsRes.status === "rejected" && incRes.status === "rejected") {
        const err = leadsRes.reason || incRes.reason;
        setError(String(err?.status ?? err?.detail ?? err));
      } else {
        setError(null);
      }
      setLeads(merged);
      setLoading(false);
    });
  }

  useEffect(() => {
    let cancelled = false;
    fetchLeads().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lead-creation submit. Validates the two required fields, POSTs, and
  // refreshes the list. All other fields are optional per the backend
  // schema (LeadCreate / LeadContactCreate). Surfaces server validation
  // errors verbatim so users see why a payload was rejected (e.g. invalid
  // email format, peril over 100 chars).
  async function handleCreateLead() {
    setNewLeadError(null);
    const fullName = (newLeadForm.full_name || "").trim();
    const phone = (newLeadForm.phone_number || "").trim();
    if (!fullName) {
      setNewLeadError("Full name is required.");
      return;
    }
    if (!phone) {
      setNewLeadError("Phone number is required.");
      return;
    }

    // Backend payload — only fields backed by LeadCreate / LeadContactCreate.
    // Everything except full_name + phone_number is omitted when empty so
    // we never send "" where the backend expects null.
    const contact = { full_name: fullName, phone_number: phone };
    const optStr = (k, v) => { const t = (v || "").trim(); if (t) contact[k] = t; };
    optStr("email", newLeadForm.email);
    optStr("address_loss", newLeadForm.address_loss);
    optStr("state_loss", newLeadForm.state_loss);

    const body = { contact };
    const peril = (newLeadForm.peril || "").trim();
    const insurance = (newLeadForm.insurance_company || "").trim();
    const notes = (newLeadForm.instructions_or_notes || "").trim();
    if (peril)     body.peril = peril;
    if (insurance) body.insurance_company = insurance;
    if (notes)     body.instructions_or_notes = notes;

    setNewLeadCreating(true);
    try {
      await apiJson("/leads", {
        method: "POST",
        body: JSON.stringify(body),
      });
      // Success path is the ONLY path that calls closeNewLead. The catch
      // below intentionally does NOT close the modal so the user can read
      // the error and retry without losing what they typed.
      closeNewLead();
      await fetchLeads();
    } catch (err) {
      // Always log the full error to the console so DevTools shows the
      // exact response body / headers / stack — essential when the error
      // is a network/CORS failure (no .status, no .detail) and the inline
      // banner can only show a generic message.
      // eslint-disable-next-line no-console
      console.error("[NewLead] POST /v1/leads failed:", err);

      // Build the inline message with as much signal as possible. Order:
      //   1. HTTP status (if present) — always prefixed so the user can
      //      tell apart 401 (auth lost) from 422 (validation) from 5xx
      //      (server) from undefined (network/CORS pre-response).
      //   2. Server-supplied detail (FastAPI 422 detail-array, or a
      //      plain {detail: "..."} string).
      //   3. A network-fail hint when neither status nor detail is set —
      //      this signature is most consistent with a CORS preflight
      //      rejection or a fetch-level TypeError before any response.
      const statusPart = err?.status ? `HTTP ${err.status}` : "Network error";
      let detailPart = "";
      if (Array.isArray(err?.detail)) {
        detailPart = err.detail
          .map(d => `${(d.loc || []).slice(-1)[0] || "field"}: ${d.msg}`)
          .join("; ");
      } else if (typeof err?.detail === "string") {
        detailPart = err.detail;
      } else if (!err?.status) {
        detailPart = "no response from server (check DevTools Network for details)";
      }
      const msg = detailPart
        ? `${statusPart} — ${detailPart}`
        : `${statusPart} — could not create lead.`;
      setNewLeadError(msg);
    } finally {
      setNewLeadCreating(false);
    }
  }

  // Build filter chips from actual lead perils present (so CP never sees
  // a chip that filters to zero rows unless they ask for "All").
  const perilCounts = useMemo(() => {
    const counts = { all: leads.length };
    for (const l of leads) {
      const key = l.peril || "other";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [leads]);

  const visible = useMemo(() => {
    if (filter === "all") return leads;
    return leads.filter(l => (l.peril || "other") === filter);
  }, [leads, filter]);

  if (loading) {
    return (
      <div style={{ color: C.muted, ...mono, padding: 40 }}>
        Loading leads…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ color: "#E05050", ...mono, padding: 40 }}>
        Failed to load leads: {error}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <button
          onClick={() => navigate("/portal")}
          style={{
            background: "transparent",
            border: "none",
            color: C.muted,
            fontSize: 12,
            cursor: "pointer",
            padding: "4px 0",
            letterSpacing: 0.5,
            ...mono,
          }}
        >
          ← BACK TO COMMAND CENTER
        </button>
        <h1 style={{ ...mono, fontSize: 22, color: "#fff", fontWeight: 700, margin: "6px 0 4px" }}>
          Fire Leads
        </h1>
        <div style={{ color: C.muted, fontSize: 13, ...mono }}>
          {leads.length} lead{leads.length === 1 ? "" : "s"} across your downline.
        </div>
        <div style={{
          marginTop: 10,
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 0.5,
          color: "rgba(168,85,247,0.85)",
        }}>
          Leads sourced and monitored through the <span style={{ color: "#fff", fontWeight: 700 }}>UPA Response Intelligence Network</span>
        </div>
      </div>

      {/* Filter chips + New Lead trigger */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <FilterChip
          label={`All · ${perilCounts.all || 0}`}
          active={filter === "all"}
          color="#FFFFFF"
          onClick={() => setFilter("all")}
        />
        {Object.entries(PERIL_META).map(([key, meta]) => {
          const count = perilCounts[key] || 0;
          if (count === 0) return null;
          return (
            <FilterChip
              key={key}
              label={`${meta.icon} ${meta.label} · ${count}`}
              active={filter === key}
              color={meta.color}
              onClick={() => setFilter(key)}
            />
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => { setNewLeadError(null); setNewLeadOpen(true); }}
          style={{
            ...mono,
            padding: "8px 14px",
            background: "rgba(0,230,168,0.12)",
            border: "1px solid rgba(0,230,168,0.45)",
            borderRadius: 6,
            color: "#00E6A8",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
            cursor: "pointer",
          }}
        >+ New Lead</button>
      </div>

      {/* Leads list */}
      {visible.length === 0 ? (
        <EmptyState hasAnyLeads={leads.length > 0} hasFilter={filter !== "all"} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(lead => (
            <LeadRow
              key={lead.id}
              lead={lead}
              onClick={() => {
                // eslint-disable-next-line no-console
                if (import.meta.env.DEV) console.log("[FireLeads] clicked lead", lead.id, lead);
                // Open the in-place detail panel for THIS lead only.
                // Stays on /portal/fire-leads — never navigates to the
                // raw RIN incident list.
                setSelectedLead(lead);
              }}
            />
          ))}
        </div>
      )}

      {/* Selected-lead detail panel — shows ONLY the lead the user clicked */}
      <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />

      {/* New Lead modal — manual creation by CP/RVP/admin via POST /v1/leads. */}
      {newLeadOpen && (
        <div
          onClick={() => { if (!newLeadCreating) closeNewLead(); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
              border: "1px solid rgba(0,230,168,0.30)",
              borderRadius: 12,
              padding: "22px 26px",
              width: 520,
              maxWidth: "94vw",
              maxHeight: "86vh",
              overflow: "auto",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h4 style={{ ...mono, color: "#fff", fontSize: 16, margin: 0, letterSpacing: 0.5 }}>
                New Lead
              </h4>
              <button
                type="button"
                onClick={() => { if (!newLeadCreating) closeNewLead(); }}
                aria-label="Close"
                disabled={newLeadCreating}
                style={{
                  background: "none", border: "none",
                  color: "rgba(255,255,255,0.55)", fontSize: 20,
                  cursor: newLeadCreating ? "not-allowed" : "pointer",
                  lineHeight: 1, padding: 4,
                }}
              >×</button>
            </div>
            <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>
              Required: Full name, Phone
            </div>

            {/* Form */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <NewLeadField
                label="Full name *"
                value={newLeadForm.full_name}
                onChange={(v) => setNewLeadForm(f => ({ ...f, full_name: v }))}
                disabled={newLeadCreating}
                maxLength={100}
              />
              <NewLeadField
                label="Phone *"
                value={newLeadForm.phone_number}
                onChange={(v) => setNewLeadForm(f => ({ ...f, phone_number: v }))}
                disabled={newLeadCreating}
                maxLength={20}
              />
              <NewLeadField
                label="Email"
                value={newLeadForm.email}
                onChange={(v) => setNewLeadForm(f => ({ ...f, email: v }))}
                disabled={newLeadCreating}
                type="email"
              />
              <NewLeadField
                label="Insurance company"
                value={newLeadForm.insurance_company}
                onChange={(v) => setNewLeadForm(f => ({ ...f, insurance_company: v }))}
                disabled={newLeadCreating}
                maxLength={100}
              />
              <div style={{ gridColumn: "1 / -1" }}>
                <NewLeadField
                  label="Loss address"
                  value={newLeadForm.address_loss}
                  onChange={(v) => setNewLeadForm(f => ({ ...f, address_loss: v }))}
                  disabled={newLeadCreating}
                  maxLength={255}
                />
              </div>
              <NewLeadField
                label="State (loss)"
                value={newLeadForm.state_loss}
                onChange={(v) => setNewLeadForm(f => ({ ...f, state_loss: v.toUpperCase() }))}
                disabled={newLeadCreating}
                maxLength={50}
              />
              <NewLeadSelect
                label="Peril"
                value={newLeadForm.peril}
                onChange={(v) => setNewLeadForm(f => ({ ...f, peril: v }))}
                disabled={newLeadCreating}
                options={[
                  { value: "", label: "— Select —" },
                  { value: "fire",   label: "🔥 Fire" },
                  { value: "storm",  label: "⛈️ Storm" },
                  { value: "flood",  label: "💧 Flood" },
                  { value: "hail",   label: "🧊 Hail" },
                  { value: "wind",   label: "💨 Wind" },
                  { value: "theft",  label: "🔒 Theft" },
                  { value: "other",  label: "📋 Other" },
                ]}
              />
              <div style={{ gridColumn: "1 / -1" }}>
                <NewLeadField
                  label="Notes"
                  value={newLeadForm.instructions_or_notes}
                  onChange={(v) => setNewLeadForm(f => ({ ...f, instructions_or_notes: v }))}
                  disabled={newLeadCreating}
                  multiline
                />
              </div>
            </div>

            {newLeadError && (
              <div style={{
                ...mono,
                marginTop: 14,
                padding: "10px 12px",
                background: "rgba(224,80,80,0.10)",
                border: "1px solid rgba(224,80,80,0.40)",
                borderRadius: 6,
                color: "#E05050",
                fontSize: 12,
                lineHeight: 1.5,
              }}>
                {newLeadError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button
                type="button"
                onClick={() => { if (!newLeadCreating) closeNewLead(); }}
                disabled={newLeadCreating}
                style={{
                  ...mono, padding: "8px 14px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 6,
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 12,
                  cursor: newLeadCreating ? "not-allowed" : "pointer",
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={handleCreateLead}
                disabled={newLeadCreating}
                style={{
                  ...mono, padding: "8px 14px",
                  background: newLeadCreating ? "rgba(255,255,255,0.06)" : "rgba(0,230,168,0.12)",
                  border: `1px solid ${newLeadCreating ? "rgba(255,255,255,0.18)" : "rgba(0,230,168,0.45)"}`,
                  borderRadius: 6,
                  color: newLeadCreating ? "rgba(255,255,255,0.4)" : "#00E6A8",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  cursor: newLeadCreating ? "not-allowed" : "pointer",
                }}
              >
                {newLeadCreating ? "Creating…" : "Create Lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New Lead form primitives ──────────────────────────────────────────
// Tiny presentational helpers so the modal stays readable. Match the
// existing assign-to-user modal's styling (dark glass + cyan accent).

function NewLeadField({ label, value, onChange, disabled, type, maxLength, multiline }) {
  const inputProps = {
    value,
    onChange: (e) => onChange(e.target.value),
    disabled,
    maxLength,
    style: {
      width: "100%",
      padding: "8px 10px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: 6,
      color: "#fff",
      fontSize: 13,
      ...mono,
      boxSizing: "border-box",
    },
  };
  return (
    <label style={{ display: "block" }}>
      <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.5 }}>
        {label}
      </div>
      {multiline
        ? <textarea rows={3} {...inputProps} />
        : <input type={type || "text"} {...inputProps} />}
    </label>
  );
}

function NewLeadSelect({ label, value, onChange, disabled, options }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.5 }}>
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "8px 10px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 6,
          color: "#fff",
          fontSize: 13,
          ...mono,
          boxSizing: "border-box",
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// ── In-place detail panel ──────────────────────────────────────────────
// Renders inside ClaimRush; never navigates away. Shows only the fields
// already on the row (no extra backend round-trip — the row is the source
// of truth). Click outside the card OR the × button to dismiss.
function LeadDetailPanel({ lead, onClose }) {
  // Action state: { skip|sms|call : { state: 'idle'|'running'|'success'|'error', msg } }
  // Auto-resets to idle 4 seconds after success/error so the user can re-fire.
  const [actions, setActions] = useState({});
  // Stage 2 — skip-trace result visibility.
  // `detail` = GET /v1/leads/{id}        (Lead full record incl. contact{phone_number,full_name,email})
  // `trace`  = GET /v1/leads/{id}/skip-trace  (LeadSkipTrace: skiptrace_status + owner_full_name/phone/email)
  const [detail, setDetail] = useState(null);
  const [trace, setTrace] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // Stage 3+4 — convert + assign-adjuster wiring.
  // After a successful Convert, the backend response carries client_id +
  // claim_id. Capture both so the Assign Adjuster modal knows which claim
  // to PUT against, and so the panel can show the linkage.
  const [convertResult, setConvertResult] = useState(null); // {client_id, claim_id, lead_id}
  const [adjusters, setAdjusters] = useState(null);          // GET /v1/users/role/adjuster items
  const [adjusterModalOpen, setAdjusterModalOpen] = useState(false);
  const [pickedAdjusterId, setPickedAdjusterId] = useState("");

  // Stage 5 — Lead Status timeline + Recent Activity.
  // Persistent state derives from existing endpoints (lead.status,
  // lead.client_id, lead.updated_at, LeadSkipTrace.skiptrace_status,
  // LeadSkipTrace.skiptrace_ran_at). For SMS/Call/Assign we also stamp
  // a session-local timestamp when the user fires the action this turn —
  // there's no per-lead CommunicationLog endpoint yet, so cross-session
  // history for those events is a known gap (flagged in audit).
  const sessionStamps = useRef({});  // { skip|sms|call|convert|assign|… : ISO string }
  // Reset session stamps whenever the user opens a different lead.
  useEffect(() => { sessionStamps.current = {}; }, [lead?.id]);

  // Stage 7 — Ownership + Follow-Up state.
  // assignableUsers: lazy-loaded {cp, rvp, agent, adjuster} merged from
  //   GET /v1/users/role/<role>; cached after first open of the picker.
  // assignModalOpen / pickedAssigneeId: standard modal state.
  // currentUserId: pulled from `cr_user` localStorage so "Take Ownership"
  //   knows who I am. (cr_user is set during Login.jsx flow, stable across the session.)
  const [assignableUsers, setAssignableUsers] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [pickedAssigneeId, setPickedAssigneeId] = useState("");
  const currentUserId = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("cr_user") || "{}")?.user_id || null; }
    catch { return null; }
  }, []);
  // Capture timestamps as actions transition to "success" this session.
  useEffect(() => {
    Object.entries(actions).forEach(([key, val]) => {
      if (val?.state === "success" && !sessionStamps.current[key]) {
        sessionStamps.current[key] = new Date().toISOString();
      }
    });
  }, [actions]);

  const isLeadRow = lead?.type === "lead";

  const refreshLead = async () => {
    if (!lead || !isLeadRow) return;
    setRefreshing(true);
    const [leadRes, traceRes] = await Promise.allSettled([
      apiJson(`/leads/${lead.id}`),
      apiJson(`/leads/${lead.id}/skip-trace`),
    ]);
    const newDetail = leadRes.status === "fulfilled" ? leadRes.value : null;
    const newTrace = traceRes.status === "fulfilled" ? traceRes.value : null;
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 2][refresh] lead =", newDetail);
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 2][refresh] skip-trace =", newTrace, traceRes.status === "rejected" ? `(rejected: ${JSON.stringify(traceRes.reason)})` : "");
    setDetail(newDetail);
    setTrace(newTrace);
    setRefreshing(false);
  };

  // On panel open (lead.id changes), reset state and re-fetch.
  useEffect(() => {
    setDetail(null);
    setTrace(null);
    if (lead && isLeadRow) {
      refreshLead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  if (!lead) return null;
  const peril = perilMeta(lead.peril);
  const status = statusPill(lead.status);
  const fmtDate = (s) => { try { return new Date(s).toLocaleDateString(); } catch { return s; } };

  // Map LeadSkipTrace.skiptrace_status to a user-facing label + color.
  const skipStatus = (() => {
    if (!isLeadRow) return { label: "—", color: "rgba(255,255,255,0.45)" };
    if (trace == null) return { label: refreshing ? "Loading…" : "Not started", color: "rgba(255,255,255,0.55)" };
    const s = trace.skiptrace_status;
    if (s === "pending")  return { label: "Running",  color: "#A855F7" };
    if (s === "success")  return { label: "Complete", color: "#00E6A8" };
    if (s === "partial")  return { label: "Complete (partial)", color: "#00E6A8" };
    if (s === "failed")   return { label: "Failed",   color: "#E05050" };
    return { label: s || "Unknown", color: "rgba(255,255,255,0.55)" };
  })();
  const phoneNumber = trace?.owner_phone || detail?.contact?.phone_number || null;
  const ownerName  = trace?.owner_full_name || detail?.contact?.full_name || (() => {
    const f = trace?.owner_first_name, l = trace?.owner_last_name;
    return (f || l) ? `${f || ""} ${l || ""}`.trim() : null;
  })();

  // ── Stage 5: Lead Status pipeline (8 steps) ──────────────────────
  // Derived purely from data already in scope:
  //   detail        — GET /v1/leads/{id}     (status, client_id, created_at, updated_at)
  //   trace         — GET /v1/leads/{id}/skip-trace  (skiptrace_status, skiptrace_ran_at)
  //   actions       — this-session button state (success/failure timestamps)
  //   convertResult — captured response of the convert call (client_id + claim_id)
  // No mock data, no fake events, no extra backend calls beyond what's
  // already loaded. Cross-session history for SMS / Call / Assign is a
  // known gap until a per-lead CommunicationLog endpoint exists.
  const fmtTime = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch { return null; }
  };

  const pipelineSteps = useMemo(() => {
    const steps = [];
    // 1. New Lead — always done; created_at from refreshed detail or row.
    steps.push({
      key: "new", label: "New Lead", state: "done",
      timestamp: detail?.created_at || lead?.created_at || null,
    });
    // 2. Skip Trace Complete — from LeadSkipTrace.skiptrace_status.
    if (!trace) {
      steps.push({ key: "skip", label: "Skip Trace Complete", state: "notyet", timestamp: null });
    } else if (trace.skiptrace_status === "success" || trace.skiptrace_status === "partial") {
      steps.push({ key: "skip", label: "Skip Trace Complete", state: "done", timestamp: trace.skiptrace_ran_at });
    } else if (trace.skiptrace_status === "failed") {
      steps.push({ key: "skip", label: "Skip Trace Complete", state: "failed", timestamp: trace.skiptrace_ran_at });
    } else {
      steps.push({ key: "skip", label: "Skip Trace Complete", state: "pending", timestamp: trace.skiptrace_ran_at });
    }
    // 3. SMS Sent — persistent signal: lead.status === 'text-sent' (set
    //    by /v1/fire-incidents/{id}/send-sms backend). Plus session signal.
    const smsHistory = (detail?.status === "text-sent" || lead?.status === "text-sent");
    const smsSession = actions.sms?.state === "success";
    steps.push({
      key: "sms", label: "SMS Sent",
      state: (smsHistory || smsSession) ? "done" : "notyet",
      timestamp: smsSession ? sessionStamps.current.sms : (smsHistory ? detail?.updated_at : null),
    });
    // 4. AI Call Attempted — session-only signal (no persistent backend
    //    field exposes this without a CommunicationLog endpoint).
    steps.push({
      key: "call", label: "AI Call Attempted",
      state: actions.call?.state === "success" ? "done" : "notyet",
      timestamp: actions.call?.state === "success" ? sessionStamps.current.call : null,
    });
    // 5. Contact Made — derived from lead.status. The backend's
    //    LeadOutcomeService sets these when the homeowner responds.
    const contactStatuses = new Set(["responded-yes", "responded-no", "callback", "contacted"]);
    const contactMade = contactStatuses.has(detail?.status) || contactStatuses.has(lead?.status);
    steps.push({
      key: "contact", label: "Contact Made",
      state: contactMade ? "done" : "notyet",
      timestamp: contactMade ? detail?.updated_at : null,
    });
    // 6. Converted to Client — lead.client_id non-null, OR convertResult
    //    captured this session.
    const converted = !!detail?.client_id || !!convertResult?.client_id;
    steps.push({
      key: "converted", label: "Converted to Client",
      state: converted ? "done" : "notyet",
      timestamp: convertResult?.client_id
        ? sessionStamps.current.convert
        : (converted ? detail?.updated_at : null),
    });
    // 7. Claim Created — atomic with conversion (the /convert backend
    //    also creates the initial Claim). True iff converted.
    steps.push({
      key: "claim", label: "Claim Created",
      state: converted ? "done" : "notyet",
      timestamp: convertResult?.claim_id
        ? sessionStamps.current.convert
        : (converted ? detail?.updated_at : null),
    });
    // 8. Adjuster Assigned — session signal only (cross-session would
    //    require GET /v1/claims/{id} returning assigned_to + matching
    //    against role=adjuster; left as known gap).
    steps.push({
      key: "adjuster", label: "Adjuster Assigned",
      state: actions.assign?.state === "success" ? "done" : "notyet",
      timestamp: actions.assign?.state === "success" ? sessionStamps.current.assign : null,
    });
    return steps;
  }, [detail, trace, actions, convertResult, lead]);

  // ── Stage 6 — Disposition meta + Next Recommended Action ─────────
  // Map the canonical LeadStatus enum to demo-friendly labels + colors.
  // Source of truth: app.core.enums.LeadStatus (no UI labels invented).
  const DISPOSITION_META = {
    "new":             { label: "No Response",         color: "rgba(255,255,255,0.55)" },
    "unassigned":      { label: "Unassigned",          color: "rgba(255,255,255,0.55)" },
    "skip-trace-pending": { label: "Skip Trace Pending", color: "#A855F7" },
    "text-sent":       { label: "SMS Sent — Awaiting", color: "#3B82F6" },
    "awaiting-call":   { label: "Left Voicemail",      color: "#3B82F6" },
    "callback":        { label: "Callback Requested",  color: "#C9A84C" },
    "interested":      { label: "Interested",          color: "#00E6A8" },
    "responded-yes":   { label: "Interested",          color: "#00E6A8" },
    "not-interested":  { label: "Not Interested",      color: "#E05050" },
    "not-qualified":   { label: "Not Qualified",       color: "#E05050" },
    "pending-sign":    { label: "Appointment Scheduled", color: "#00E6A8" },
    "signed":          { label: "Signed",              color: "#00E6A8" },
    "signed-approved": { label: "Signed (approved)",   color: "#00E6A8" },
    "converted":       { label: "Converted to Client", color: "#00E6A8" },
    "transfer":        { label: "Transferred",         color: "rgba(255,255,255,0.55)" },
    "closed":          { label: "Closed",              color: "rgba(255,255,255,0.45)" },
  };
  const currentStatus = detail?.status || lead?.status || "new";
  const dispositionMeta =
    DISPOSITION_META[currentStatus] || { label: currentStatus, color: "rgba(255,255,255,0.55)" };

  // Next-action engine — derives a single recommended next step from the
  // pipeline state. Pure client-side; no fake events. Order matters: most
  // urgent / earliest stage wins.
  const nextRecommendedAction = useMemo(() => {
    // Already converted → adjuster path.
    if (currentStatus === "converted" || convertResult?.client_id || detail?.client_id) {
      if (actions.assign?.state !== "success") {
        return { text: "Assign Adjuster", color: "#00E6A8" };
      }
      return { text: "Claim handoff complete", color: "#00E6A8" };
    }
    // Closed branches.
    if (currentStatus === "not-interested" || currentStatus === "not-qualified" || currentStatus === "closed") {
      return { text: "Disposition closed — no further action", color: "rgba(255,255,255,0.45)" };
    }
    // Appointment scheduled → drive to convert.
    if (currentStatus === "pending-sign" || currentStatus === "signed" || currentStatus === "signed-approved") {
      return { text: "Convert to Client", color: "#00E6A8" };
    }
    // Engaged → schedule next step.
    if (currentStatus === "interested" || currentStatus === "responded-yes") {
      return { text: "Schedule appointment / Convert to Client", color: "#00E6A8" };
    }
    if (currentStatus === "callback") {
      return { text: "Call homeowner (callback requested)", color: "#C9A84C" };
    }
    // Reached out, no answer yet.
    if (currentStatus === "awaiting-call") {
      return { text: "Retry voice outreach later", color: "#3B82F6" };
    }
    if (currentStatus === "text-sent" || actions.sms?.state === "success") {
      return { text: "Retry SMS tomorrow OR call homeowner", color: "#3B82F6" };
    }
    // No outreach yet — drive earliest stage.
    if (!trace || trace.skiptrace_status === "failed") {
      return { text: "Run Skip Trace to enrich owner contact", color: "#A855F7" };
    }
    if (phoneNumber) {
      return { text: "Send SMS to homeowner", color: "#A855F7" };
    }
    return { text: "Run Skip Trace to enrich owner contact", color: "#A855F7" };
  }, [currentStatus, detail, trace, phoneNumber, actions, convertResult]);

  // ── Stage 7 — Ownership display + Follow-Up due classification ───
  const ownerInfo = useMemo(() => {
    const u = detail?.assigned_user;
    if (!u || !detail?.assigned_to) {
      return { name: "Unassigned", email: null, isMe: false, role: null };
    }
    const name = `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || "(unknown)";
    return {
      name,
      email: u.email || null,
      isMe: !!currentUserId && detail?.assigned_to === currentUserId,
      // assigned_user response doesn't include role.name today; fall back to
      // the cached _role_hint from the assignableUsers cache when available.
      role: (assignableUsers || []).find(au => au.id === detail?.assigned_to)?._role_hint || null,
    };
  }, [detail, currentUserId, assignableUsers]);

  // Follow-up classification:
  //   no follow_up_at → "No Follow-Up Scheduled"
  //   follow_up_completed_at >= follow_up_at → "Completed"
  //   follow_up_at < now → "Overdue" (red)
  //   today → "Due Today" (gold)
  //   tomorrow → "Tomorrow" (blue)
  //   within 7 days → "This Week" (blue)
  //   beyond → "Scheduled" (muted)
  const followUpInfo = useMemo(() => {
    const dueAt = detail?.follow_up_at || null;
    const doneAt = detail?.follow_up_completed_at || null;
    if (!dueAt) return { state: "none", label: "No Follow-Up Scheduled", color: "rgba(255,255,255,0.45)", dueAt: null, doneAt: null };
    if (doneAt && new Date(doneAt) >= new Date(dueAt)) {
      return { state: "done", label: "Completed", color: "#00E6A8", dueAt, doneAt };
    }
    const due = new Date(dueAt);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const startOfDayAfter = new Date(startOfToday); startOfDayAfter.setDate(startOfDayAfter.getDate() + 2);
    const sevenDaysOut = new Date(startOfToday); sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    if (due < startOfToday) return { state: "overdue", label: "Overdue", color: "#E05050", dueAt, doneAt: null };
    if (due < startOfTomorrow) return { state: "today", label: "Due Today", color: "#C9A84C", dueAt, doneAt: null };
    if (due < startOfDayAfter) return { state: "tomorrow", label: "Tomorrow", color: "#3B82F6", dueAt, doneAt: null };
    if (due < sevenDaysOut) return { state: "thisweek", label: "This Week", color: "#3B82F6", dueAt, doneAt: null };
    return { state: "later", label: "Scheduled", color: "rgba(255,255,255,0.55)", dueAt, doneAt: null };
  }, [detail?.follow_up_at, detail?.follow_up_completed_at]);

  // Recent Activity feed — derived from same pipeline events that have a
  // real timestamp, sorted newest first, capped at 6.
  const recentActivity = useMemo(() => {
    const labelMap = {
      new: "Lead received",
      skip: "Skip trace ran",
      sms: "SMS sent to homeowner",
      call: "AI voice outreach initiated",
      contact: "Contact made with homeowner",
      converted: "Converted to client",
      claim: "Claim created",
      adjuster: actions.assign?.msg ? actions.assign.msg.replace(/^✓\s*/, "") : "Assigned to adjuster",
    };
    return pipelineSteps
      .filter(s => s.timestamp && s.state !== "notyet")
      .map(s => ({
        key: s.key,
        label: labelMap[s.key] || s.label,
        timestamp: s.timestamp,
        state: s.state,
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 6);
  }, [pipelineSteps, actions.assign]);

  const setAction = (key, state, msg) => {
    setActions(prev => ({ ...prev, [key]: { state, msg } }));
    if (state === "success" || state === "error") {
      setTimeout(() => {
        setActions(prev => {
          const cur = prev[key];
          if (cur && cur.state === state && cur.msg === msg) {
            const next = { ...prev };
            delete next[key];
            return next;
          }
          return prev;
        });
      }, 4000);
    }
  };

  const errMsg = (err) => {
    const status = err?.status ?? "?";
    const detail = err?.detail || err?.message || "Failed";
    return `HTTP ${status}: ${typeof detail === "string" ? detail : "Failed"}`;
  };

  // The merged list contains two row shapes — `lead` rows (id = Lead UUID,
  // valid for /v1/leads/{id}/* endpoints) and `incident` rows (id =
  // FireIncident UUID, would 404 on lead-scoped endpoints). Lead-scoped
  // actions only fire on type="lead" rows; incident rows show buttons
  // disabled with an explanation.

  const guardLeadRow = (key) => {
    if (isLeadRow) return true;
    setAction(key, "error", "Not a lead row (incident UUID can't hit /v1/leads/...)");
    return false;
  };

  // Action 4 — Convert Lead → Client + Claim (single atomic backend call).
  // POST /v1/leads/{id}/convert creates BOTH the Client AND the initial Claim
  // via LeadOutcomeService._automation_convert_to_claim. Body is optional —
  // contract_sign_date / fee_type / fee / notes can override the LeadOutcome
  // defaults; we send empty body for now (backend uses defaults).
  // Backend enforces: ownership check (validate_lead_ownership) +
  // double-conversion guard (returns 409 if lead.client_id already set).
  const handleConvert = async () => {
    if (!guardLeadRow("convert")) return;
    if (!window.confirm(
      `Convert Lead #${lead.ref_number || lead.id} into a Client + open initial Claim?\n\n` +
      `This calls POST /v1/leads/${lead.id}/convert and creates BOTH a Client record AND an initial Claim atomically.`
    )) return;
    setAction("convert", "running");
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 3][convert] sending lead_id =", lead.id, "(row.type =", lead.type + ")");
    try {
      const res = await apiJson(`/leads/${lead.id}/convert`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 3][convert] response →", res);
      // Capture client_id + claim_id so the next step (Assign Adjuster)
      // knows which claim to update without re-fetching.
      setConvertResult({
        client_id: res?.client_id || null,
        claim_id:  res?.claim_id  || null,
        lead_id:   res?.lead_id   || lead.id,
      });
      const cid = res?.client_id ? String(res.client_id).slice(0, 8) + "…" : null;
      setAction("convert", "success", cid ? `Client ${cid}` : "Converted");
      // Refresh the panel so the lead reflects its new converted state
      // (status, client_id linkage, etc.) without closing the modal.
      setTimeout(() => { refreshLead(); }, 1200);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 3][convert] error →", err);
      if (err?.status === 409) {
        setAction("convert", "error", "Already converted");
      } else if (err?.status === 403) {
        setAction("convert", "error", "Not your lead");
      } else {
        setAction("convert", "error", errMsg(err));
      }
    }
  };

  // ── Stage 7 — Ownership: assign / take ownership.
  // Loads cp + rvp + agent + adjuster users from the existing
  // /v1/users/role/{role} endpoint. Merges + dedupes by id.
  const openAssignToUserPicker = async () => {
    setAssignModalOpen(true);
    if (assignableUsers !== null) return;
    try {
      const roles = ["cp", "rvp", "agent", "adjuster"];
      const results = await Promise.allSettled(
        roles.map(r => apiJson(`/users/role/${r}`))
      );
      const seen = new Set();
      const merged = [];
      results.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const items = Array.isArray(r.value) ? r.value : (r.value?.items || []);
        items.forEach(u => {
          if (!seen.has(u.id)) {
            seen.add(u.id);
            merged.push({ ...u, _role_hint: roles[i] });
          }
        });
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 7][assign-user] loaded", { count: merged.length });
      setAssignableUsers(merged);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 7][assign-user] load failed →", err);
      setAssignableUsers([]);
    }
  };

  const handleAssignToUser = async () => {
    if (!guardLeadRow("ownership")) return;
    if (!pickedAssigneeId) {
      setAction("ownership", "error", "Pick a user");
      return;
    }
    const picked = (assignableUsers || []).find(u => u.id === pickedAssigneeId);
    const label = picked ? `${picked.first_name || ""} ${picked.last_name || ""}`.trim() || picked.email : pickedAssigneeId;
    if (!window.confirm(`Reassign Lead #${lead.ref_number || lead.id} to ${label}?`)) return;
    setAction("ownership", "running");
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 7][assign-user] PUT /v1/leads/" + lead.id, { assigned_to: pickedAssigneeId });
    try {
      const res = await apiJson(`/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({ assigned_to: pickedAssigneeId }),
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 7][assign-user] response →", res);
      setAction("ownership", "success", `Assigned to ${label}`);
      setAssignModalOpen(false);
      setPickedAssigneeId("");
      setTimeout(() => { refreshLead(); }, 500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 7][assign-user] error →", err);
      setAction("ownership", "error", errMsg(err));
    }
  };

  const handleTakeOwnership = async () => {
    if (!guardLeadRow("ownership")) return;
    if (!currentUserId) {
      setAction("ownership", "error", "Login session missing user_id");
      return;
    }
    if (!window.confirm(`Take ownership of Lead #${lead.ref_number || lead.id}?`)) return;
    setAction("ownership", "running");
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 7][take-ownership] PUT /v1/leads/" + lead.id, { assigned_to: currentUserId });
    try {
      const res = await apiJson(`/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({ assigned_to: currentUserId }),
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 7][take-ownership] response →", res);
      setAction("ownership", "success", "You own this lead");
      setTimeout(() => { refreshLead(); }, 500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 7][take-ownership] error →", err);
      setAction("ownership", "error", errMsg(err));
    }
  };

  // ── Stage 7 — Follow-Up: schedule / mark complete / reopen.
  // All three write to lead.follow_up_at / lead.follow_up_completed_at via
  // the existing PUT /v1/leads/{id} endpoint (schema fields added in this turn).
  const handleScheduleFollowUp = async (whenIso, label) => {
    if (!guardLeadRow("followup")) return;
    if (!window.confirm(`Schedule follow-up for ${label}?`)) return;
    setAction("followup", "running");
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 7][follow-up] PUT /v1/leads/" + lead.id, { follow_up_at: whenIso, follow_up_completed_at: null });
    try {
      const res = await apiJson(`/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({ follow_up_at: whenIso, follow_up_completed_at: null }),
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 7][follow-up] response →", res);
      setAction("followup", "success", `Follow-up: ${label}`);
      setTimeout(() => { refreshLead(); }, 500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 7][follow-up] error →", err);
      setAction("followup", "error", errMsg(err));
    }
  };

  const handleMarkFollowUpComplete = async () => {
    if (!guardLeadRow("followup")) return;
    if (!window.confirm(`Mark follow-up for Lead #${lead.ref_number || lead.id} as complete?`)) return;
    setAction("followup", "running");
    const nowIso = new Date().toISOString();
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 7][follow-up] mark complete PUT /v1/leads/" + lead.id, { follow_up_completed_at: nowIso });
    try {
      const res = await apiJson(`/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({ follow_up_completed_at: nowIso }),
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 7][follow-up] response →", res);
      setAction("followup", "success", "Follow-up complete");
      setTimeout(() => { refreshLead(); }, 500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 7][follow-up] error →", err);
      setAction("followup", "error", errMsg(err));
    }
  };

  const handleReopenLead = async () => {
    if (!guardLeadRow("followup")) return;
    if (!window.confirm(`Reopen Lead #${lead.ref_number || lead.id}? (clears follow-up state, resets status to active)`)) return;
    setAction("followup", "running");
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 7][reopen] PUT /v1/leads/" + lead.id, { status: "new", follow_up_at: null, follow_up_completed_at: null });
    try {
      const res = await apiJson(`/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "new",
          follow_up_at: null,
          follow_up_completed_at: null,
        }),
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 7][reopen] response →", res);
      setAction("followup", "success", "Reopened");
      setTimeout(() => { refreshLead(); }, 500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 7][reopen] error →", err);
      setAction("followup", "error", errMsg(err));
    }
  };

  // ── Stage 6 — Disposition / outcome quick-actions.
  // PUT /v1/leads/{id} with {status: <enum>} where enum is from
  // LeadStatus (app.core.enums.LeadStatus). All values below are
  // canonical backend enum strings — no invented statuses.
  const handleDisposition = async (status, prettyLabel) => {
    if (!guardLeadRow("disposition")) return;
    if (!window.confirm(`Mark Lead #${lead.ref_number || lead.id} as "${prettyLabel}"?`)) return;
    setAction("disposition", "running");
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 6][disposition] PUT /v1/leads/" + lead.id, { status });
    try {
      const res = await apiJson(`/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 6][disposition] response →", res);
      setAction("disposition", "success", prettyLabel);
      // Re-pull the lead so the pipeline + status pill reflect the change.
      setTimeout(() => { refreshLead(); }, 600);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 6][disposition] error →", err);
      setAction("disposition", "error", errMsg(err));
    }
  };

  // Action 5 — Open Assign Adjuster modal (lazy-loads adjuster list on first open).
  const openAdjusterPicker = async () => {
    setAdjusterModalOpen(true);
    if (adjusters !== null) return; // already loaded
    try {
      const res = await apiJson(`/users/role/adjuster`);
      const items = Array.isArray(res) ? res : (res?.items || []);
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 4][assign-adjuster] loaded adjusters", { count: items.length, items });
      setAdjusters(items);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 4][assign-adjuster] failed to load adjusters →", err);
      setAdjusters([]); // mark as loaded-empty so the modal renders helpful state
    }
  };

  // Action 5b — PUT /v1/claims/{claim_id} with {assigned_to: <user_id>}.
  const handleAssignAdjuster = async () => {
    const claimId = convertResult?.claim_id;
    if (!claimId) {
      setAction("assign", "error", "No claim id (run Convert first)");
      return;
    }
    if (!pickedAdjusterId) {
      setAction("assign", "error", "Pick an adjuster");
      return;
    }
    const picked = (adjusters || []).find(a => a.id === pickedAdjusterId);
    const label = picked ? `${picked.first_name || ""} ${picked.last_name || ""}`.trim() || picked.email : pickedAdjusterId;
    if (!window.confirm(`Assign ${label} as adjuster for claim ${String(claimId).slice(0, 8)}…?`)) return;
    setAction("assign", "running");
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 4][assign-adjuster] PUT /v1/claims/" + claimId, { assigned_to: pickedAdjusterId });
    try {
      const res = await apiJson(`/claims/${claimId}`, {
        method: "PUT",
        body: JSON.stringify({
          // ClaimUpdate accepts these all as optional. assigned_to is the new field.
          assigned_to: pickedAdjusterId,
          fema_claim: null,
          state_of_emergency: null,
          inhabitable: null,
          can_be_removed: null,
        }),
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 4][assign-adjuster] response →", res);
      setAction("assign", "success", `Assigned to ${label}`);
      setAdjusterModalOpen(false);
      setPickedAdjusterId("");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 4][assign-adjuster] error →", err);
      setAction("assign", "error", errMsg(err));
    }
  };

  // Action 1 — Run Skip Trace
  const handleSkipTrace = async () => {
    if (!guardLeadRow("skip")) return;
    if (!window.confirm(`Run Skip Trace for Lead #${lead.ref_number || lead.id}?`)) return;
    setAction("skip", "running");
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 1][skip-trace] sending lead_id =", lead.id, "(row.type =", lead.type + ")");
    try {
      const res = await apiJson(`/leads/${lead.id}/skip-trace`, { method: "POST" });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 1][skip-trace] response →", res);
      setAction("skip", "success", res?.message || "Queued");
      // Stage 2: one auto-refresh after the queue accepts. The Celery
      // task may still be running — the user can click Refresh again
      // until owner fields populate. No polling.
      setTimeout(() => { refreshLead(); }, 1500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 1][skip-trace] error →", err);
      setAction("skip", "error", errMsg(err));
    }
  };

  // Action 2 — Send SMS via Communications Hub (queued, opt-out aware)
  const handleSendSms = async () => {
    if (!guardLeadRow("sms")) return;
    const defaultMsg = "Hi, this is UPA. We noticed a fire incident at your property. We help homeowners with insurance claims at no upfront cost. Reply YES to learn more.";
    const message = window.prompt("SMS message to send:", defaultMsg);
    if (!message) return;
    if (!window.confirm(`Send this SMS to Lead #${lead.ref_number || lead.id}?\n\n"${message}"`)) return;
    setAction("sms", "running");
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 1][send-sms] sending lead_id =", lead.id, "(row.type =", lead.type + ")");
    try {
      const res = await apiJson(`/communications-hub/send/sms`, {
        method: "POST",
        body: JSON.stringify({ lead_ids: [lead.id], message }),
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 1][send-sms] response →", res);
      setAction("sms", "success", `Queued (${res?.created_count ?? "?"})`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 1][send-sms] error →", err);
      setAction("sms", "error", errMsg(err));
    }
  };

  // Action 3 — Call with Marcus (AI voice outreach via VAPI)
  const handleCallMarcus = async () => {
    if (!guardLeadRow("call")) return;
    const phone_number = window.prompt(
      "Phone number to call (E.164 format, e.g., +12155551234):",
      ""
    );
    if (!phone_number) return;
    if (!window.confirm(`Initiate AI voice call to ${phone_number}?`)) return;
    setAction("call", "running");
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.info("[Stage 1][call-marcus] sending lead_id =", lead.id, "phone =", phone_number, "(row.type =", lead.type + ")");
    try {
      const res = await apiJson(`/voice-outreach/initiate`, {
        method: "POST",
        body: JSON.stringify({ lead_id: lead.id, phone_number }),
      });
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info("[Stage 1][call-marcus] response →", res);
      const ok = res?.success !== false;
      setAction("call", ok ? "success" : "error", res?.call_id ? `Call ${String(res.call_id).slice(0, 8)}…` : (res?.error || "Initiated"));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 1][call-marcus] error →", err);
      setAction("call", "error", errMsg(err));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
          border: "1px solid rgba(0,230,168,0.25)",
          borderRadius: 12, padding: "24px 28px",
          width: 540, maxWidth: "90vw", maxHeight: "85vh", overflow: "auto",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ ...mono, color: "#fff", fontSize: 18, margin: 0, letterSpacing: 0.5 }}>
            Lead #{lead.ref_number}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Stage 9 — At-a-glance status banner. 4 high-signal facts in one row.
            All values reflect the most recent backend state from refreshLead. */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          padding: "10px 12px",
          marginBottom: 16,
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${
            (() => {
              if (followUpInfo.state === "overdue") return "rgba(224,80,80,0.45)";
              if (followUpInfo.state === "today") return "rgba(201,168,76,0.45)";
              if (followUpInfo.state === "done" || currentStatus === "converted") return "rgba(0,230,168,0.30)";
              return "rgba(255,255,255,0.08)";
            })()
          }`,
          borderRadius: 8,
        }}>
          <BannerCell label="Owner"         value={ownerInfo.name}                emphasis={ownerInfo.isMe ? "self" : (ownerInfo.name === "Unassigned" ? "warn" : null)} />
          <BannerCell label="Stage"         value={dispositionMeta.label}         color={dispositionMeta.color} />
          <BannerCell label="Follow-Up"     value={followUpInfo.label}            color={followUpInfo.color} />
          <BannerCell label="Last Activity" value={detail?.updated_at ? fmtTime(detail.updated_at) : "—"} />
        </div>

        {/* Stalled indicator — surfaces inactivity older than 7 days */}
        {(() => {
          if (!detail?.updated_at) return null;
          const idleDays = Math.floor((Date.now() - new Date(detail.updated_at).getTime()) / 86400000);
          if (idleDays < 7 || currentStatus === "converted" || currentStatus === "closed") return null;
          return (
            <div style={{
              padding: "8px 12px", marginBottom: 14,
              background: "rgba(224,80,80,0.08)",
              border: "1px solid rgba(224,80,80,0.30)",
              borderRadius: 6,
              ...mono, fontSize: 11, color: "#E05050",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>⚠</span>
              <span><strong>STALLED</strong> — no activity for {idleDays} days. Consider re-engaging or marking Not Interested.</span>
            </div>
          );
        })()}

        <DetailRow label="Peril"        value={`${peril.icon} ${peril.label}`} color={peril.color} />
        <DetailRow label="Status"       value={status.label} color={status.color} />
        <DetailRow label="Type"         value={lead.type || "—"} />
        <DetailRow label="Skip Trace"   value={skipStatus.label} color={skipStatus.color} />
        {phoneNumber && <DetailRow label="Phone" value={phoneNumber} />}
        {ownerName && <DetailRow label="Owner" value={ownerName} />}
        <DetailRow label="Assigned to"  value={lead.agent_name || "Unassigned"} />
        <DetailRow label="Days open"    value={String(lead.days_open ?? 0)} />
        {lead.claim_number && <DetailRow label="Claim #" value={lead.claim_number} />}
        {lead.insurance_company && <DetailRow label="Insurance" value={lead.insurance_company} />}
        {lead.policy_number && <DetailRow label="Policy #" value={lead.policy_number} />}
        {lead.loss_date && <DetailRow label="Loss date" value={fmtDate(lead.loss_date)} />}
        {lead.created_at && <DetailRow label="Created" value={fmtDate(lead.created_at)} />}
        <DetailRow label="ID" value={lead.id} mono />

        {/* Stage 7 — Assigned Owner */}
        <div style={{ marginTop: 22 }}>
          <div style={{
            ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)",
            letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
            marginBottom: 8, paddingBottom: 6,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>Assigned Owner</div>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr auto", gap: 12,
            alignItems: "center", padding: "8px 0",
          }}>
            <div>
              <div style={{ ...mono, fontSize: 13, color: "#fff", fontWeight: 600 }}>
                {ownerInfo.name}
                {ownerInfo.isMe && (
                  <span style={{
                    marginLeft: 8, padding: "2px 6px",
                    background: "rgba(0,230,168,0.12)", border: "1px solid rgba(0,230,168,0.40)",
                    borderRadius: 3, color: "#00E6A8", fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  }}>YOU</span>
                )}
                {ownerInfo.role && (
                  <span style={{
                    marginLeft: 8, padding: "2px 6px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 3, color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                  }}>{ownerInfo.role}</span>
                )}
              </div>
              {ownerInfo.email && (
                <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.50)", marginTop: 2 }}>
                  {ownerInfo.email}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.40)", letterSpacing: 0.5, textTransform: "uppercase" }}>
                Last Activity
              </div>
              <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                {detail?.updated_at ? fmtTime(detail.updated_at) : "—"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <DispositionButton label="Take Ownership"   onClick={handleTakeOwnership}      disabled={!isLeadRow || ownerInfo.isMe} />
            <DispositionButton label="Assign to User…"  onClick={openAssignToUserPicker}  disabled={!isLeadRow} variant="muted" />
          </div>
          {actions.ownership?.state === "running" && (
            <div style={{ ...mono, fontSize: 11, color: "#A855F7", marginTop: 8 }}>updating ownership…</div>
          )}
          {actions.ownership?.state === "success" && (
            <div style={{ ...mono, fontSize: 11, color: "#00E6A8", marginTop: 8 }}>✓ {actions.ownership.msg}</div>
          )}
          {actions.ownership?.state === "error" && (
            <div style={{ ...mono, fontSize: 11, color: "#E05050", marginTop: 8 }}>✗ {actions.ownership.msg}</div>
          )}
        </div>

        {/* Stage 7 — Follow-Up Due */}
        <div style={{ marginTop: 18 }}>
          <div style={{
            ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)",
            letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
            marginBottom: 8, paddingBottom: 6,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>Follow-Up</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{
              padding: "4px 10px",
              background: `${followUpInfo.color}1A`,
              border: `1px solid ${followUpInfo.color}66`,
              borderRadius: 4, color: followUpInfo.color,
              fontSize: 11, fontWeight: 700, letterSpacing: 1, ...mono,
            }}>{followUpInfo.label}</span>
            {followUpInfo.dueAt && (
              <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                {followUpInfo.state === "done" ? "completed " + fmtTime(followUpInfo.doneAt) : "due " + fmtTime(followUpInfo.dueAt)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <DispositionButton
              label="Today (4pm)"
              onClick={() => {
                const d = new Date(); d.setHours(16, 0, 0, 0);
                handleScheduleFollowUp(d.toISOString(), "Today 4:00 PM");
              }}
              disabled={!isLeadRow}
            />
            <DispositionButton
              label="Tomorrow (10am)"
              onClick={() => {
                const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
                handleScheduleFollowUp(d.toISOString(), "Tomorrow 10:00 AM");
              }}
              disabled={!isLeadRow}
            />
            <DispositionButton
              label="This Week (Fri 9am)"
              onClick={() => {
                const d = new Date(); const dow = d.getDay();
                const daysUntilFri = (5 - dow + 7) % 7 || 7;
                d.setDate(d.getDate() + daysUntilFri); d.setHours(9, 0, 0, 0);
                handleScheduleFollowUp(d.toISOString(), "This Friday 9:00 AM");
              }}
              disabled={!isLeadRow}
            />
            <DispositionButton
              label="Mark Complete"
              onClick={handleMarkFollowUpComplete}
              disabled={!isLeadRow || !followUpInfo.dueAt || followUpInfo.state === "done"}
            />
            <DispositionButton
              label="Reopen Lead"
              onClick={handleReopenLead}
              disabled={!isLeadRow}
              variant="muted"
            />
          </div>
          {actions.followup?.state === "running" && (
            <div style={{ ...mono, fontSize: 11, color: "#A855F7", marginTop: 8 }}>updating follow-up…</div>
          )}
          {actions.followup?.state === "success" && (
            <div style={{ ...mono, fontSize: 11, color: "#00E6A8", marginTop: 8 }}>✓ {actions.followup.msg}</div>
          )}
          {actions.followup?.state === "error" && (
            <div style={{ ...mono, fontSize: 11, color: "#E05050", marginTop: 8 }}>✗ {actions.followup.msg}</div>
          )}
        </div>

        {/* Stage 5 — Lead Status pipeline (8 steps) */}
        <div style={{ marginTop: 22 }}>
          <div style={{
            ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)",
            letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
            marginBottom: 8, paddingBottom: 6,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>Lead Status</div>
          {pipelineSteps.map(s => (
            <PipelineStep key={s.key} label={s.label} state={s.state} timestamp={s.timestamp} fmtTime={fmtTime} />
          ))}
        </div>

        {/* Stage 5 — Recent Activity feed */}
        <div style={{ marginTop: 18 }}>
          <div style={{
            ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)",
            letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
            marginBottom: 8, paddingBottom: 6,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>Recent Activity</div>
          {recentActivity.length === 0 ? (
            <div style={{
              ...mono, fontSize: 12, color: "rgba(255,255,255,0.35)",
              padding: "10px 0", lineHeight: 1.5,
            }}>
              No activity yet — run an action below to begin.
            </div>
          ) : (
            recentActivity.map(a => (
              <div key={a.key} style={{
                display: "grid", gridTemplateColumns: "10px 1fr auto",
                alignItems: "center", gap: 10,
                padding: "7px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: a.state === "failed" ? "#E05050" : "#00E6A8",
                  boxShadow: `0 0 6px ${a.state === "failed" ? "#E05050" : "#00E6A8"}50`,
                  marginLeft: 2,
                }} />
                <span style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{a.label}</span>
                <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.40)" }}>{fmtTime(a.timestamp)}</span>
              </div>
            ))
          )}
        </div>

        {/* Stage 6 — Disposition pill + quick-action buttons */}
        <div style={{ marginTop: 18 }}>
          <div style={{
            ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)",
            letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700,
            marginBottom: 8, paddingBottom: 6,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>Outcome / Disposition</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Current:</span>
            <span style={{
              padding: "4px 10px",
              background: `${dispositionMeta.color}1A`,
              border: `1px solid ${dispositionMeta.color}66`,
              borderRadius: 4, color: dispositionMeta.color,
              fontSize: 11, fontWeight: 700, letterSpacing: 1, ...mono,
            }}>{dispositionMeta.label}</span>
            {actions.disposition?.state === "running" && (
              <span style={{ ...mono, fontSize: 11, color: "#A855F7" }}>updating…</span>
            )}
            {actions.disposition?.state === "error" && (
              <span style={{ ...mono, fontSize: 11, color: "#E05050" }}>✗ {actions.disposition.msg}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <DispositionButton label="Mark Callback"          onClick={() => handleDisposition("callback",       "Callback Requested")}   disabled={!isLeadRow} />
            <DispositionButton label="Mark Interested"        onClick={() => handleDisposition("interested",     "Interested")}            disabled={!isLeadRow} />
            <DispositionButton label="Mark Not Interested"    onClick={() => handleDisposition("not-interested", "Not Interested")}        disabled={!isLeadRow} variant="danger" />
            <DispositionButton label="Schedule Appointment"   onClick={() => handleDisposition("pending-sign",   "Appointment Scheduled")} disabled={!isLeadRow} />
            <DispositionButton label="Reset to Active"        onClick={() => handleDisposition("new",            "No Response (reset)")}   disabled={!isLeadRow} variant="muted" />
          </div>
        </div>

        {/* Stage 6 — Next Recommended Action */}
        <div style={{
          marginTop: 16,
          padding: "12px 14px",
          background: `${nextRecommendedAction.color}10`,
          border: `1px solid ${nextRecommendedAction.color}44`,
          borderRadius: 8,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{
            ...mono, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
            textTransform: "uppercase", color: nextRecommendedAction.color,
            padding: "3px 8px",
            background: `${nextRecommendedAction.color}22`,
            border: `1px solid ${nextRecommendedAction.color}55`,
            borderRadius: 3, whiteSpace: "nowrap",
          }}>Next ▸</span>
          <span style={{
            ...mono, fontSize: 13, fontWeight: 600,
            color: "rgba(255,255,255,0.9)",
          }}>{nextRecommendedAction.text}</span>
        </div>

        {/* Action buttons — Stage 1 (skip-trace, sms, call) +
            Stage 2 Refresh + Stage 3 Convert + Stage 4 Assign Adjuster.
            Disabled on incident rows (FireIncident UUID would 404 on lead endpoints).
            Assign Adjuster also requires a successful Convert first (need claim_id). */}
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <ActionButton idle="Run Skip Trace"     state={actions.skip}    onClick={handleSkipTrace}  disabled={!isLeadRow} title={!isLeadRow ? "Incident row — convert to lead first" : undefined} />
          <ActionButton idle="Send SMS"           state={actions.sms}     onClick={handleSendSms}    disabled={!isLeadRow} title={!isLeadRow ? "Incident row — convert to lead first" : undefined} />
          <ActionButton idle="Call with Marcus"   state={actions.call}    onClick={handleCallMarcus} disabled={!isLeadRow} title={!isLeadRow ? "Incident row — convert to lead first" : undefined} />
          <ActionButton idle="Convert to Client"  state={actions.convert} onClick={handleConvert}    disabled={!isLeadRow} title={!isLeadRow ? "Incident row — convert to lead first" : "Creates Client + initial Claim in one call"} />
          <ActionButton
            idle="Assign Adjuster"
            state={actions.assign}
            onClick={openAdjusterPicker}
            disabled={!isLeadRow || !convertResult?.claim_id}
            title={
              !isLeadRow ? "Incident row — convert to lead first"
              : !convertResult?.claim_id ? "Run Convert first to create the claim"
              : "Assign an adjuster user to this claim"
            }
          />
          <ActionButton idle={refreshing ? "Refreshing…" : "↻ Refresh"} state={undefined} onClick={refreshLead} disabled={!isLeadRow || refreshing} title={!isLeadRow ? "Incident row — convert to lead first" : "Re-fetch lead + skip-trace"} />
        </div>

        {/* Stage 7 — Assign-to-User picker (cp/rvp/agent/adjuster merged). */}
        {assignModalOpen && (
          <div
            onClick={() => setAssignModalOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1100,
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
                border: "1px solid rgba(0,230,168,0.30)",
                borderRadius: 12, padding: "22px 26px",
                width: 480, maxWidth: "92vw", maxHeight: "70vh", overflow: "auto",
                boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h4 style={{ ...mono, color: "#fff", fontSize: 16, margin: 0, letterSpacing: 0.5 }}>
                  Assign Lead to User
                </h4>
                <button
                  onClick={() => setAssignModalOpen(false)}
                  aria-label="Close"
                  style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}
                >×</button>
              </div>
              <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Lead {String(lead.ref_number || lead.id).slice(0, 16)}
              </div>
              {assignableUsers === null ? (
                <div style={{ ...mono, color: C.muted, padding: "20px 0" }}>Loading users…</div>
              ) : assignableUsers.length === 0 ? (
                <div style={{ ...mono, color: "#E05050", fontSize: 13, padding: "14px 0", lineHeight: 1.6 }}>
                  No assignable users found in the database (CP / RVP / Agent / Adjuster).
                </div>
              ) : (
                <select
                  value={pickedAssigneeId}
                  onChange={(e) => setPickedAssigneeId(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", marginBottom: 16,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: 6, color: "#fff", fontSize: 13, ...mono,
                  }}
                >
                  <option value="">— Select user —</option>
                  {assignableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {`${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.id}
                      {u.email ? ` (${u.email})` : ""}
                      {u._role_hint ? ` — ${u._role_hint.toUpperCase()}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={() => setAssignModalOpen(false)}
                  style={{
                    ...mono, padding: "8px 14px", background: "transparent",
                    border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6,
                    color: "rgba(255,255,255,0.65)", fontSize: 12, cursor: "pointer",
                  }}
                >Cancel</button>
                <button
                  onClick={handleAssignToUser}
                  disabled={!pickedAssigneeId || (assignableUsers && assignableUsers.length === 0) || actions.ownership?.state === "running"}
                  style={{
                    ...mono, padding: "8px 14px",
                    background: !pickedAssigneeId ? "rgba(255,255,255,0.06)" : "rgba(0,230,168,0.12)",
                    border: `1px solid ${!pickedAssigneeId ? "rgba(255,255,255,0.18)" : "rgba(0,230,168,0.45)"}`,
                    borderRadius: 6,
                    color: !pickedAssigneeId ? "rgba(255,255,255,0.4)" : "#00E6A8",
                    fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                    cursor: !pickedAssigneeId ? "not-allowed" : "pointer",
                  }}
                >
                  {actions.ownership?.state === "running" ? "Assigning…" : "Assign"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Adjuster picker — modal-on-modal. Renders only when openAdjusterPicker fires. */}
        {adjusterModalOpen && (
          <div
            onClick={() => setAdjusterModalOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1100,
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
                border: "1px solid rgba(0,230,168,0.30)",
                borderRadius: 12, padding: "22px 26px",
                width: 480, maxWidth: "92vw", maxHeight: "70vh", overflow: "auto",
                boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h4 style={{ ...mono, color: "#fff", fontSize: 16, margin: 0, letterSpacing: 0.5 }}>
                  Assign Adjuster
                </h4>
                <button
                  onClick={() => setAdjusterModalOpen(false)}
                  aria-label="Close"
                  style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}
                >×</button>
              </div>
              <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Claim {convertResult?.claim_id ? String(convertResult.claim_id).slice(0, 8) + "…" : "(none)"}
              </div>
              {adjusters === null ? (
                <div style={{ ...mono, color: C.muted, padding: "20px 0" }}>Loading adjusters…</div>
              ) : adjusters.length === 0 ? (
                <div style={{ ...mono, color: "#E05050", fontSize: 13, padding: "14px 0", lineHeight: 1.6 }}>
                  No users with role=adjuster in the database. Seed at least one adjuster user
                  (same flow as <code style={{ color: C.gold }}>admin@rin.local</code>) before assigning.
                </div>
              ) : (
                <select
                  value={pickedAdjusterId}
                  onChange={(e) => setPickedAdjusterId(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", marginBottom: 16,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: 6, color: "#fff", fontSize: 13, ...mono,
                  }}
                >
                  <option value="">— Select adjuster —</option>
                  {adjusters.map(a => (
                    <option key={a.id} value={a.id}>
                      {`${a.first_name || ""} ${a.last_name || ""}`.trim() || a.email || a.id}
                      {a.email ? ` (${a.email})` : ""}
                    </option>
                  ))}
                </select>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={() => setAdjusterModalOpen(false)}
                  style={{
                    ...mono, padding: "8px 14px", background: "transparent",
                    border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6,
                    color: "rgba(255,255,255,0.65)", fontSize: 12, cursor: "pointer",
                  }}
                >Cancel</button>
                <button
                  onClick={handleAssignAdjuster}
                  disabled={!pickedAdjusterId || (adjusters && adjusters.length === 0) || actions.assign?.state === "running"}
                  style={{
                    ...mono, padding: "8px 14px",
                    background: !pickedAdjusterId ? "rgba(255,255,255,0.06)" : "rgba(0,230,168,0.12)",
                    border: `1px solid ${!pickedAdjusterId ? "rgba(255,255,255,0.18)" : "rgba(0,230,168,0.45)"}`,
                    borderRadius: 6,
                    color: !pickedAdjusterId ? "rgba(255,255,255,0.4)" : "#00E6A8",
                    fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                    cursor: !pickedAdjusterId ? "not-allowed" : "pointer",
                  }}
                >
                  {actions.assign?.state === "running" ? "Assigning…" : "Assign"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// State-aware action button — shows idle label / "Running…" / "✓ <msg>" / "✗ <msg>".
function ActionButton({ idle, state, onClick, disabled, title }) {
  const s = state?.state || "idle";
  const label =
    s === "running" ? "Running…" :
    s === "success" ? `✓ ${state.msg || "Done"}` :
    s === "error"   ? `✗ ${state.msg || "Failed"}` :
    idle;
  const tone =
    s === "running" ? { color: "#A855F7", border: "rgba(168,85,247,0.40)", bg: "rgba(168,85,247,0.10)" } :
    s === "success" ? { color: "#00E6A8", border: "rgba(0,230,168,0.45)",  bg: "rgba(0,230,168,0.12)" } :
    s === "error"   ? { color: "#E05050", border: "rgba(224,80,80,0.45)",  bg: "rgba(224,80,80,0.12)" } :
                      { color: "#fff",    border: "rgba(255,255,255,0.18)", bg: "rgba(255,255,255,0.04)" };
  const isDisabled = disabled || s === "running";
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      style={{
        ...mono,
        padding: "10px 16px",
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 8,
        color: tone.color,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.5,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.45 : 1,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// BannerCell — one of 4 cells in the at-a-glance status banner at the
// top of the detail panel. Compact, color-coded, no hover state.
function BannerCell({ label, value, color, emphasis }) {
  const valueColor =
    emphasis === "warn"  ? "#E05050" :
    emphasis === "self"  ? "#00E6A8" :
    color                ? color :
                           "#FFFFFF";
  return (
    <div>
      <div style={{
        ...mono, fontSize: 9, fontWeight: 700, letterSpacing: 1.4,
        textTransform: "uppercase", color: "rgba(255,255,255,0.40)",
      }}>{label}</div>
      <div style={{
        ...mono, fontSize: 13, color: valueColor, fontWeight: 600,
        marginTop: 2, lineHeight: 1.3,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{value || "—"}</div>
    </div>
  );
}

// DispositionButton — compact secondary button for Stage 6 disposition
// quick-actions. Matches existing ClaimRush palette: green for positive,
// red for closing, muted for reset.
function DispositionButton({ label, onClick, disabled, variant }) {
  const tone =
    variant === "danger" ? { color: "#E05050", border: "rgba(224,80,80,0.40)", bg: "rgba(224,80,80,0.08)" } :
    variant === "muted"  ? { color: "rgba(255,255,255,0.55)", border: "rgba(255,255,255,0.18)", bg: "rgba(255,255,255,0.03)" } :
                           { color: "#00E6A8", border: "rgba(0,230,168,0.40)", bg: "rgba(0,230,168,0.08)" };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...mono,
        padding: "6px 12px",
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 6,
        color: tone.color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// PipelineStep — one row of the Lead Status timeline. Pure-presentational;
// data derived in LeadDetailPanel. Color-coded by state with a clean monospace
// label + timestamp.
function PipelineStep({ label, state, timestamp, fmtTime }) {
  const tone =
    state === "done"    ? { color: "#00E6A8", icon: "✓", labelColor: "#FFFFFF", bold: 600 } :
    state === "failed"  ? { color: "#E05050", icon: "✗", labelColor: "#FFFFFF", bold: 600 } :
    state === "pending" ? { color: "#A855F7", icon: "◐", labelColor: "#FFFFFF", bold: 500 } :
                          { color: "rgba(255,255,255,0.30)", icon: "○",
                            labelColor: "rgba(255,255,255,0.45)", bold: 500 };
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "20px 1fr auto",
      alignItems: "center", gap: 12,
      padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <span style={{
        ...mono, fontSize: 14, color: tone.color, fontWeight: 700,
        textAlign: "center",
      }}>{tone.icon}</span>
      <span style={{
        ...mono, fontSize: 12, color: tone.labelColor,
        fontWeight: tone.bold, letterSpacing: 0.3,
      }}>{label}</span>
      <span style={{
        ...mono, fontSize: 11,
        color: state === "notyet" ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.55)",
      }}>{timestamp ? fmtTime(timestamp) : "Not yet"}</span>
    </div>
  );
}

function DetailRow({ label, value, color, mono: useMono }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", gap: 16,
    }}>
      <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
      <span style={{
        ...mono, fontSize: useMono ? 11 : 13,
        color: color || "#fff", fontWeight: 600,
        textAlign: "right", wordBreak: "break-all",
      }}>{value}</span>
    </div>
  );
}

function FilterChip({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        background: active ? `${color}22` : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? color + "88" : "rgba(255,255,255,0.10)"}`,
        borderRadius: 999,
        color: active ? color : "rgba(255,255,255,0.70)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.5,
        cursor: "pointer",
        transition: "all 0.15s",
        ...mono,
      }}
    >
      {label}
    </button>
  );
}

function LeadRow({ lead, onClick }) {
  const peril = perilMeta(lead.peril);
  const status = statusPill(lead.status);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(); } }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,230,168,0.40)";
        e.currentTarget.style.background = "rgba(0,230,168,0.04)";
        e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,230,168,0.15), 0 8px 24px rgba(0,0,0,0.35)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
        e.currentTarget.style.boxShadow = "none";
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        alignItems: "center",
        gap: 16,
        padding: "14px 18px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}>
      {/* Peril icon */}
      <div style={{
        width: 40, height: 40,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${peril.color}18`,
        border: `1px solid ${peril.color}33`,
        borderRadius: 10,
        fontSize: 20,
      }}>
        {peril.icon}
      </div>

      {/* Info */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", ...mono, letterSpacing: 0.5 }}>
          Lead #{lead.ref_number}
          {lead.insurance_company && (
            <span style={{ fontWeight: 400, color: C.muted, marginLeft: 8 }}>
              · {lead.insurance_company}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3, ...mono }}>
          {lead.agent_name || "Unassigned"} · {lead.days_open} day{lead.days_open === 1 ? "" : "s"} open
        </div>
      </div>

      {/* Peril label (compact) */}
      <div style={{
        padding: "4px 10px",
        background: `${peril.color}12`,
        border: `1px solid ${peril.color}30`,
        borderRadius: 6,
        color: peril.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        ...mono,
      }}>
        {peril.label.toUpperCase()}
      </div>

      {/* Status pill */}
      <div style={{
        padding: "4px 10px",
        background: `${status.color}12`,
        border: `1px solid ${status.color}40`,
        borderRadius: 6,
        color: status.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        ...mono,
      }}>
        {status.label}
      </div>
    </div>
  );
}

function EmptyState({ hasAnyLeads = false, hasFilter = false }) {
  // Distinguish three cases so the message matches reality:
  //   1. Account has no leads at all          → "No fire leads available …"
  //   2. Account has leads, filter excludes   → "No homeowner cases match …"
  //   3. Account has leads, "All" selected    → fall through to (1) — likely
  //      a transient race; "All" with rows visible would never reach here.
  const isFilteredOut = hasAnyLeads && hasFilter;
  const title = isFilteredOut
    ? "No homeowner cases match your current filter."
    : "No fire leads available for this account yet.";
  const sub = isFilteredOut
    ? "Try a different peril filter or pick \"All\"."
    : "Once new fire incidents are dispatched in your territory, they'll appear here automatically.";

  return (
    <div style={{
      textAlign: "center",
      padding: "60px 24px",
      background: "rgba(255,255,255,0.02)",
      border: "1px dashed rgba(255,255,255,0.14)",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{isFilteredOut ? "🔍" : "📂"}</div>
      <div style={{ ...mono, fontSize: 14, color: C.white, fontWeight: 700, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: C.muted, maxWidth: 440, margin: "0 auto", lineHeight: 1.5 }}>
        {sub}
      </div>
    </div>
  );
}
