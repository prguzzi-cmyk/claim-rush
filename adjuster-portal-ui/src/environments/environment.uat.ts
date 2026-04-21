export const environment = {
  production: false,
  name: "Dev",
  devAutoLogin: false,
  shopServer: "http://api.dev.shop.upaportal.org/v1",
  server: "https://api.upaportal.org/v1",
  mlmServer: "http://upamlmstagingapi.eastus.cloudapp.azure.com", //staging env
  checkVersion: false,
  googleMapsApiKey: "",
  jwtAllowedDomains: [
    "localhost",
    "127.0.0.1",
    "127.0.0.1:8000",
    "api.upaportal.org",
  ],
  featureFlags: {
    chatgptEnabled: false,
  },
  openai: {
    organizationId: "",
    apiKey: "",
  },
};
