/**
 * PreviewDataBanner — honest signal that the surface above the fold is
 * displaying sample / preview data rather than live backend records.
 *
 * Why this exists: parts of the ClaimRush portal still render content
 * from hardcoded fixture arrays (fake KPIs, fake names, fake activity
 * feeds) as visual placeholders for surfaces whose backend isn't wired
 * yet. Stripping every fixture array would take days; in the meantime
 * this banner gives expert reviewers an at-a-glance signal of which
 * surfaces are real vs sample so they don't mistake placeholder
 * content for live activity.
 *
 * Usage:
 *   <PreviewDataBanner />
 *   <PreviewDataBanner label="Sample Home Office KPIs — live integration pending" />
 *
 * Remove from a given page once its data source is wired and the
 * fixture arrays are stripped. This is a transitional signal, not a
 * permanent UI element.
 *
 * Mirrors the Angular <app-preview-data-banner> component in
 * adjuster-portal-ui so the visual signal is consistent across both
 * portals.
 */
export default function PreviewDataBanner({ label = "Sample data shown — live integration pending" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        margin: "0 0 12px 0",
        background: "rgba(245, 158, 11, 0.10)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
        borderLeft: "3px solid #f59e0b",
        borderRadius: 4,
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        fontSize: 12,
        lineHeight: 1.4,
        color: "#fde68a",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 14, color: "#fbbf24", flexShrink: 0 }}>&#9432;</span>
      <span
        style={{
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#fbbf24",
          flexShrink: 0,
        }}
      >
        PREVIEW DATA
      </span>
      <span style={{ color: "#fcd34d", opacity: 0.9 }}>{label}</span>
    </div>
  );
}
