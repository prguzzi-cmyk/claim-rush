import { Component, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { C } from "./theme";

// Local ErrorBoundary for the LeadDetailPanel. The panel renders a lot of
// computed values from a freshly-fetched Lead row whose fields may be
// null on manually-created leads (no peril, no loss_date, no contact
// alt fields, etc.). A render-time TypeError inside the panel would
// otherwise bubble to the top-level ErrorBoundary in main.jsx and
// blank the entire page with "Something went wrong." Containing the
// failure here keeps the Fire Leads list usable, gives the user a way
// to close, and surfaces the actual error message + stack to DevTools.
class LeadDetailErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[LeadDetailPanel render crash]", error, info);
  }
  componentDidUpdate(prevProps) {
    // Reset the boundary when the user opens a different lead — without
    // this, once the boundary fires, the panel stays in fallback mode
    // for every subsequent click.
    if (prevProps.leadId !== this.props.leadId && this.state.error) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      const { onClose } = this.props;
      const msg = (this.state.error && this.state.error.message) || String(this.state.error);
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
              border: "1px solid rgba(224,80,80,0.45)",
              borderRadius: 12, padding: "22px 26px",
              width: 480, maxWidth: "92vw",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
              fontFamily: "'Courier New', monospace",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h4 style={{ color: "#fff", fontSize: 16, margin: 0, letterSpacing: 0.5 }}>
                Lead detail failed to render
              </h4>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}
              >×</button>
            </div>
            <div style={{
              padding: "10px 12px",
              background: "rgba(224,80,80,0.10)",
              border: "1px solid rgba(224,80,80,0.30)",
              borderRadius: 6,
              color: "#E05050",
              fontSize: 12,
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}>
              <strong>Error:</strong> {msg}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 12, lineHeight: 1.5 }}>
              The Fire Leads list is still usable — close this dialog to continue. The full stack
              has been logged to the browser console (DevTools → Console).
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button
                onClick={onClose}
                style={{
                  padding: "8px 14px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 6,
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >Close</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <div style={{
      maxWidth: 1100,
      position: "relative",
    }}>
      {/* Cinematic ambient backdrop — radial green wash anchored top-left,
          subtle so it never competes with content. */}
      <div style={{
        position: "absolute", top: -120, left: -120,
        width: 480, height: 480,
        background: "radial-gradient(circle, rgba(0,230,168,0.06) 0%, transparent 65%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />
      <div style={{
        position: "absolute", top: 200, right: -160,
        width: 420, height: 420,
        background: "radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 65%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />
      {/* Live animation keyframes — mounted once, used across queue cards
          and the detail panel for pulse + glow oscillation. */}
      <style>{`
        @keyframes liveDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.82); }
        }
        @keyframes edgeGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes leadCardEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes accentSweep {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.25); }
        }
        /* Lead-card hover affordance — chevron brightens + slides right
           on parent hover so operators see the click target moving. */
        .leadrow-card { --cta-color: rgba(255,255,255,0.22); --cta-x: 0px; }
        .leadrow-card:hover { --cta-color: #00E6A8; --cta-x: 3px; }
      `}</style>

      <div style={{ position: "relative", zIndex: 1 }}>

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
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, margin: "6px 0 4px" }}>
          <h1 style={{
            ...mono, fontSize: 28, color: "#fff", fontWeight: 800,
            margin: 0, letterSpacing: -0.5,
            textShadow: "0 0 24px rgba(0,230,168,0.20)",
          }}>
            FIRE LEADS
          </h1>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 9px",
            background: "rgba(0,230,168,0.10)",
            border: "1px solid rgba(0,230,168,0.32)",
            borderRadius: 4,
            fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
            color: "#00E6A8", ...mono,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3,
              background: "#00E6A8",
              boxShadow: "0 0 8px rgba(0,230,168,0.85)",
              animation: "liveDotPulse 1.6s ease-in-out infinite",
            }} />
            LIVE
          </span>
        </div>
        <div style={{ color: C.muted, fontSize: 13, ...mono, letterSpacing: 0.3 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
      <LeadDetailErrorBoundary
        leadId={selectedLead?.id || null}
        onClose={() => setSelectedLead(null)}
      >
        <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
      </LeadDetailErrorBoundary>

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
  // Inline composer modals — replace window.prompt() for SMS + AI call.
  const [smsComposerOpen, setSmsComposerOpen] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [callComposerOpen, setCallComposerOpen] = useState(false);
  const [callPhone, setCallPhone] = useState("");
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
      // GET /v1/leads/{id}/skip-trace not yet in production backend (404).
      // Existing fallbacks already handle a null trace (Owner Contact panel
      // shows "no contact data yet" hint, phone/owner fall back to
      // detail.contact). Re-enable when backend ships:
      //   apiJson(`/leads/${lead.id}/skip-trace`)
      Promise.resolve(null),
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

  // Action 2 — Send SMS via Communications Hub (queued, opt-out aware).
  // Opens the composer modal; actual send fires from confirmSendSms().
  const SMS_DEFAULT_MSG = "Hi, this is UPA. We noticed a fire incident at your property. We help homeowners with insurance claims at no upfront cost. Reply YES to learn more.";
  const handleSendSms = () => {
    if (!guardLeadRow("sms")) return;
    setSmsBody(SMS_DEFAULT_MSG);
    setSmsComposerOpen(true);
  };
  const confirmSendSms = async () => {
    const message = smsBody.trim();
    if (!message) return;
    setSmsComposerOpen(false);
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

  // Action 3 — Call with Marcus (AI voice outreach via VAPI).
  // Opens the composer modal; actual call fires from confirmCallMarcus().
  const handleCallMarcus = () => {
    if (!guardLeadRow("call")) return;
    setCallPhone(phoneNumber || "");
    setCallComposerOpen(true);
  };
  const confirmCallMarcus = async () => {
    const phone_number = callPhone.trim();
    if (!phone_number) return;
    setCallComposerOpen(false);
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
          borderTop: "3px solid #00E6A8",
          borderRadius: 12, padding: "26px 30px",
          width: 560, maxWidth: "92vw", maxHeight: "88vh", overflow: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.70), 0 0 80px rgba(0,230,168,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 4,
              background: "#00E6A8",
              boxShadow: "0 0 10px rgba(0,230,168,0.85), 0 0 20px rgba(0,230,168,0.40)",
              animation: "liveDotPulse 1.6s ease-in-out infinite",
              display: "inline-block", flexShrink: 0,
            }} />
            <h3 style={{
              ...mono, color: "#fff", fontSize: 22, fontWeight: 800,
              margin: 0, letterSpacing: 0.8,
              textShadow: "0 0 20px rgba(0,230,168,0.20)",
            }}>
              LEAD #{lead.ref_number}
            </h3>
            <span style={{
              ...mono, fontSize: 9, fontWeight: 800,
              letterSpacing: 1.5, textTransform: "uppercase",
              color: "rgba(255,255,255,0.45)",
              padding: "2px 7px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 3,
            }}>OPS PANEL</span>
            {/* AXIS monitoring chip — atmospheric AI presence cue. */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              ...mono, fontSize: 9, fontWeight: 800,
              letterSpacing: 1.5, textTransform: "uppercase",
              color: "#A855F7",
              padding: "2px 8px",
              background: "rgba(168,85,247,0.10)",
              border: "1px solid rgba(168,85,247,0.40)",
              borderRadius: 3,
              boxShadow: "0 0 10px rgba(168,85,247,0.20)",
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: 3,
                background: "#A855F7",
                boxShadow: "0 0 6px rgba(168,85,247,0.85)",
                animation: "liveDotPulse 1.6s ease-in-out infinite",
                display: "inline-block",
              }} />
              AXIS · MONITORING
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Stage 9 — At-a-glance status banner. 4 high-signal facts in one row.
            CP-style: status-encoded top accent + ambient glow + slight
            elevation. The accent color is driven by follow-up urgency so
            overdue is red, today is gold, complete is green. */}
        {(() => {
          const banner =
            followUpInfo.state === "overdue" ? { accent: "#E05050", border: "rgba(224,80,80,0.45)" } :
            followUpInfo.state === "today"   ? { accent: "#C9A84C", border: "rgba(201,168,76,0.45)" } :
            (followUpInfo.state === "done" || currentStatus === "converted")
                                             ? { accent: "#00E6A8", border: "rgba(0,230,168,0.30)" } :
                                               { accent: null,      border: "rgba(255,255,255,0.08)" };
          return (
            <div style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              padding: "12px 14px",
              marginBottom: 16,
              background: "rgba(255,255,255,0.035)",
              border: `1px solid ${banner.border}`,
              borderRadius: 8,
              boxShadow: banner.accent ? `0 0 18px ${banner.accent}1f` : "none",
              overflow: "hidden",
            }}>
              {banner.accent && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: banner.accent,
                  boxShadow: `0 0 10px ${banner.accent}80`,
                  pointerEvents: "none",
                }} />
              )}
              <BannerCell label="Owner"         value={ownerInfo.name}                emphasis={ownerInfo.isMe ? "self" : (ownerInfo.name === "Unassigned" ? "warn" : null)} />
              <BannerCell label="Stage"         value={dispositionMeta.label}         color={dispositionMeta.color} />
              <BannerCell label="Follow-Up"     value={followUpInfo.label}            color={followUpInfo.color} />
              <BannerCell label="Last Activity" value={detail?.updated_at ? fmtTime(detail.updated_at) : "—"} />
            </div>
          );
        })()}

        {/* Stalled indicator — surfaces inactivity older than 7 days */}
        {(() => {
          if (!detail?.updated_at) return null;
          const idleDays = Math.floor((Date.now() - new Date(detail.updated_at).getTime()) / 86400000);
          if (idleDays < 7 || currentStatus === "converted" || currentStatus === "closed") return null;
          return (
            <div style={{
              position: "relative",
              padding: "10px 14px 10px 16px", marginBottom: 14,
              background: "linear-gradient(135deg, rgba(224,80,80,0.10) 0%, rgba(224,80,80,0.025) 100%)",
              border: "1px solid rgba(224,80,80,0.40)",
              borderRadius: 8,
              ...mono, fontSize: 11, color: "#E05050",
              display: "flex", alignItems: "center", gap: 10,
              overflow: "hidden",
              boxShadow: "0 0 18px rgba(224,80,80,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: "#E05050",
                boxShadow: "0 0 8px rgba(224,80,80,0.85)",
                pointerEvents: "none",
              }} />
              <span style={{
                width: 7, height: 7, borderRadius: 4,
                background: "#E05050",
                boxShadow: "0 0 8px rgba(224,80,80,0.85)",
                animation: "liveDotPulse 1.6s ease-in-out infinite",
                display: "inline-block", flexShrink: 0,
              }} />
              <span><strong style={{ letterSpacing: 1.2 }}>STALLED</strong> — no activity for {idleDays} days. Consider re-engaging or marking Not Interested.</span>
            </div>
          );
        })()}

        {/* Snapshot stat strip — 3 prominent lead facts in a compact
            mission-control 3-column grid. Each tile has its own status-encoded
            top accent + ambient glow so scan-first key facts read instantly. */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 14,
        }}>
          {[
            { label: "Peril",  value: `${peril.icon} ${peril.label}`, color: peril.color },
            { label: "Status", value: status.label,                   color: status.color },
            { label: "Type",   value: lead.type || "—",                color: null },
          ].map(s => (
            <div key={s.label} style={{
              position: "relative",
              padding: "10px 12px",
              background: s.color
                ? `linear-gradient(135deg, ${s.color}12 0%, ${s.color}03 100%)`
                : "rgba(255,255,255,0.025)",
              border: `1px solid ${s.color ? `${s.color}30` : "rgba(255,255,255,0.08)"}`,
              borderRadius: 8,
              minWidth: 0, overflow: "hidden",
              boxShadow: s.color
                ? `0 4px 12px rgba(0,0,0,0.30), 0 0 14px ${s.color}10`
                : "0 4px 12px rgba(0,0,0,0.30)",
            }}>
              {s.color && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: s.color,
                  boxShadow: `0 0 6px ${s.color}aa`,
                  pointerEvents: "none",
                }} />
              )}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.50)",
                marginBottom: 4,
              }}>
                {s.color && (
                  <span style={{
                    width: 5, height: 5, borderRadius: 3,
                    background: s.color,
                    boxShadow: `0 0 5px ${s.color}aa`,
                    display: "inline-block", flexShrink: 0,
                  }} />
                )}
                {s.label}
              </div>
              <div style={{
                ...mono, fontSize: 14, fontWeight: 800,
                color: s.color || "#FFFFFF",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                letterSpacing: 0.3,
                textShadow: s.color ? `0 0 12px ${s.color}30` : "none",
              }}>
                {s.value || "—"}
              </div>
            </div>
          ))}
        </div>

        {/* CP-style Owner Contact panel — groups skip-trace enrichment
            into one section with a status-encoded top accent + header
            meta. Replaces 5 scattered DetailRows. */}
        {(() => {
          const mailing = [
            trace?.owner_mailing_street,
            trace?.owner_mailing_street2,
            trace?.owner_mailing_city,
            trace?.owner_mailing_state,
            trace?.owner_mailing_zip,
          ].filter(Boolean).join(", ");
          const hasAny = !!(ownerName || phoneNumber || trace?.owner_email || mailing);
          const accent = skipStatus.color;
          return (
            <div style={{
              position: "relative",
              marginTop: 14, marginBottom: 4,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${accent}26`,
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: hasAny ? `0 0 14px ${accent}1a` : "none",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: accent,
                boxShadow: `0 0 8px ${accent}66`,
                pointerEvents: "none",
              }} />
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.025)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: 4,
                    background: accent,
                    boxShadow: `0 0 7px ${accent}aa`,
                    flexShrink: 0,
                    display: "inline-block",
                  }} />
                  <span style={{
                    ...mono, fontSize: 11, fontWeight: 700,
                    letterSpacing: 1.2, textTransform: "uppercase",
                    color: "rgba(255,255,255,0.78)",
                  }}>Owner Contact</span>
                  <span style={{
                    ...mono, fontSize: 10, fontWeight: 700,
                    letterSpacing: 1, textTransform: "uppercase",
                    color: accent,
                  }}>· {skipStatus.label}</span>
                </div>
                {trace?.skiptrace_ran_at && (
                  <span style={{
                    ...mono, fontSize: 10, color: "rgba(255,255,255,0.45)",
                    letterSpacing: 0.4, whiteSpace: "nowrap",
                  }}>
                    ran {fmtTime(trace.skiptrace_ran_at) || trace.skiptrace_ran_at}
                  </span>
                )}
              </div>
              <div style={{ padding: "2px 14px 8px" }}>
                {ownerName && <DetailRow label="Owner" value={ownerName} />}
                {phoneNumber && <DetailRow label="Phone" value={phoneNumber} />}
                {trace?.owner_email && <DetailRow label="Email" value={trace.owner_email} />}
                {mailing && <DetailRow label="Mailing" value={mailing} />}
                {!hasAny && (
                  <div style={{
                    ...mono, fontSize: 12, color: "rgba(255,255,255,0.50)",
                    padding: "10px 0", lineHeight: 1.5,
                  }}>
                    {trace ? "Skip trace ran but returned no contact data." : "No contact data yet — run Skip Trace to enrich."}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <SectionPanel label="Lead Records" color="rgba(255,255,255,0.35)" marginTop={14}>
          <DetailRow label="Assigned to"  value={lead.agent_name || "Unassigned"} />
          <DetailRow label="Days open"    value={String(lead.days_open ?? 0)} />
          {lead.claim_number && <DetailRow label="Claim #" value={lead.claim_number} />}
          {lead.insurance_company && <DetailRow label="Insurance" value={lead.insurance_company} />}
          {lead.policy_number && <DetailRow label="Policy #" value={lead.policy_number} />}
          {lead.loss_date && <DetailRow label="Loss date" value={fmtDate(lead.loss_date)} />}
          {lead.created_at && <DetailRow label="Created" value={fmtDate(lead.created_at)} />}
          <DetailRow label="ID" value={lead.id} mono />
        </SectionPanel>

        {/* Stage 7 — Assigned Owner */}
        <SectionPanel label="Assigned Owner" color="#00E6A8" marginTop={22}>
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
            <DispositionButton label="Take Ownership"   onClick={handleTakeOwnership}      disabled={!isLeadRow || ownerInfo.isMe} variant="primary" />
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
        </SectionPanel>

        {/* Stage 7 — Follow-Up Due */}
        <SectionPanel label="Follow-Up" color="#C9A84C" marginTop={18}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{
              padding: "4px 10px",
              background: `${followUpInfo.color}2e`,
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
        </SectionPanel>

        {/* Stage 5 — Lead Status pipeline (8 steps) */}
        <SectionPanel label="Lead Status" color="#3B82F6" marginTop={22}>
          {pipelineSteps.map((s, i) => (
            <PipelineStep
              key={s.key}
              label={s.label}
              state={s.state}
              timestamp={s.timestamp}
              fmtTime={fmtTime}
              isLast={i === pipelineSteps.length - 1}
            />
          ))}
        </SectionPanel>

        {/* Stage 5 — Recent Activity feed */}
        <SectionPanel label="Recent Activity" color="#00E6A8" marginTop={18}>
          {recentActivity.length === 0 ? (
            <div style={{
              ...mono, fontSize: 12, color: "rgba(255,255,255,0.35)",
              padding: "10px 0", lineHeight: 1.5,
            }}>
              No activity yet — run an action below to begin.
            </div>
          ) : (
            recentActivity.map((a, i) => {
              const dotColor = a.state === "failed" ? "#E05050" : "#00E6A8";
              const isLast = i === recentActivity.length - 1;
              return (
                <div key={a.key} style={{
                  display: "grid", gridTemplateColumns: "14px 1fr auto",
                  alignItems: "stretch", gap: 12,
                  padding: "7px 0",
                }}>
                  {/* Dot + connector column — matches PipelineStep pattern. */}
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    position: "relative",
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: 4,
                      background: dotColor,
                      boxShadow: `0 0 8px ${dotColor}aa, 0 0 14px ${dotColor}40`,
                      flexShrink: 0,
                      zIndex: 2, position: "relative",
                    }} />
                    {!isLast && (
                      <span style={{
                        flex: 1, width: 2,
                        background: `linear-gradient(180deg, ${dotColor}40 0%, rgba(255,255,255,0.06) 100%)`,
                        marginTop: 0, marginBottom: -7,
                      }} />
                    )}
                  </div>
                  <span style={{
                    ...mono, fontSize: 12, color: "rgba(255,255,255,0.85)",
                    alignSelf: "center", letterSpacing: 0.3,
                  }}>{a.label}</span>
                  <span style={{
                    ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)",
                    alignSelf: "center", whiteSpace: "nowrap",
                  }}>{fmtTime(a.timestamp)}</span>
                </div>
              );
            })
          )}
        </SectionPanel>

        {/* Stage 6 — Disposition pill + quick-action buttons */}
        <SectionPanel label="Outcome / Disposition" color="#A855F7" marginTop={18}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Current:</span>
            <span style={{
              padding: "4px 10px",
              background: `${dispositionMeta.color}2e`,
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
        </SectionPanel>

        {/* Stage 6 — Next Recommended Action */}
        <div style={{
          position: "relative",
          marginTop: 16,
          padding: "12px 14px 12px 16px",
          background: `linear-gradient(135deg, ${nextRecommendedAction.color}14 0%, ${nextRecommendedAction.color}03 100%)`,
          border: `1px solid ${nextRecommendedAction.color}44`,
          borderRadius: 8,
          display: "flex", alignItems: "center", gap: 12,
          overflow: "hidden",
          boxShadow: `0 0 18px ${nextRecommendedAction.color}1a, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: nextRecommendedAction.color,
            boxShadow: `0 0 8px ${nextRecommendedAction.color}aa`,
            pointerEvents: "none",
          }} />
          <span style={{
            ...mono, fontSize: 10, fontWeight: 800, letterSpacing: 1.6,
            textTransform: "uppercase", color: nextRecommendedAction.color,
            padding: "3px 9px",
            background: `${nextRecommendedAction.color}26`,
            border: `1px solid ${nextRecommendedAction.color}55`,
            borderRadius: 3, whiteSpace: "nowrap",
            display: "inline-flex", alignItems: "center", gap: 6,
            boxShadow: `0 0 10px ${nextRecommendedAction.color}30`,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: 3,
              background: nextRecommendedAction.color,
              boxShadow: `0 0 6px ${nextRecommendedAction.color}cc`,
              animation: "liveDotPulse 1.6s ease-in-out infinite",
            }} />
            Next ▸
          </span>
          <span style={{
            ...mono, fontSize: 13, fontWeight: 600,
            color: "rgba(255,255,255,0.92)",
            letterSpacing: 0.3,
          }}>{nextRecommendedAction.text}</span>
        </div>

        {/* Action buttons — Stage 1 (skip-trace, sms, call) +
            Stage 2 Refresh + Stage 3 Convert + Stage 4 Assign Adjuster.
            CP-style panel: green top accent + ambient glow + header strip,
            so the operator's action surface feels like a console, not a
            row of generic buttons. Disabled on incident rows. */}
        <div style={{
          position: "relative",
          marginTop: 18,
          background: "rgba(0,230,168,0.03)",
          border: "1px solid rgba(0,230,168,0.18)",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 0 18px rgba(0,230,168,0.10)",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: "#00E6A8",
            boxShadow: "0 0 10px rgba(0,230,168,0.50)",
            pointerEvents: "none",
          }} />
          <div style={{ padding: "12px 14px 14px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 9, marginBottom: 12,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 3,
                background: "#00E6A8",
                boxShadow: "0 0 6px rgba(0,230,168,0.70)",
                display: "inline-block",
              }} />
              <span style={{
                ...mono, fontSize: 11, fontWeight: 700,
                letterSpacing: 1.2, textTransform: "uppercase",
                color: "rgba(255,255,255,0.78)",
              }}>Actions</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
          </div>
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
                borderTop: "3px solid #00E6A8",
                borderRadius: 12, padding: "22px 26px",
                width: 480, maxWidth: "92vw", maxHeight: "70vh", overflow: "auto",
                boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h4 style={{ ...mono, color: "#fff", fontSize: 16, margin: 0, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: "#00E6A8", boxShadow: "0 0 6px rgba(0,230,168,0.70)", display: "inline-block", flexShrink: 0 }} />
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
                borderTop: "3px solid #00E6A8",
                borderRadius: 12, padding: "22px 26px",
                width: 480, maxWidth: "92vw", maxHeight: "70vh", overflow: "auto",
                boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h4 style={{ ...mono, color: "#fff", fontSize: 16, margin: 0, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: "#00E6A8", boxShadow: "0 0 6px rgba(0,230,168,0.70)", display: "inline-block", flexShrink: 0 }} />
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

        {/* SMS composer — replaces window.prompt() for handleSendSms. */}
        {smsComposerOpen && (
          <div
            onClick={() => setSmsComposerOpen(false)}
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
                borderTop: "3px solid #00E6A8",
                borderRadius: 12, padding: "22px 26px",
                width: 540, maxWidth: "92vw", maxHeight: "80vh", overflow: "auto",
                boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h4 style={{ ...mono, color: "#fff", fontSize: 16, margin: 0, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: "#00E6A8", boxShadow: "0 0 6px rgba(0,230,168,0.70)", display: "inline-block", flexShrink: 0 }} />
                  Send SMS
                </h4>
                <button
                  onClick={() => setSmsComposerOpen(false)}
                  aria-label="Close"
                  style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}
                >×</button>
              </div>
              <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Lead #{String(lead.ref_number || lead.id).slice(0, 16)}
              </div>
              <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>
                To: <span style={{ color: "#fff", fontWeight: 600 }}>{phoneNumber || "(no phone on file — backend will use lead contact)"}</span>
              </div>
              {ownerName && (
                <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>
                  Skip-traced owner: <span style={{ color: "#fff" }}>{ownerName}</span>
                </div>
              )}
              <textarea
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                rows={6}
                style={{
                  width: "100%", padding: "10px 12px", marginTop: 4, marginBottom: 6,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 6, color: "#fff", fontSize: 13, ...mono,
                  resize: "vertical", boxSizing: "border-box", lineHeight: 1.5,
                }}
              />
              <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.40)", marginBottom: 12, textAlign: "right" }}>
                {smsBody.length} chars
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={() => setSmsComposerOpen(false)}
                  style={{
                    ...mono, padding: "8px 14px", background: "transparent",
                    border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6,
                    color: "rgba(255,255,255,0.65)", fontSize: 12, cursor: "pointer",
                  }}
                >Cancel</button>
                <button
                  onClick={confirmSendSms}
                  disabled={!smsBody.trim() || actions.sms?.state === "running"}
                  style={{
                    ...mono, padding: "8px 14px",
                    background: !smsBody.trim() ? "rgba(255,255,255,0.06)" : "rgba(0,230,168,0.12)",
                    border: `1px solid ${!smsBody.trim() ? "rgba(255,255,255,0.18)" : "rgba(0,230,168,0.45)"}`,
                    borderRadius: 6,
                    color: !smsBody.trim() ? "rgba(255,255,255,0.4)" : "#00E6A8",
                    fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                    cursor: !smsBody.trim() ? "not-allowed" : "pointer",
                  }}
                >Send SMS</button>
              </div>
            </div>
          </div>
        )}

        {/* Call composer — replaces window.prompt() for handleCallMarcus. */}
        {callComposerOpen && (
          <div
            onClick={() => setCallComposerOpen(false)}
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
                borderTop: "3px solid #00E6A8",
                borderRadius: 12, padding: "22px 26px",
                width: 480, maxWidth: "92vw", maxHeight: "70vh", overflow: "auto",
                boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h4 style={{ ...mono, color: "#fff", fontSize: 16, margin: 0, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: "#00E6A8", boxShadow: "0 0 6px rgba(0,230,168,0.70)", display: "inline-block", flexShrink: 0 }} />
                  Call with Marcus
                </h4>
                <button
                  onClick={() => setCallComposerOpen(false)}
                  aria-label="Close"
                  style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}
                >×</button>
              </div>
              <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Lead #{String(lead.ref_number || lead.id).slice(0, 16)}
              </div>
              {ownerName && (
                <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>
                  Skip-traced owner: <span style={{ color: "#fff" }}>{ownerName}</span>
                </div>
              )}
              <label style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                Phone (E.164, e.g. +12155551234)
              </label>
              <input
                type="tel"
                value={callPhone}
                onChange={(e) => setCallPhone(e.target.value)}
                placeholder="+1…"
                style={{
                  width: "100%", padding: "10px 12px", marginBottom: 16,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 6, color: "#fff", fontSize: 13, ...mono,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={() => setCallComposerOpen(false)}
                  style={{
                    ...mono, padding: "8px 14px", background: "transparent",
                    border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6,
                    color: "rgba(255,255,255,0.65)", fontSize: 12, cursor: "pointer",
                  }}
                >Cancel</button>
                <button
                  onClick={confirmCallMarcus}
                  disabled={!callPhone.trim() || actions.call?.state === "running"}
                  style={{
                    ...mono, padding: "8px 14px",
                    background: !callPhone.trim() ? "rgba(255,255,255,0.06)" : "rgba(0,230,168,0.12)",
                    border: `1px solid ${!callPhone.trim() ? "rgba(255,255,255,0.18)" : "rgba(0,230,168,0.45)"}`,
                    borderRadius: 6,
                    color: !callPhone.trim() ? "rgba(255,255,255,0.4)" : "#00E6A8",
                    fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                    cursor: !callPhone.trim() ? "not-allowed" : "pointer",
                  }}
                >Initiate Call</button>
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
  // CP-style "alive" feedback — non-idle states get a status-tinted glow
  // so operators see at-a-glance which buttons just fired.
  const glow =
    s === "success" ? "0 0 14px rgba(0,230,168,0.30)" :
    s === "running" ? "0 0 14px rgba(168,85,247,0.28)" :
    s === "error"   ? "0 0 14px rgba(224,80,80,0.28)" :
                      "none";
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
        boxShadow: glow,
      }}
    >
      {label}
    </button>
  );
}

// BannerCell — one of 4 cells in the at-a-glance status banner at the
// top of the detail panel. Compact, color-coded, no hover state.
// CP-style section panel — full container with top accent, ambient
// gradient bg, header strip, body padding. Each LeadDetailPanel
// grouping renders inside one of these so the operator sees discrete
// "system panels" instead of flat-stacked sections.
function SectionPanel({ label, color = "#00E6A8", marginTop = 18, children }) {
  return (
    <div style={{
      position: "relative",
      marginTop,
      background: "linear-gradient(180deg, rgba(255,255,255,0.028) 0%, rgba(255,255,255,0.005) 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 4px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px ${color}10`,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: color,
        boxShadow: `0 0 8px ${color}aa`,
        pointerEvents: "none",
      }} />
      <SectionHeader label={label} color={color} />
      <div style={{ padding: "0 14px 14px" }}>
        {children}
      </div>
    </div>
  );
}

// CP-style section header strip — slightly elevated bg + colored accent
// dot + uppercase mono label. Replaces five copy-pasted inline header
// divs in LeadDetailPanel so each grouping reads with the same rhythm.
function SectionHeader({ label, color = "#00E6A8" }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9,
      padding: "8px 12px",
      marginBottom: 10,
      background: "rgba(255,255,255,0.035)",
      borderLeft: `3px solid ${color}`,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "3px 3px 0 0",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 3,
        background: color,
        boxShadow: `0 0 6px ${color}aa`,
        display: "inline-block",
        flexShrink: 0,
      }} />
      <span style={{
        ...mono, fontSize: 11, fontWeight: 700,
        letterSpacing: 1.2, textTransform: "uppercase",
        color: "rgba(255,255,255,0.78)",
      }}>{label}</span>
    </div>
  );
}

function BannerCell({ label, value, color, emphasis }) {
  const valueColor =
    emphasis === "warn"  ? "#E05050" :
    emphasis === "self"  ? "#00E6A8" :
    color                ? color :
                           "#FFFFFF";
  // Cells with semantic color (warn/self/explicit) get a small accent dot
  // before the label for at-a-glance scan; neutral cells stay clean.
  const showDot = !!(emphasis === "warn" || emphasis === "self" || color);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        ...mono, fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
        textTransform: "uppercase", color: "rgba(255,255,255,0.45)",
      }}>
        {showDot && (
          <span style={{
            width: 5, height: 5, borderRadius: 3,
            background: valueColor,
            boxShadow: `0 0 5px ${valueColor}aa`,
            display: "inline-block", flexShrink: 0,
          }} />
        )}
        <span>{label}</span>
      </div>
      <div style={{
        ...mono, fontSize: 16, color: valueColor, fontWeight: 800,
        marginTop: 4, lineHeight: 1.2, letterSpacing: 0.3,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        textShadow: showDot && valueColor !== "#FFFFFF" ? `0 0 14px ${valueColor}40` : "none",
      }}>{value || "—"}</div>
    </div>
  );
}

// DispositionButton — compact secondary button for Stage 6 disposition
// quick-actions. Matches existing ClaimRush palette: green for positive,
// red for closing, muted for reset.
function DispositionButton({ label, onClick, disabled, variant }) {
  const isPrimary = variant === "primary";
  const tone =
    variant === "danger" ? { hex: "#E05050", color: "#E05050",                 border: "rgba(224,80,80,0.45)", bg: "rgba(224,80,80,0.10)" } :
    variant === "muted"  ? { hex: "#FFFFFF", color: "rgba(255,255,255,0.65)",  border: "rgba(255,255,255,0.18)", bg: "rgba(255,255,255,0.04)" } :
    isPrimary            ? { hex: "#00E6A8", color: "#00E6A8",                 border: "rgba(0,230,168,0.60)", bg: "rgba(0,230,168,0.14)" } :
                           { hex: "#00E6A8", color: "#00E6A8",                 border: "rgba(0,230,168,0.45)", bg: "rgba(0,230,168,0.10)" };
  // Primary variant carries permanent ambient glow at rest so it reads
  // as the clear hero CTA among the other disposition actions.
  const restShadow = isPrimary
    ? "0 0 18px rgba(0,230,168,0.22), inset 0 1px 0 rgba(255,255,255,0.06)"
    : "none";
  const hoverShadow = isPrimary
    ? "0 6px 20px rgba(0,0,0,0.45), 0 0 26px rgba(0,230,168,0.45)"
    : variant === "muted"
      ? "0 4px 14px rgba(0,0,0,0.30)"
      : `0 4px 14px rgba(0,0,0,0.30), 0 0 12px ${tone.hex}30`;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={disabled ? undefined : (e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.background = variant === "muted"
          ? "rgba(255,255,255,0.07)"
          : isPrimary ? `${tone.hex}26` : `${tone.hex}1f`;
        e.currentTarget.style.borderColor = variant === "muted"
          ? "rgba(255,255,255,0.30)"
          : `${tone.hex}90`;
        e.currentTarget.style.boxShadow = hoverShadow;
      }}
      onMouseLeave={disabled ? undefined : (e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.background = tone.bg;
        e.currentTarget.style.borderColor = tone.border;
        e.currentTarget.style.boxShadow = restShadow;
      }}
      style={{
        ...mono,
        padding: isPrimary ? "8px 16px" : "7px 13px",
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 6,
        color: tone.color,
        fontSize: isPrimary ? 12 : 11,
        fontWeight: 800,
        letterSpacing: isPrimary ? 1.1 : 0.8,
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
        boxShadow: restShadow,
      }}
    >
      {label}
    </button>
  );
}

// PipelineStep — one node of the Lead Status timeline with a connected
// vertical line. Done steps glow status-colored; the connector line below
// inherits the step's "done" tone so completed segments visibly chain.
function PipelineStep({ label, state, timestamp, fmtTime, isLast }) {
  const tone =
    state === "done"    ? { color: "#00E6A8", icon: "✓", labelColor: "#FFFFFF", bold: 600 } :
    state === "failed"  ? { color: "#E05050", icon: "✗", labelColor: "#FFFFFF", bold: 600 } :
    state === "pending" ? { color: "#A855F7", icon: "◐", labelColor: "#FFFFFF", bold: 500 } :
                          { color: "rgba(255,255,255,0.30)", icon: "○",
                            labelColor: "rgba(255,255,255,0.45)", bold: 500 };
  const isLive = state === "done" || state === "pending" || state === "failed";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "22px 1fr auto",
      alignItems: "stretch", gap: 14,
      padding: "8px 0",
      position: "relative",
    }}>
      {/* Dot + connector column. Connector hides on the last step. */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        position: "relative",
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: 10,
          background: isLive ? `${tone.color}1f` : "rgba(255,255,255,0.025)",
          border: `1.5px solid ${tone.color}`,
          color: tone.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, ...mono,
          boxShadow: isLive
            ? `0 0 10px ${tone.color}66, 0 0 18px ${tone.color}28`
            : "none",
          zIndex: 2, position: "relative", flexShrink: 0,
        }}>{tone.icon}</span>
        {!isLast && (
          <span style={{
            flex: 1, width: 2,
            background: state === "done"
              ? `linear-gradient(180deg, ${tone.color}66 0%, rgba(255,255,255,0.10) 100%)`
              : "rgba(255,255,255,0.07)",
            marginTop: 0, marginBottom: -8,
          }} />
        )}
      </div>
      <span style={{
        ...mono, fontSize: 12, color: tone.labelColor,
        fontWeight: tone.bold, letterSpacing: 0.4,
        alignSelf: "center", paddingTop: 1,
      }}>{label}</span>
      <span style={{
        ...mono, fontSize: 11,
        color: state === "notyet" ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.60)",
        alignSelf: "center", whiteSpace: "nowrap",
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

// CP-style "alive" detection — pulse + glow only fire on in-flight leads.
// Terminal statuses (closed positive or closed negative) get the static accent
// only, so the operator can scan the queue and instantly see what's working.
const TERMINAL_STATUSES = new Set([
  "signed-approved", "not-qualified", "not-interested", "closed",
]);

function LeadRow({ lead, onClick }) {
  const peril = perilMeta(lead.peril);
  const status = statusPill(lead.status);
  const isActive = !TERMINAL_STATUSES.has(lead.status);
  // Multi-shadow base. Hover layers in stronger ring + ambient.
  const baseShadow = `0 6px 18px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04), 0 0 18px ${status.color}1a`;
  const hoverShadow = `0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px ${status.color}33, 0 0 36px ${status.color}30`;
  const baseBg = "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 50%, rgba(255,255,255,0.01) 100%)";
  const hoverBg = `linear-gradient(135deg, ${status.color}10 0%, rgba(255,255,255,0.025) 50%, rgba(255,255,255,0.015) 100%)`;
  return (
    <div
      role="button"
      className="leadrow-card"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(); } }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = `${status.color}59`;
        e.currentTarget.style.background = hoverBg;
        e.currentTarget.style.boxShadow = hoverShadow;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
        e.currentTarget.style.background = baseBg;
        e.currentTarget.style.boxShadow = baseShadow;
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 18,
        padding: "20px 44px 20px 30px",
        background: baseBg,
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        cursor: "pointer",
        transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
        position: "relative",
        overflow: "hidden",
        boxShadow: baseShadow,
        animation: "leadCardEnter 0.4s ease both",
      }}>
      {/* Animated status edge — 5px wide left bar with double-shadow halo.
          Pulses on in-flight leads via @keyframes edgeGlow. */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 5,
        background: status.color,
        boxShadow: `0 0 16px ${status.color}cc, 0 0 28px ${status.color}55`,
        pointerEvents: "none",
        animation: isActive ? "edgeGlow 2.4s ease-in-out infinite" : "none",
      }} />

      {/* Ambient corner glow — radial wash bleeding from top-right,
          colored by status so each card has its own atmosphere. */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 180, height: 180,
        background: `radial-gradient(circle, ${status.color}22 0%, transparent 65%)`,
        pointerEvents: "none",
        opacity: 0.7,
      }} />

      {/* Hover affordance — chevron at far right brightens + slides on
          parent hover via the .leadrow-card:hover CSS variables. */}
      <div style={{
        position: "absolute", right: 14, top: "50%",
        transform: "translateY(-50%) translateX(var(--cta-x, 0px))",
        display: "flex", alignItems: "center", gap: 4,
        fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
        color: "var(--cta-color, rgba(255,255,255,0.22))", ...mono,
        textTransform: "uppercase",
        pointerEvents: "none",
        transition: "color 0.22s, transform 0.22s cubic-bezier(.4,0,.2,1)",
        zIndex: 3,
      }}>
        OPEN ▸
      </div>

      {/* Peril badge — larger, gradient-filled, peril-tinted glow. */}
      <div style={{
        width: 52, height: 52,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(135deg, ${peril.color}28 0%, ${peril.color}10 100%)`,
        border: `1px solid ${peril.color}55`,
        borderRadius: 12,
        fontSize: 24,
        boxShadow: `0 0 18px ${peril.color}30, inset 0 1px 0 rgba(255,255,255,0.08)`,
        position: "relative",
        zIndex: 2,
        flexShrink: 0,
      }}>
        {peril.icon}
      </div>

      {/* Info column — 3-tier typography:
          1) LEAD #ref title (17px bold mono) + LIVE pulse + insurance tag
          2) agent / days-open uppercase metadata line. */}
      <div style={{ minWidth: 0, position: "relative", zIndex: 2 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 11, marginBottom: 6,
          flexWrap: "wrap",
        }}>
          {isActive && (
            <span
              title="Lead in flight"
              style={{
                width: 8, height: 8, borderRadius: 4,
                background: status.color,
                boxShadow: `0 0 10px ${status.color}, 0 0 20px ${status.color}66`,
                display: "inline-block", flexShrink: 0,
                animation: "liveDotPulse 1.6s ease-in-out infinite",
              }}
            />
          )}
          <span style={{
            fontSize: 17, fontWeight: 700, color: "#fff",
            ...mono, letterSpacing: 0.6,
          }}>
            LEAD #{lead.ref_number}
          </span>
          {lead.insurance_company && (
            <span style={{
              fontSize: 10, fontWeight: 700, ...mono,
              color: "rgba(255,255,255,0.65)",
              padding: "2px 8px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 4,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}>
              {lead.insurance_company}
            </span>
          )}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 11,
          fontSize: 11, ...mono, letterSpacing: 0.6,
        }}>
          <span style={{
            color: lead.agent_name ? "rgba(255,255,255,0.65)" : "#E05050",
            fontWeight: 700, textTransform: "uppercase",
          }}>
            {lead.agent_name || "UNASSIGNED"}
          </span>
          <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 13, lineHeight: 1 }}>·</span>
          <span style={{
            color: "rgba(255,255,255,0.55)", fontWeight: 700,
          }}>
            {lead.days_open}D OPEN
          </span>
        </div>
      </div>

      {/* Right column: peril + status pills stacked. CP-form pills
          (rgba bg, no border on status) with glow on the live one. */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 6,
        alignItems: "flex-end", position: "relative", zIndex: 2,
      }}>
        <div style={{
          padding: "3px 10px",
          background: `${peril.color}1a`,
          border: `1px solid ${peril.color}38`,
          borderRadius: 4,
          color: peril.color,
          fontSize: 10, fontWeight: 700, letterSpacing: 1.1,
          ...mono, whiteSpace: "nowrap",
        }}>
          {peril.label.toUpperCase()}
        </div>
        <div style={{
          padding: "3px 10px",
          background: `${status.color}30`,
          borderRadius: 4,
          color: status.color,
          fontSize: 10, fontWeight: 700, letterSpacing: 1.1,
          ...mono, whiteSpace: "nowrap",
          boxShadow: isActive ? `0 0 12px ${status.color}38` : "none",
        }}>
          {status.label}
        </div>
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
