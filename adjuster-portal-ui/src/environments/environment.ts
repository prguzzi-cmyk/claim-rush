// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  name: "Dev",
  // Dev-only: skip login and stub the current user so :4200 lands straight in the authenticated shell.
  devAutoLogin: true,
  // Dev-only: credentials used by the APP_INITIALIZER auto-login to fetch a real
  // staging access_token at boot when devAutoLogin is on. This is the same
  // staging-only test account whose password was reset directly on the staging
  // RDS — never the real production password. environment.prod.ts does NOT
  // include this field, so the auto-login is a dev-build behaviour only.
  devAutoLoginCredentials: {
    username: "admin@upaportal.org",
    password: "StagingTest!2026-Auth",
  },
  // Relative base so the ApiInterceptor produces /v1/... paths — the ng-serve
  // proxy (proxy.conf.json) catches those and forwards to localhost:8888.
  // Point this at a full URL when you need to hit a remote dev API instead.
  // server: "/v1",
  // Temporary override: hit the AWS staging API directly so localhost:4200
  // uses real data (production-snapshot restored to staging RDS).
  // Revert to "/v1" when you want the local Docker FastAPI on :8888 back.
  server: "http://api.staging.upaportal.org/v1",
  // mlmServer:'http://localhost:8080',
  mlmServer: "http://upamlmstagingapi.eastus.cloudapp.azure.com", //staging env
  checkVersion: false,
  googleMapsApiKey: "",
  jwtAllowedDomains: [
    "localhost",
    "127.0.0.1",
    "127.0.0.1:8000",
    "localhost:8888",
    "localhost:4200",
    "api.staging.upaportal.org",
  ],
  featureFlags: {
    chatgptEnabled: true,
  },
  openai: {
    organizationId: "org-o1DNEO5pUbY1j1YVb2Imkf91",
    apiKey: "OPENAI_API_KEY_PLACEHOLDER",
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
