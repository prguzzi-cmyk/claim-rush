// Portal-wide design tokens.
// `muted` and `border` were previously rgba(white, 0.75) / rgba(white, 0.08)
// — that translucent stack made cards feel like they were floating and made
// secondary text read as washed-out. Both are now solid / higher-opacity to
// match the RIN dark-theme tokens (--text-secondary, --border-default) and
// pass WCAG AA contrast on the dark portal surfaces. 94 inline-style
// consumers of `C.muted` benefit automatically.
export const C = {
  black: "#070D18",
  navy: "#0C1222",
  panel: "#121A2B",
  panel2: "#1A2438",
  border: "rgba(255,255,255,0.14)",
  gold: "#C9A84C",
  goldDim: "#8A6E2A",
  red: "#E03030",
  redDim: "#7A1818",
  green: "#22C55E",
  blue: "#2A70D0",
  white: "#FFFFFF",
  muted: "#B0BAC8",
  // Use only for genuinely disabled UI — never for body/label text.
  disabled: "rgba(255,255,255,0.40)",
  cream: "#FFFFFF",
};
