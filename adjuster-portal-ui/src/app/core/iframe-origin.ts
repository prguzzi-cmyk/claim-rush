// Origins allowed to postMessage into this app when it is embedded as an
// iframe child (e.g. inside the ClaimRush shell at www.aciunited.com).
//
// Consumers should validate `event.origin` against this list before trusting
// any `rin:context` payload. Keep localhost entries for local shell dev
// against `npm run dev` on :5173.
//
// TODO: Wire a top-level postMessage listener that reads `rin:context` from
// these origins and hydrates access_token into localStorage. Today the shell
// passes the JWT via URL params as well, which is the primary path.
export const ALLOWED_PARENT_ORIGINS: ReadonlyArray<string> = [
  "https://www.aciunited.com",
  "https://aciunited.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

export function isAllowedParentOrigin(origin: string): boolean {
  return ALLOWED_PARENT_ORIGINS.includes(origin);
}
