/**
 * Deep-links from ClaimRush into RIN engine pages.
 *
 * Auth handoff: both apps read the JWT from `localStorage.access_token`
 * with the same JSON-stringified shape, so navigating across origins
 * lands the user in RIN already authenticated. No re-login required.
 *
 * Dev:  RIN runs at http://localhost:4200 (Angular ng serve).
 * Prod: set VITE_RIN_URL in the build env (e.g., https://rin.aciunited.com).
 */

const RIN_URL = import.meta.env.VITE_RIN_URL || "http://localhost:4200";

export const ENGINE_LINKS = {
  estimating:  `${RIN_URL}/app/estimating`,
  claims:      `${RIN_URL}/app/claims/search`,
  clients:     `${RIN_URL}/app/clients/search`,
  policyVault: `${RIN_URL}/app/policy-vault`,
  aciAdjuster: `${RIN_URL}/app/adjuster-assistant`,
};

export function openEngine(name) {
  const url = ENGINE_LINKS[name];
  if (url) {
    window.location.href = url;
  }
}
