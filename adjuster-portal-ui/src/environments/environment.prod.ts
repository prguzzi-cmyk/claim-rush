export const environment = {
  production: true,
  name: "Prod",
  devAutoLogin: false,
  server: "https://accurate-warmth-production-4f18.up.railway.app/v1",
  mlmServer: "https://api.mlm.upaportal.org/",
  checkVersion: true,
  googleMapsApiKey: "",
  jwtAllowedDomains: [
    "rin.aciunited.com",
    "www.aciunited.com",
    "aciunited.com",
    "accurate-warmth-production-4f18.up.railway.app",
  ],
  featureFlags: {
    chatgptEnabled: false,
    // AI Sales Agent demo surfaces are mock/static data only and imply
    // real customer contact they can't actually perform (audit 2026-05-09).
    // Hidden from sidebar AND blocked at the route layer in production
    // until those pages are wired to the real outreach engine + skip-trace
    // pipeline. Flip to TRUE only after that wiring is verified.
    aiSalesAgent: false,
  },
  // TODO: Route OpenAI calls through backend proxy instead of exposing a
  // client-side key. Until that exists, ChatGPT features are gated off in prod
  // via featureFlags.chatgptEnabled. See UPA Assistant placeholder in
  // assistant.component.html.
  openai: {
    organizationId: "",
    apiKey: "",
  },
};
