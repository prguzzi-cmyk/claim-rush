// Shared cinematic page header for portal routes.
// Drop in at the top of any route component to give the screen a
// unified intelligence-platform entry beat. Accent + kicker per route
// so each operational workspace reads with its own identity color
// while sharing the system's visual grammar.
//
// Pattern lives in PortalLayout's mounted @keyframes (liveDotPulse) so
// the pulsing kicker dot animates across every route.

const mono = { fontFamily: "'Courier New', monospace" };

export default function PageHeader({
  title,
  subtitle,
  accent = "#00E6A8",
  kicker,           // small chip text on the left, e.g. "OPERATOR PROFILE"
  chips,            // optional array of <span> elements rendered on the right
  liveDot = true,   // whether the kicker chip pulses
}) {
  return (
    <div style={{
      position: "relative",
      marginBottom: 22,
      padding: "18px 24px 20px",
      background: `linear-gradient(135deg, ${accent}10 0%, ${accent}02 60%, rgba(255,255,255,0.012) 100%)`,
      border: `1px solid ${accent}26`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: `0 6px 22px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 26px ${accent}10`,
    }}>
      {/* Top accent — colored glow bar marks this as an operational workspace */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: accent,
        boxShadow: `0 0 10px ${accent}aa`,
        pointerEvents: "none",
      }} />
      {/* Ambient corner glow */}
      <div style={{
        position: "absolute", top: -50, right: -50,
        width: 200, height: 200,
        background: `radial-gradient(circle, ${accent}1c 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
      {/* Header row */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap",
        marginBottom: subtitle ? 8 : 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {kicker && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 9px",
              background: `${accent}14`,
              border: `1px solid ${accent}42`,
              borderRadius: 3,
              fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
              color: accent, ...mono,
              textTransform: "uppercase",
              boxShadow: `0 0 10px ${accent}1a`,
            }}>
              {liveDot && (
                <span style={{
                  width: 5, height: 5, borderRadius: 3,
                  background: accent,
                  boxShadow: `0 0 6px ${accent}aa`,
                  animation: "liveDotPulse 1.6s ease-in-out infinite",
                  display: "inline-block",
                }} />
              )}
              {kicker}
            </span>
          )}
          <h1 style={{
            ...mono, fontSize: 24, color: "#fff", fontWeight: 800,
            margin: 0, letterSpacing: 0.5,
            textShadow: `0 0 18px ${accent}28`,
            textTransform: "uppercase",
          }}>
            {title}
          </h1>
        </div>
        {chips && chips.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {chips}
          </div>
        )}
      </div>
      {subtitle && (
        <div style={{
          position: "relative", zIndex: 1,
          ...mono, fontSize: 13, color: "rgba(255,255,255,0.62)",
          letterSpacing: 0.3, lineHeight: 1.55,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
