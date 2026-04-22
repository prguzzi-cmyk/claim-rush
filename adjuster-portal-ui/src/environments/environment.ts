// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  name: "Dev",
  // Dev-only: skip login and stub the current user so :4200 lands straight in the authenticated shell.
  devAutoLogin: true,
  // Relative base so the ApiInterceptor produces /v1/... paths — the ng-serve
  // proxy (proxy.conf.json) catches those and forwards to localhost:8888.
  // Point this at a full URL when you need to hit a remote dev API instead.
  server: "/v1",
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
