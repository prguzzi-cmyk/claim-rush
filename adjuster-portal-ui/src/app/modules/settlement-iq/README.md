# Settlement IQ — Angular module subtree

Frontend half of the Settlement IQ forensic settlement-analysis
product. Mirrors the backend subtree at `~/upa-portal-backend/app/app/services/settlement_iq/`.

Phase 1 scope: Florida residential, homeowner public flow only
(no admin UI yet — admin endpoints exist server-side but no
frontend surface is built for them).

## Why this module is a subtree

This codebase is otherwise FLAT — every feature lives under
`src/app/components/sections/`, every service under
`src/app/services/`, and so on. Lazy loading isn't used anywhere
else, and no `modules/` directory existed prior to this slice.

Settlement IQ deliberately departs from that convention. Two
reasons:

1. **Portability for white-label.** Settlement IQ is intended to be
   extracted and re-deployed as a Pax Equitas-branded product. A
   self-contained subtree with its own routes / services / styles is
   grep-and-go portable; scattered files are not.
2. **Bundle isolation.** The public homeowner flow has nothing to
   do with the authenticated portal shell. Lazy loading keeps the
   first-page-load weight small when a homeowner lands cold from
   an organic search result or paid ad.

If a future engineer prefers the flat convention, the migration is
mechanical: move each component out, update imports, delete the
subtree, replace the lazy route with eager registration. The
behavior is unchanged either way.

## Layout

```
settlement-iq/
├── README.md                                ← you are here
├── settlement-iq.routes.ts                  exported Route[] for the lazy import
│
├── core/
│   ├── settlement-iq.service.ts             HTTP client + scan state (RxJS)
│   ├── settlement-iq.models.ts              TS interfaces mirroring backend Pydantic
│   └── tenant-theme.service.ts              CSS-variable swap (Pax-Equitas-ready)
│
├── layout/
│   └── settlement-iq-layout.component.*     outer chrome, no portal sidebar
│
├── residential/
│   ├── door/                                screen 1 — landing
│   ├── upload/                              screen 2 — drag/drop + polling
│   └── report/                              screen 3 — forensic report display
│
├── commercial/                              Phase 2 stub
│
├── shared/
│   ├── verdict-badge/
│   ├── finding-card/
│   ├── recovery-range-display/
│   ├── progress-stepper/
│   └── file-dropzone/
│
└── styles/
    └── settlement-iq-theme.scss             scoped tokens, NO global pollution
```

## Routing

Lazy-loaded from `app-routing.module.ts`:

```typescript
{
  path: 'settlement-iq',
  loadChildren: () =>
    import('./modules/settlement-iq/settlement-iq.routes').then(
      (m) => m.SETTLEMENT_IQ_ROUTES,
    ),
}
```

Hash routing carries over from the root `RouterModule.forRoot(routes, { useHash: true })`.
URLs in Phase 1: `https://rin.aciunited.com/#/settlement-iq/residential[/upload|/report/:id]`.
`useHash: false` is a tracked Phase 1.5 task before public launch.

## State management

RxJS-based, single `SettlementIqService` (`providedIn: 'root'`). One
`BehaviorSubject<ScanState>` holds the active scan; components
subscribe to slices. Status polling uses
`interval(2000).pipe(switchMap(...), takeWhile(...))` and stops
automatically on `complete` / `failed`.

No NgRx. No signals. Matches the existing codebase.

## Backend wiring

The service hits the Settlement IQ Phase 1 endpoints on the RIN
backend (Railway, `accurate-warmth-production`). All paths go
through the existing `ApiInterceptor` which prepends `/v1/`.

| Backend endpoint                          | Service method               |
|-------------------------------------------|------------------------------|
| `POST   /v1/settlement-iq/scan`           | `submitScan(...)`            |
| `GET    /v1/settlement-iq/scan/{id}/status` | `pollStatus(scanId)`       |
| `GET    /v1/settlement-iq/scan/{id}/report` | `fetchReport(scanId)`      |
| `GET    /v1/settlement-iq/scan/{id}/report.html` | (direct anchor href) |
| `POST   /v1/settlement-iq/data-request`   | `submitDataRequest(email)`   |

## Brand / tenancy

Master brand is Settlement IQ™. The `TenantThemeService` reads the
tenant identifier (Phase 1 hardcoded to `'settlement_iq'`) and sets
CSS variables on the layout wrapper. Pax-Equitas-keyed values will
populate the same variable set once tenant #2 onboards.

Avoid hard-coding ACI / UPA / RIN brand strings in user-facing copy
— Settlement IQ is intended to ship as a sellable engine, so the
brand should be config-swappable.

## Linked

Backend module: `~/upa-portal-backend/app/app/services/settlement_iq/`
Backend README: same path, top-level.
