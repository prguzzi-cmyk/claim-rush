# Fire Lead Intelligence Pipeline

End-to-end documentation of the PulsePoint → Skip-Trace → Claim flow that
turns active fire dispatch data into closeable claims.

This doc is the source of truth for the *enrichment* half of the pipeline.
Routing, outreach, and claim creation are referenced but documented in
their own services.

## Operational Workflow

```
PulsePoint dispatch
       │  (every 2 min, ~5,000 agencies)
       ▼
Ingestion + enrichment
   • parse address  → street / city / state
   • reverse-geocode → zip / county
       │
       ▼
Auto-lead creation     (eligible fire incidents → leads)
       │
       ▼
Skip trace             (owner_name / phone / email)
       │
       ▼
SMS / Voice outreach   (Twilio + Retell + outreach queue)
       │
       ▼
Convert to client      (interest confirmed)
       │
       ▼
Create claim           (claim record + recovery workflow)
```

Each stage writes its result back to the lead so later stages can act on
fresh data without re-fetching upstream sources.

## PulsePoint ingestion

**Where:** `app/tasks/pulsepoint.py`, `app/utils/pulsepoint.py`,
`app/crud/crud_fire_incident.py`.

**Schedule:** `dispatch_pulsepoint_polls` runs every 2 minutes
(`celery_config.py`). It selects up to ~5,000 active agencies, splits
into sub-batches of 100, and fans them out as `poll_agency_batch` tasks
on the `pulsepoint-queue` worker.

**Per-agency fetch:** `_poll_single_agency` calls the PulsePoint public
API, AES-256-CBC decrypts the response, and merges the *active* +
*recent-closed* incident lists into a single upsert.

**Upsert:** `crud.fire_incident.upsert_from_pulsepoint` is idempotent
on `(pulsepoint_id, agency_id)`. It:

1. Parses `FullDisplayAddress` into structured parts (see below).
2. Reverse-geocodes the lat/lng for ZIP + county when the parser didn't
   already extract a ZIP (best-effort, see below).
3. Writes a unified row with all structured fields populated.
4. Marks any existing-but-no-longer-dispatched incidents as `cleared`
   (records are *never deleted* — only the `dispatch_status` changes).

Returns a list of newly-inserted incident IDs that get fanned to
`process_new_fire_incidents` for auto-lead conversion.

## Address parsing

**Where:** `app/utils/address_parser.py`.

PulsePoint's `FullDisplayAddress` is a comma-delimited string of the
form `"STREET, CITY, STATE"` — and occasionally `"STREET, CITY, STATE
12345"` for sources that do include ZIP. The parser:

* Splits on commas, then handles the 3+, 2-segment, and single-token
  shapes.
* Extracts ZIP **only** from the trailing state/zip slot or as the
  final whitespace-separated token of a single-segment string.
* Falls back to the parent agency's state when the input has no state.
* Uppercases recognized 2-letter state codes; passes other state-like
  tokens through verbatim.
* Never raises — always returns an `AddressParts(...)` value.

### Why no free-floating ZIP regex?

A previous version called `_ZIP_RE.search(cleaned)` over the whole
string, which mis-extracted 5-digit street numbers as ZIPs (e.g.
`"14661 US HIGHWAY 1, JUNO BEACH, FL"` → ZIP `14661`). This corrupted
~750 `fire_incident` rows before the bug was fixed and the data
re-geocoded. The current parser only treats a 5-digit token as a ZIP
when it appears in the right structural position.

## ZIP enrichment (reverse geocoding)

**Where:** `app/utils/reverse_geocoder.py`,
`app/tasks/zip_enrichment.py`,
`scripts/backfill_zip_from_latlng.py`.

**Why:** PulsePoint rarely returns ZIP codes. Inline parsing of
`FullDisplayAddress` recovers ZIP only when the source explicitly
included one (~3% of incidents). Reverse-geocoding the lat/lng raises
ZIP coverage to ~99% on incidents with valid coordinates.

**Provider — U.S. Census Geographies (free, no API key)**

* Endpoint: `https://geocoding.geo.census.gov/geocoder/geographies/coordinates`
* Returns the `2020 Census ZIP Code Tabulation Areas` layer (ZCTA5,
  equivalent to USPS ZIP for ~99% of populated addresses) plus
  `Counties` with name + GEOID.
* No quota; ~10–20 requests/sec safe per IP. Backfill runs at 16
  concurrent workers without issues.
* **Cost: $0.**

**Cache + safety guards**

`reverse_geocode(lat, lng)` is fail-soft:

* Caches by rounded `(lat, lng)` to 4 decimal places — fire incidents
  at the same address share a cache hit.
* Rejects `(0, 0)` sentinel coords and any pair clearly outside the
  US/territories envelope before hitting the wire.
* Returns an empty `GeocodeResult()` on any HTTP/JSON error; the
  caller proceeds without enrichment. Census API hiccups never block
  ingestion.

**Two enrichment paths**

1. **Inline** (synchronous in upsert): when the parser didn't yield a
   ZIP, the upsert path makes a best-effort Census call with an 8s
   timeout. ZIP/county land on the row at insert time.
2. **Catchup** (`enrich_missing_zips` Celery task, every 10 min):
   processes up to 200 candidate rows per tick, lead-linked first.
   Skips `(0, 0)` rows at the query level so unrecoverable rows
   aren't retried indefinitely. Propagates any newly-resolved ZIP
   into `lead_contact.zip_code_loss` when blank.

Existing populated ZIPs are **never overwritten** — both paths only
fill blanks.

## Dedupe logic

Used by the skip-trace export pipeline (`scripts/` SQL +
`/Users/peterguzzi/Desktop/*.csv`) to collapse multiple dispatch
records that point at the same property:

* **Key:** `(normalized_street_address, round(lat, 4), round(lng, 4))`
  where normalization = uppercase + trim + collapse whitespace.
* **Tie-break:** newest `received_at` wins; UUID DESC as a final
  stable tie-breaker.
* Implemented as a `ROW_NUMBER() OVER (PARTITION BY ...)` window in
  the export SQL — no in-memory dedup, no Python required.

Dedupe runs *after* eligibility filtering, so excluded rows can't
suppress a valid duplicate.

## Export pipeline

**Where:** ad-hoc `psql \copy` driven by SQL files in `/tmp/` during
the export session. Three CSVs are produced on Desktop:

| File | Rows | Purpose |
|---|---|---|
| `all-fire-incidents-bulk-skiptrace.csv` | every eligible row | full audit trail, pre-dedupe |
| `deduped-fire-incidents.csv` | newest-wins per address | the canonical bulk-upload file |
| `vendor-minimal-upload.csv` | deduped, 5 columns only | BatchData / SkipSherpa / IDI format |

**Eligibility filter** (applied in SQL):

* `call_type IN ('SF', 'FIRE', 'RF', 'CF')` — Structure / Fire /
  Residential / Commercial only.
* `street_address` and `state` non-blank.
* Excludes `(lat, lng) ≈ (0, 0)` sentinel coords.

**Suspect-ZIP guard:** the export SQL blanks `zip_code_loss` at
write-time when ZIP equals the leading street-number token. Vendors
fall back to street + city + state matching, which is more reliable
than a wrong ZIP. The DB row is untouched (read-only export).

**Derived columns** (no underlying schema):

* `severity` — `high` for Working/Confirmed variants (`WSF`, `WCF`,
  `WRF`, `WF`), `standard` otherwise.
* `priority` — bucketed from the responding-units count: `P1` ≥10,
  `P2` ≥5, `P3` ≥1, `P4` else.

## Vendor upload flow

1. Run the export SQL to refresh the three CSVs on Desktop.
2. Spot-check `vendor-minimal-upload.csv` — addresses, sample row.
3. Upload to BatchData / SkipSherpa / IDI in the vendor's bulk format.
4. When results return, ingest owner_name/phone/email into
   `lead_skip_trace` (`skiptrace_status` = `success` / `failed`).
5. Outreach picks up rows where `skiptrace_status = success` and
   queues SMS / voice attempts.

Cost reference (deduped count = 282 rows at the time of writing):

| Per-lookup | Total |
|---:|---:|
| $0.03 | $8.46 |
| $0.05 | $14.10 |
| $0.10 | $28.20 |

## Known limitations

* **`(0, 0)` PulsePoint sentinel** — ~9% of `fire_incident` rows carry
  `(0, 0)` coordinates (PulsePoint's stand-in for "location unknown").
  These are unrecoverable by reverse geocoding. Both inline and
  catchup paths skip them at the query level. They are excluded from
  the skip-trace export.
* **ZCTA vs USPS ZIP** — Census ZCTAs match USPS ZIPs for ~99% of
  populated addresses. Edge cases: PO-box-only ZIPs, large university
  campuses, military installations. For skip-trace this is a
  rounding error; for mailing-address validation it would matter.
* **Intersections instead of street numbers** — PulsePoint sometimes
  emits dispatch addresses like `"S EAST ST / E SANTA ANA ST"` (no
  street number, just an intersection). These pass the eligibility
  filter but are unmatchable by skip-trace vendors and tend to come
  back empty.
* **City accuracy in dispatch areas** — some agencies use `"UNINCORPORATED"`
  as the city for any address outside an incorporated boundary. The
  ZIP and county are still correct; the city is just imprecise.
* **No unit-attendance schema** — `severity` / `priority` are derived
  from `units` JSON length. There is no source-of-truth severity
  field on the `fire_incident` row.

## Future enhancement ideas

* **ZIP+4 enrichment** via Smarty / USPS API for higher skip-trace hit
  rate on borderline addresses.
* **Intersection → property mapping** by querying parcel data on the
  lat/lng (county GIS APIs) — recovers the ~5% of dispatches that have
  no street number.
* **Severity confidence model** — combine call type, units count, and
  agency size into a calibrated 0–1 score instead of a coarse bucket.
* **Property-type classification** — residential / commercial /
  industrial inferred from county-assessor data — feeds the lead-
  routing step (different agents specialize).
* **Pre-skip-trace owner enrichment** via county tax-roll public APIs
  for free owner_name lookup before paying a vendor.
* **Live skip-trace** for high-priority leads (P1 + working fire) via
  a real-time vendor endpoint instead of bulk batches.
* **Auto-CRM sync** — push enriched leads into HubSpot / Salesforce
  as soon as `skiptrace_status = success`, so account managers see
  contactable leads without waiting for the outreach queue.

---

*Maintainer notes:* this pipeline is intentionally read-only for
upstream PulsePoint data. Never mutate `fire_incident.address` (the
canonical `FullDisplayAddress`); always derive structured fields
alongside it. Backfill scripts must be idempotent and never overwrite
populated downstream fields.
