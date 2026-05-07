/**
 * OutreachQueueTabs — top-level operational queue selector for Fire Leads.
 *
 * Phase 1 (this commit): visual stub. Tabs render and respond to clicks
 * but do NOT change the leads list. Counts come from the parent (zero
 * until Phase 2 wires the backend endpoint). Selecting a non-default
 * tab shows a small "Phase 2 coming" hint so it's obvious this is
 * stub state, not broken UI.
 *
 * Phase 2: real counts via GET /v1/leads/outreach-queue/stats.
 * Phase 3: list filter + detail-panel state-transition actions.
 *
 * Shown only when the feature flag is on:
 *   localStorage.setItem("cr_outreach_queue_ui", "1")
 * to enable for the current browser; clear or set to anything else
 * to revert to the prior UI. Unset by default so end-users see nothing
 * change until we explicitly enable the flag.
 */

import React from "react";

const mono = {
  fontFamily: "'JetBrains Mono', monospace",
};

// Mirrors app/services/outreach_state.OUTREACH_STATES on the backend.
// Order here is the visual tab order, not the canonical tuple order.
export const PRIMARY_TABS = [
  { state: "READY_TO_CALL",  label: "Call Queue",     color: "#00E6A8" },
  { state: "READY_TO_TEXT",  label: "Text Queue",     color: "#60A5FA" },
  { state: "NEEDS_REVIEW",   label: "Needs Review",   color: "#A855F7" },
  { state: "ASSIGNED",       label: "Assigned",       color: "#F59E0B" },
  { state: "CALLBACK",       label: "Callback",       color: "#EC4899" },
];

export const OVERFLOW_TABS = [
  { state: "APPOINTMENT_SET",        label: "Appointment Set" },
  { state: "SIGNED",                 label: "Signed" },
  { state: "DEAD_LEAD",              label: "Dead Lead" },
  { state: "CP_INTELLIGENCE_REVIEW", label: "CP Intelligence Review" },
];

export const ALL_QUEUE_STATES = [
  ...PRIMARY_TABS.map((t) => t.state),
  ...OVERFLOW_TABS.map((t) => t.state),
];

export function isOutreachQueueUiEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("cr_outreach_queue_ui") === "1";
  } catch {
    return false;
  }
}

export default function OutreachQueueTabs({ selected, counts = {}, onSelect }) {
  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const overflowRef = React.useRef(null);

  // Close overflow on outside click.
  React.useEffect(() => {
    if (!overflowOpen) return;
    const onDoc = (e) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [overflowOpen]);

  const overflowSelected = OVERFLOW_TABS.some((t) => t.state === selected);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
        padding: "10px 12px",
        background: "rgba(15, 23, 42, 0.55)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          ...mono,
          fontSize: 10,
          letterSpacing: 1.5,
          color: "rgba(168, 85, 247, 0.85)",
          textTransform: "uppercase",
          marginRight: 8,
        }}
      >
        Outreach Queue
      </div>

      <Tab
        label="All"
        count={counts.ALL ?? null}
        active={selected === "all" || !selected}
        color="#FFFFFF"
        onClick={() => onSelect && onSelect("all")}
      />

      {PRIMARY_TABS.map((t) => (
        <Tab
          key={t.state}
          label={t.label}
          count={counts[t.state] ?? null}
          active={selected === t.state}
          color={t.color}
          onClick={() => onSelect && onSelect(t.state)}
        />
      ))}

      <div ref={overflowRef} style={{ position: "relative" }}>
        <Tab
          label={`More${overflowSelected ? "•" : ""} ▾`}
          count={null}
          active={overflowSelected}
          color="#94A3B8"
          onClick={() => setOverflowOpen((v) => !v)}
        />
        {overflowOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: 220,
              background: "#0F172A",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
              zIndex: 100,
              padding: 4,
            }}
          >
            {OVERFLOW_TABS.map((t) => {
              const c = counts[t.state] ?? null;
              const isActive = selected === t.state;
              return (
                <button
                  key={t.state}
                  type="button"
                  onClick={() => {
                    onSelect && onSelect(t.state);
                    setOverflowOpen(false);
                  }}
                  style={{
                    ...mono,
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: isActive ? "rgba(148,163,184,0.18)" : "transparent",
                    border: 0,
                    borderRadius: 6,
                    color: "#E2E8F0",
                    fontSize: 11,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{t.label}</span>
                  <span style={{ color: "rgba(148,163,184,0.75)" }}>
                    {c == null ? "—" : c}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && selected !== "all" && (
        <div
          style={{
            ...mono,
            marginLeft: "auto",
            fontSize: 10,
            color: "rgba(251, 191, 36, 0.85)",
            letterSpacing: 0.5,
          }}
          title="Phase 1 — backend endpoint /v1/leads/outreach-queue not wired yet"
        >
          Phase 1 stub · backend coming
        </div>
      )}
    </div>
  );
}

function Tab({ label, count, active, color, onClick }) {
  const dotShown = typeof count === "number";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...mono,
        padding: "6px 12px",
        background: active ? `${color}26` : "rgba(15,23,42,0.45)",
        border: `1px solid ${active ? color : "rgba(148,163,184,0.25)"}`,
        borderRadius: 999,
        color: active ? color : "#CBD5E1",
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        letterSpacing: 0.4,
        cursor: "pointer",
        transition: "all 120ms ease",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>{label}</span>
      {dotShown && (
        <span
          style={{
            background: active ? `${color}33` : "rgba(148,163,184,0.18)",
            color: active ? color : "rgba(203,213,225,0.85)",
            padding: "1px 6px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            minWidth: 16,
            textAlign: "center",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
