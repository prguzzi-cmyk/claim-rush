export const environment = {
  production: true,
  name: "Prod",
  // TEMPORARY: devAutoLogin in prod for deploy verification only. REVERT before real users.
  devAutoLogin: true,
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
