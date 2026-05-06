/**
 * Stage 8 — Manager Oversight Queue.
 *
 * Surfaces leads at risk of falling through cracks for CP/RVP leadership.
 * Reuses GET /v1/dashboard/cp-leads (CP-scoped via downline + territory;
 * works identically for RVPs since the backend SQL walks manager_id).
 *
 * Six operational lanes:
 *   1. Unassigned Leads          — assigned_to is null
 *   2. Follow-Up Overdue         — follow_up_at < now AND no completion
 *   3. No Contact Attempt        — status='new' AND last_outreach_at null
 *   4. Stale Leads               — updated_at older than 7 days, not converted
 *   5. Interested But Not Conv.  — status in {interested, responded-yes,
 *                                  pending-sign, callback} AND no client_id
 *   6. Converted But No Adjuster — client_id set AND claim_number null
 *
 * NO mock data. Empty queues render an explicit empty state. Every quick
 * action calls existing PUT /v1/leads/{id} with one of the fields wired in
 * earlier stages (assigned_to / status / follow_up_at / etc.).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { C } from "./theme";

const mono = { fontFamily: "'Courier New', monospace" };

const PERIL_ICON = { fire: "🔥", water: "💧", wind: "💨", storm: "⛈️", roof: "🏠", other: "📋" };

const fmtTime = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return "—"; }
};
const daysAgo = (iso) => {
  if (!iso) return null;
  try { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); } catch { return null; }
};

const ENGAGED_STATUSES = new Set(["interested", "responded-yes", "callback", "pending-sign"]);
const CLOSED_STATUSES  = new Set(["not-interested", "not-qualified", "closed", "converted", "signed", "signed-approved"]);

const STALE_DAYS = 7;

export default function ManagerOversight() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeRow, setActiveRow] = useState(null); // tracks which row's action is firing
  const [actionToast, setActionToast] = useState(null); // {state, msg} ephemeral status

  // Pull current user id from cr_user (set during login) for "Take Ownership"
  const currentUserId = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("cr_user") || "{}")?.user_id || null; }
    catch { return null; }
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson("/dashboard/cp-leads");
      const items = Array.isArray(res) ? res : (res?.items || []);
      setLeads(items);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 8][oversight] load failed →", err);
      setError(String(err?.detail || err?.status || err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  // Bucketize into 6 lanes. A single lead can match multiple lanes; we surface
  // it in each so leadership doesn't miss a signal.
  const queues = useMemo(() => {
    const now = Date.now();
    const startOfToday = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
    const sevenDaysAgo = now - STALE_DAYS * 86400000;

    const unassigned = [];
    const followUpOverdue = [];
    const noContact = [];
    const stale = [];
    const interestedNotConverted = [];
    const convertedNoAdjuster = [];

    for (const l of leads) {
      const status = l.status || "new";
      const isClosed = CLOSED_STATUSES.has(status) && status !== "converted";
      const followUpAt = l.follow_up_at ? new Date(l.follow_up_at).getTime() : null;
      const followUpDoneAt = l.follow_up_completed_at ? new Date(l.follow_up_completed_at).getTime() : null;
      const updatedAt = l.updated_at ? new Date(l.updated_at).getTime() : null;
      const lastOutreachAt = l.last_outreach_at ? new Date(l.last_outreach_at).getTime() : null;

      // 1. Unassigned — assigned_to is null AND not closed.
      if (l.is_unassigned && !isClosed) unassigned.push(l);

      // 2. Follow-Up Overdue — follow_up_at < startOfToday AND no completion >= it.
      if (followUpAt && followUpAt < startOfToday && (!followUpDoneAt || followUpDoneAt < followUpAt)) {
        followUpOverdue.push(l);
      }

      // 3. No Contact Attempt — status='new'/'unassigned' AND no last_outreach_at AND not closed.
      if ((status === "new" || status === "unassigned") && !lastOutreachAt && !isClosed) {
        noContact.push(l);
      }

      // 4. Stale Leads — updated_at older than STALE_DAYS, not converted/closed.
      if (updatedAt && updatedAt < sevenDaysAgo && !isClosed && status !== "converted") {
        stale.push(l);
      }

      // 5. Interested But Not Converted — engaged status, no client_id yet.
      if (ENGAGED_STATUSES.has(status) && !l.client_id) {
        interestedNotConverted.push(l);
      }

      // 6. Converted But No Adjuster — client_id is set, claim_number is null
      //    (claim_number is set when claim is filed; if it's still null after
      //    convert, the claim was created but not yet acted on by adjuster).
      // NB: convert always sets BOTH client_id and creates a Claim row, but
      // claim_number on the LEAD row is only set if the claim was reflected
      // back to lead.claim_number. Still a useful "needs handoff" lane.
      if (l.client_id && !l.claim_number) {
        convertedNoAdjuster.push(l);
      }
    }

    return [
      { key: "unassigned",    title: "Unassigned Leads",         tone: "red",    items: unassigned },
      { key: "followup",      title: "Follow-Up Overdue",        tone: "red",    items: followUpOverdue },
      { key: "nocontact",     title: "No Contact Attempt",       tone: "gold",   items: noContact },
      { key: "stale",         title: `Stale Leads (>${STALE_DAYS}d)`, tone: "gold", items: stale },
      { key: "interested",    title: "Interested — Not Converted", tone: "green", items: interestedNotConverted },
      { key: "needsadjuster", title: "Converted — Needs Adjuster", tone: "green", items: convertedNoAdjuster },
    ];
  }, [leads]);

  const totalLeads = leads.length;
  const totalAtRisk = queues.slice(0, 4).reduce((sum, q) => sum + q.items.length, 0);

  // Stage 9 — sticky summary metrics. Each derives from the same in-memory
  // leads array; no extra calls. "Worked Today" = leads whose updated_at
  // falls inside today's local window (i.e., someone touched them today).
  const summaryMetrics = useMemo(() => {
    const startOfToday = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
    const overdueQueue = queues.find(q => q.key === "followup");
    const staleQueue   = queues.find(q => q.key === "stale");
    const adjusterQueue = queues.find(q => q.key === "needsadjuster");
    const workedToday = leads.filter(l => l.updated_at && new Date(l.updated_at).getTime() >= startOfToday).length;
    return [
      { key: "followup",      label: "Overdue",          value: overdueQueue?.items.length || 0,  color: "#E05050", scrollTo: "followup" },
      { key: "stale",         label: "Stale",            value: staleQueue?.items.length || 0,    color: "#C9A84C", scrollTo: "stale" },
      { key: "workedToday",   label: "Worked Today",     value: workedToday,                       color: "#00E6A8", scrollTo: null },
      { key: "needsadjuster", label: "Awaiting Adjuster", value: adjusterQueue?.items.length || 0, color: "#A855F7", scrollTo: "needsadjuster" },
    ];
  }, [leads, queues]);

  // Stage 9 — collapse/expand state per lane. Default: empty lanes
  // collapsed, non-empty expanded — surfaces what needs attention first.
  const [collapsed, setCollapsed] = useState({});
  // Initialize once leads load.
  useEffect(() => {
    if (leads.length === 0) return;
    setCollapsed(prev => {
      const init = { ...prev };
      queues.forEach(q => {
        if (init[q.key] === undefined) init[q.key] = q.items.length === 0;
      });
      return init;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length]);
  const toggleLane = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // Smooth-scroll to a lane when a summary metric is clicked.
  const scrollToLane = (key) => {
    if (!key) return;
    const el = document.getElementById(`oversight-lane-${key}`);
    if (el) {
      // Open the lane if it's collapsed, then scroll into view.
      setCollapsed(prev => ({ ...prev, [key]: false }));
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  // ── Quick actions — each PUT /v1/leads/{id} with the relevant field ──
  const showToast = (state, msg) => {
    setActionToast({ state, msg });
    setTimeout(() => setActionToast(null), 3500);
  };
  const fireAction = async (lead, body, successMsg) => {
    setActiveRow(lead.id);
    try {
      const res = await apiJson(`/leads/${lead.id}`, { method: "PUT", body: JSON.stringify(body) });
      // eslint-disable-next-line no-console
      console.info("[Stage 8][oversight][action]", { lead_id: lead.id, body, response: res });
      showToast("success", successMsg);
      // Re-pull the queue so the lead moves out of the lane.
      await refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Stage 8][oversight][action] error →", err);
      showToast("error", err?.detail || err?.status || "Failed");
    } finally {
      setActiveRow(null);
    }
  };
  const onTakeOwnership = (lead) => {
    if (!currentUserId) { showToast("error", "No user_id in session"); return; }
    if (!window.confirm(`Take ownership of Lead #${lead.ref_number}?`)) return;
    fireAction(lead, { assigned_to: currentUserId }, `You own Lead #${lead.ref_number}`);
  };
  const onMarkFollowUpToday = (lead) => {
    const d = new Date(); d.setHours(16, 0, 0, 0);
    if (!window.confirm(`Schedule follow-up for Lead #${lead.ref_number} today at 4 PM?`)) return;
    fireAction(lead, { follow_up_at: d.toISOString(), follow_up_completed_at: null }, `Follow-up set: today 4pm`);
  };
  const onOpenLead = (lead) => {
    // Routes back to the leads board; clicking the row there opens the panel.
    navigate(`/portal/fire-leads`);
  };

  if (loading) {
    return <div style={{ ...mono, color: C.muted, padding: 40 }}>Loading oversight queue…</div>;
  }
  if (error) {
    return (
      <div style={{ color: "#E05050", ...mono, padding: 40 }}>
        Failed to load: {error}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => navigate("/portal")}
          style={{
            background: "transparent", border: "none", color: C.muted,
            fontSize: 12, cursor: "pointer", padding: "4px 0", letterSpacing: 0.5, ...mono,
          }}
        >← BACK TO COMMAND CENTER</button>
        <h1 style={{ ...mono, fontSize: 22, color: "#fff", fontWeight: 700, margin: "6px 0 4px" }}>
          Manager Oversight Queue
        </h1>
        <div style={{ color: C.muted, fontSize: 13, ...mono }}>
          {totalLeads} lead{totalLeads === 1 ? "" : "s"} in scope ·
          <span style={{ color: totalAtRisk > 0 ? "#E05050" : C.muted, fontWeight: 600 }}> {totalAtRisk} at-risk</span>
        </div>
      </div>

      {/* Stage 9 — sticky summary metrics. Click any tile to jump to the
          corresponding lane (auto-expands if collapsed). */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        marginBottom: 18,
        padding: "12px",
        background: "rgba(13, 21, 38, 0.92)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
      }}>
        {summaryMetrics.map(m => {
          const isClickable = m.scrollTo !== null;
          return (
            <button
              key={m.key}
              onClick={() => isClickable && scrollToLane(m.scrollTo)}
              disabled={!isClickable}
              style={{
                ...mono,
                padding: "10px 14px",
                background: m.value > 0 ? `${m.color}10` : "rgba(255,255,255,0.02)",
                border: `1px solid ${m.value > 0 ? `${m.color}45` : "rgba(255,255,255,0.08)"}`,
                borderRadius: 8,
                cursor: isClickable ? "pointer" : "default",
                textAlign: "left",
                display: "flex", flexDirection: "column", gap: 4,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (isClickable) e.currentTarget.style.background = `${m.color}1A`; }}
              onMouseLeave={e => { if (isClickable) e.currentTarget.style.background = m.value > 0 ? `${m.color}10` : "rgba(255,255,255,0.02)"; }}
            >
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                textTransform: "uppercase",
                color: m.value > 0 ? m.color : "rgba(255,255,255,0.40)",
              }}>{m.label}</span>
              <span style={{
                fontSize: 22, fontWeight: 700,
                color: m.value > 0 ? "#fff" : "rgba(255,255,255,0.55)",
                lineHeight: 1.1,
              }}>{m.value}</span>
            </button>
          );
        })}
      </div>

      {/* Toast */}
      {actionToast && (
        <div style={{
          position: "fixed", top: 80, right: 24, zIndex: 1500,
          padding: "12px 18px", borderRadius: 8,
          background: actionToast.state === "error" ? "rgba(224,80,80,0.15)" : "rgba(0,230,168,0.15)",
          border: `1px solid ${actionToast.state === "error" ? "rgba(224,80,80,0.50)" : "rgba(0,230,168,0.50)"}`,
          color: actionToast.state === "error" ? "#E05050" : "#00E6A8",
          ...mono, fontSize: 12, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {actionToast.state === "error" ? "✗" : "✓"} {String(actionToast.msg)}
        </div>
      )}

      {/* Six queues — column layout, each a card. Collapsible per-lane. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {queues.map(q => (
          <QueueSection
            key={q.key}
            queueKey={q.key}
            title={q.title}
            tone={q.tone}
            items={q.items}
            collapsed={!!collapsed[q.key]}
            onToggle={() => toggleLane(q.key)}
            activeRow={activeRow}
            onTakeOwnership={onTakeOwnership}
            onMarkFollowUpToday={onMarkFollowUpToday}
            onOpenLead={onOpenLead}
          />
        ))}
      </div>

      <div style={{ marginTop: 22, ...mono, fontSize: 11, color: "rgba(255,255,255,0.30)" }}>
        Reassign / Assign Adjuster / Convert to Client are available inside each lead's detail panel
        (open from <a onClick={() => navigate("/portal/fire-leads")}
          style={{ color: "#00E6A8", cursor: "pointer", textDecoration: "underline" }}>Fire Leads</a>).
      </div>
    </div>
  );
}

function QueueSection({ queueKey, title, tone, items, collapsed, onToggle, activeRow, onTakeOwnership, onMarkFollowUpToday, onOpenLead }) {
  const toneColor = tone === "red" ? "#E05050" : tone === "gold" ? "#C9A84C" : "#00E6A8";
  const empty = items.length === 0;
  return (
    <div
      id={`oversight-lane-${queueKey}`}
      style={{
        background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
        border: `1px solid ${empty ? "rgba(255,255,255,0.08)" : `${toneColor}40`}`,
        borderRadius: 10,
        overflow: "hidden",
        scrollMarginTop: 110,  // accounts for sticky summary header
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "12px 18px",
          borderBottom: collapsed ? "none" : `1px solid rgba(255,255,255,0.06)`,
          background: "transparent", border: "none", borderRadius: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", textAlign: "left",
          transition: "background 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            ...mono, fontSize: 11, color: "rgba(255,255,255,0.40)",
            transition: "transform 0.15s", display: "inline-block",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0)",
            width: 14, textAlign: "center",
          }}>▾</span>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: empty ? "rgba(255,255,255,0.15)" : toneColor,
                         boxShadow: empty ? "none" : `0 0 8px ${toneColor}80` }} />
          <span style={{ ...mono, fontSize: 13, color: "#fff", fontWeight: 700, letterSpacing: 0.5 }}>{title}</span>
        </div>
        <span style={{
          padding: "3px 9px",
          background: empty ? "rgba(255,255,255,0.04)" : `${toneColor}1A`,
          border: `1px solid ${empty ? "rgba(255,255,255,0.10)" : `${toneColor}55`}`,
          borderRadius: 999,
          color: empty ? "rgba(255,255,255,0.45)" : toneColor,
          ...mono, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
        }}>
          {items.length}
        </span>
      </button>
      {!collapsed && (empty ? (
        <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.30)", padding: "16px 18px" }}>
          No leads in this lane. ✓
        </div>
      ) : (
        <div>
          {items.map(l => (
            <LeadRow
              key={`${title}-${l.id}`}
              lead={l}
              tone={tone}
              busy={activeRow === l.id}
              onTakeOwnership={() => onTakeOwnership(l)}
              onMarkFollowUpToday={() => onMarkFollowUpToday(l)}
              onOpenLead={() => onOpenLead(l)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function LeadRow({ lead, tone, busy, onTakeOwnership, onMarkFollowUpToday, onOpenLead }) {
  const peril = lead.peril || "other";
  const icon = PERIL_ICON[peril] || PERIL_ICON.other;
  // Severity proxy — days_open + follow-up overdue increases urgency.
  const overdueDays = lead.follow_up_at
    ? Math.max(0, Math.floor((Date.now() - new Date(lead.follow_up_at).getTime()) / 86400000))
    : 0;
  const idleDays = daysAgo(lead.updated_at);

  const ownerLabel = lead.is_unassigned ? "Unassigned" : (lead.agent_name || "—");
  const ownerColor = lead.is_unassigned ? "#E05050" : "#FFFFFF";
  const stageLabel = (lead.status || "new").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "30px 1fr auto auto auto",
      gap: 14, alignItems: "center",
      padding: "12px 18px",
      borderTop: "1px solid rgba(255,255,255,0.04)",
      opacity: busy ? 0.55 : 1,
      transition: "opacity 0.15s",
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>

      <div>
        <div style={{ ...mono, fontSize: 13, color: "#fff", fontWeight: 700 }}>
          Lead #{lead.ref_number}
          <span style={{ color: "rgba(255,255,255,0.40)", fontWeight: 400, marginLeft: 8 }}>
            {peril.toUpperCase()}
          </span>
          {lead.insurance_company && (
            <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 400, marginLeft: 8 }}>
              · {lead.insurance_company}
            </span>
          )}
        </div>
        <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.50)", marginTop: 3 }}>
          Owner: <span style={{ color: ownerColor, fontWeight: 600 }}>{ownerLabel}</span>
          <span style={{ marginLeft: 12 }}>· Stage: {stageLabel}</span>
          {idleDays !== null && (
            <span style={{ marginLeft: 12 }}>
              · {idleDays === 0 ? "active today" : `idle ${idleDays}d`}
            </span>
          )}
        </div>
      </div>

      {/* Follow-up indicator */}
      <span style={{
        ...mono, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        padding: "3px 8px", borderRadius: 4,
        background:
          overdueDays > 0 ? "rgba(224,80,80,0.12)" :
          lead.follow_up_at ? "rgba(168,85,247,0.10)" :
          "rgba(255,255,255,0.04)",
        color:
          overdueDays > 0 ? "#E05050" :
          lead.follow_up_at ? "#A855F7" :
          "rgba(255,255,255,0.40)",
        border:
          overdueDays > 0 ? "1px solid rgba(224,80,80,0.35)" :
          lead.follow_up_at ? "1px solid rgba(168,85,247,0.25)" :
          "1px solid rgba(255,255,255,0.10)",
        whiteSpace: "nowrap",
      }}>
        {overdueDays > 0 ? `OVERDUE +${overdueDays}d` :
         lead.follow_up_at ? `FU ${fmtTime(lead.follow_up_at)}` :
         "NO FOLLOW-UP"}
      </span>

      {/* Last activity */}
      <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
        {fmtTime(lead.updated_at)}
      </span>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <MiniBtn label="Take" onClick={onTakeOwnership} disabled={busy} />
        <MiniBtn label="FU Today" onClick={onMarkFollowUpToday} disabled={busy} />
        <MiniBtn label="Open" onClick={onOpenLead} disabled={busy} variant="muted" />
      </div>
    </div>
  );
}

function MiniBtn({ label, onClick, disabled, variant }) {
  const tone = variant === "muted"
    ? { color: "rgba(255,255,255,0.55)", border: "rgba(255,255,255,0.15)", bg: "rgba(255,255,255,0.03)" }
    : { color: "#00E6A8", border: "rgba(0,230,168,0.40)", bg: "rgba(0,230,168,0.08)" };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...mono,
        padding: "5px 10px",
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 5,
        color: tone.color,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
