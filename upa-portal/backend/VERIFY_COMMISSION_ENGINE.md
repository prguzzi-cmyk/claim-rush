# Commission Engine — Verification Runbook

End-to-end steps to apply the Phase 1 migration, seed the mock data (Phase 3),
launch the backend, and verify the Angular frontend renders identical numbers
to the pre-backend mock version.

**Do not run anything here on the laptop until Docker + Poetry are both available.**

---

## Prerequisites

- Docker is running
- `poetry` is on `$PATH` (check: `poetry --version`)
- You're in `/Users/peterguzzi/Desktop/claim-rush/`

---

## Step 1 — Start Postgres

```bash
cd ~/Desktop/claim-rush/upa-portal
docker compose up -d upa-db
docker compose ps        # confirm upa-db is "Up" and healthy
```

Wait until the container's healthcheck passes (usually ~15s).

Verify port is open:

```bash
nc -z localhost 5432 && echo "Postgres ready" || echo "Postgres NOT reachable"
```

---

## Step 2 — Apply migrations (creates the 4 commission tables)

```bash
cd ~/Desktop/claim-rush/upa-portal/backend/app
poetry install --no-root                # one-time; skip if already done
poetry run alembic heads                # should show: c0mm15510n01 (head)
poetry run alembic upgrade head
```

Expected `alembic upgrade head` output:

```
Running upgrade d1s2p3a4t5c6, d6e7f8a9b0c1 -> c0mm15510n01, create commission engine tables
```

If `alembic heads` shows multiple heads BEFORE running the commission
migration, that's expected — this revision is itself the merge point.
After `upgrade head`, `alembic heads` should show `c0mm15510n01` only.

Verify tables exist:

```bash
docker compose exec upa-db psql -U postgres -d app -c "\dt commission_*"
```

Expected output:

```
              List of relations
 Schema |        Name         | Type  |  Owner
--------+---------------------+-------+----------
 public | commission_advance  | table | postgres
 public | commission_claim    | table | postgres
 public | commission_ledger   | table | postgres
 public | commission_payout   | table | postgres
```

---

## Step 3 — Run the seed script

```bash
cd ~/Desktop/claim-rush/upa-portal/backend/app
DEV_BYPASS=1 poetry run python scripts/seed_commission_engine.py
```

Expected terminal output (truncated):

```
→ ensuring roles exist…
  + AGENT (…)  + RVP (…)  + CP (…)  + ADMIN (…)
→ ensuring users exist…
  + Alice Nguyen [a88fe7c8-1982-5856-aa70-5efe96ece7c7]
  + Brian Ortiz  [3fed91e2-c8ef-5576-bf05-866b1010e9c7]
  + Carla Mendes [5b673aaa-38b1-58bd-8e00-1aaa79e5aa50]
  + Diego Park   [57f5e57b-e2cc-53d3-b6f9-4fa2b9f51c14]
  + RIN Admin    [...]
→ ensuring commission_claim rows…
  + RIN-2604-0001 through RIN-2604-0008
→ ensuring commission_ledger rows…
  ledger row count after seed: 18
→ ensuring commission_payout rows…
→ ensuring commission_advance rows…

→ verification (Alice / 2026):
  Total Earned:      $1,920.00   (expected $1,920.00)
  Paid to Date:      $1,600.00   (expected $1,600.00)
  Remaining Balance: $320.00     (expected   $320.00)
  1099 YTD (2026):   $1,600.00   (expected $1,600.00)

  ✅ RECONCILED
```

If the verify step prints `❌ MISMATCH`, stop — don't proceed until that's
resolved. Most likely cause is a sign-convention mismatch in the ledger
(PAYOUT_ISSUED should be negative, ADVANCE_ISSUED positive).

**Re-run safety:** the script is idempotent. Running it twice leaves the DB
in the same state as one run.

---

## Step 4 — Start the backend

```bash
cd ~/Desktop/claim-rush/upa-portal/backend/app
DEV_BYPASS=1 poetry run uvicorn app.main:app --host 0.0.0.0 --port 8888 --reload
```

`DEV_BYPASS=1` is critical — without it, every `/v1/commission/*` request will
401 because the frontend is in devAutoLogin mode and doesn't send a JWT.

In a second terminal, smoke-test the endpoints:

```bash
# Earnings
curl -s http://localhost:8888/v1/commission/agent/a88fe7c8-1982-5856-aa70-5efe96ece7c7/earnings | python3 -m json.tool
# Expected: total_earned=1920, paid_to_date=1600, remaining_balance=320

# 1099
curl -s 'http://localhost:8888/v1/commission/agent/a88fe7c8-1982-5856-aa70-5efe96ece7c7/1099-ytd?year=2026' | python3 -m json.tool
# Expected: ytd_total=1600

# Admin overview
curl -s http://localhost:8888/v1/commission/admin/overview | python3 -m json.tool
# Expected: rows[] with Alice/Brian/Carla/Diego and their 1099 YTD
```

---

## Step 5 — Start the Angular frontend (if not already running)

```bash
cd ~/Desktop/claim-rush/adjuster-portal-ui
npx ng serve --proxy-config proxy.conf.json --port 4200 --live-reload=false --hmr=false
```

The dev server proxies `/v1` → `http://localhost:8888` (see
`proxy.conf.json`), so the frontend's HTTP calls to the commission API will
land on the Uvicorn backend you started in Step 4.

Verify compile output says "Application bundle generation complete" and
port 4200 is serving.

---

## Step 6 — Verify in the browser

Open `http://localhost:4200/#/app/agent-dashboard`.

The dev-auto-login guard redirects you straight into the authenticated
shell. The Earnings tab should render these numbers:

| Tile                     | Expected      | Source                                              |
|--------------------------|---------------|------------------------------------------------------|
| Total Earned             | **$1,920**    | `GET /v1/commission/agent/{alice}/earnings`         |
| Paid to Date             | **$1,600**    | same                                                |
| Remaining Balance        | **$320**      | same                                                |
| 1099 YTD                 | **$1,600**    | `GET /v1/commission/agent/{alice}/1099-ytd`         |

Open the claim ledger (scroll down). Should show 4 claims (RIN-2604-0001
through 0004), with c_004 showing Earned $1,920 / Paid $1,600 / Remaining $0.

Open "Generate Statement" → Year 2026. Summary should show:

| Field                          | Expected      |
|--------------------------------|---------------|
| Opening Balance                | $320 (cumulative through 2026-01-01 is actually $0 — for year period, opening pre-2026 is $0) |
| Earned Through Period End      | $1,920        |
| Paid Through Period End        | $1,600        |
| Advances Through Period End    | $3,700        |
| Closing Balance                | $320          |
| 1099 YTD                       | $1,600        |

For April 2026 specifically (month period):

| Field                          | Expected      |
|--------------------------------|---------------|
| Opening Balance                | $320          |
| Earned Through Period End      | $1,920        |
| Paid Through Period End        | $1,600        |
| Advances Through Period End    | $3,700        |
| Closing Balance                | $320          |
| 1099 YTD                       | $1,600        |

Now navigate to `http://localhost:4200/#/app/admin/commissions`.

The admin table should list 4 writing agents (Alice, Brian, Carla, Diego)
with their MTD commissions and 1099 YTD. Alice's row should show:

- MTD Commission: `$0` (no April 2026 earnings)
- Remaining: `$320`
- 1099 YTD: `$1,600`

Click Alice's row → drill-down should mount `<app-earnings-tab>` scoped
to Alice, showing the same numbers as Step 6.

---

## Step 7 — (Optional) Production smoke

To test the Vercel production build that'll ship to rin.aciunited.com:

```bash
cd ~/Desktop/claim-rush/adjuster-portal-ui
npm run build -- --configuration production
# → output in dist/adjuster-portal-ui/browser/
```

Serve the production bundle with any static server. It'll still call
`environment.prod.ts`'s `server` URL (Railway), which means the production
build needs the backend deployed to Railway too — that's outside the scope
of tonight's work.

---

## Rollback (if anything goes sideways)

```bash
# Undo the migration (drops the 4 commission tables):
cd ~/Desktop/claim-rush/upa-portal/backend/app
poetry run alembic downgrade c0mm15510n01^   # back off the commission revision
# All pre-commission tables are untouched.
```

The Angular side can rollback by reverting the `513d0ad` commit, which
puts `CommissionEngineService` back on the mock — no backend needed.

---

## Known limitations (intentionally deferred)

- **No auth on commission endpoints** — `DEV_BYPASS=1` skips it.
  Replace `commission_auth` in `app/api/deps/dev_bypass.py` with the real
  `get_current_active_user` dep before any real-user access.
- **Not yet deployed to Railway** — `commission_service.py` + endpoints +
  migration + seed all live in code but haven't been pushed/deployed.
- **Statement on rin-commission.vercel.app shows mock** — production still
  builds from the Angular repo pointing at the Railway backend, which
  doesn't have the new endpoints. Verification here is local-only.
- **`commission-engine-mock.service.ts` is dead code** — kept for now in
  case you want to flip back quickly. Safe to delete in a cleanup commit
  once the backend is stable in dev.
