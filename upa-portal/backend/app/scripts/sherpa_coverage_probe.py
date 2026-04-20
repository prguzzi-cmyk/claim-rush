#!/usr/bin/env python
"""SkipSherpa coverage heatmap — per-state hit-rate probe.

Produces a bucketed coverage report from recent `auto-fire-lead` addresses:
how often does SkipSherpa match the property, and how often does the match
include a phone number. First run on 2026-04-20 to characterise the gap
that IDI might close; kept as an ops tool so we can re-run it after any
provider change.

Usage (inside the backend container):
    python3 app/scripts/sherpa_coverage_probe.py

No DB writes. No Celery. No production side effects. Each run consumes
~50 SkipSherpa credits.

Configure via env:
    SHERPA_PROBE_TARGETS   JSON {state: n}, default hard-coded below.
    SHERPA_PROBE_DAYS      lookback window (default 14).
"""

from __future__ import annotations

import json
import os
import random
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import requests

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.lead_skip_trace import LeadSkipTrace
from app.utils.skip_trace import _parse_address_components


DEFAULT_TARGETS = {
    "CA": 15, "VA": 10, "MD": 7, "WI": 4, "OH": 3, "FL": 3,
    "AK": 2, "UT": 2, "IN": 2, "ON": 2,
}


def _is_clean(addr: str) -> bool:
    """Filter out addresses the parser can't reliably route (not a SkipSherpa test)."""
    if not addr or not addr[0].isdigit():
        return False
    up = addr.upper()
    bad = (" OUT,", "UNINCORP", "DOMINICAN", " COUNTY,", "&",
           " STE ", " APT ", " UNIT ", " BLDG ")
    return not any(b in up for b in bad)


def _pull_samples(targets: dict[str, int], days: int) -> list[tuple[str, str]]:
    """Return up to `targets[state]` distinct addresses per state from recent
    auto-fire-lead skip-trace attempts. Stable across runs via seed."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        rows = (db.query(LeadContact.address_loss)
                  .join(Lead, Lead.id == LeadContact.lead_id)
                  .join(LeadSkipTrace, LeadSkipTrace.lead_id == Lead.id)
                  .filter(LeadSkipTrace.skiptrace_ran_at >= cutoff,
                          Lead.source_info == "auto-fire-lead")
                  .all())
    finally:
        db.close()

    by_state: dict[str, set[str]] = defaultdict(set)
    for (addr,) in rows:
        if not _is_clean(addr):
            continue
        tail = addr.split(",")[-1].strip().upper()
        state = tail.split()[0] if tail else ""
        if state in targets:
            by_state[state].add(addr)

    random.seed(42)
    samples: list[tuple[str, str]] = []
    for state, n in targets.items():
        pool = list(by_state.get(state, []))
        random.shuffle(pool)
        samples.extend((state, a) for a in pool[:n])
    return samples


def _probe_one(addr: str) -> str:
    """One SkipSherpa call. Returns outcome label."""
    parsed = _parse_address_components(addr)
    payload = {"property_lookups": [{
        "property_address_lookup": {
            "street": parsed["street"], "city": parsed["city"],
            "state": parsed["state"], "zipcode": parsed["zip"],
        },
        "success_criteria": "owner-name",
    }]}
    url = f"{settings.SKIPSHERPA_BASE_URL.rstrip('/')}/api/beta6/properties"
    headers = {"API-Key": settings.SKIPSHERPA_API_KEY, "Content-Type": "application/json"}
    try:
        r = requests.put(url, json=payload, headers=headers, timeout=20)
        data = r.json() if r.status_code < 500 else {}
    except Exception:
        return "error"
    pr = (data.get("property_results") or [{}])[0]
    prop = pr.get("property")
    owners = prop.get("owners", []) if prop else []
    for o in owners:
        person = o.get("person") or {}
        if person.get("phone_numbers"):
            return "hit+phone"
    if owners:
        return "hit-name"
    return "miss"


def main() -> None:
    targets_env = os.getenv("SHERPA_PROBE_TARGETS")
    targets = json.loads(targets_env) if targets_env else DEFAULT_TARGETS
    days = int(os.getenv("SHERPA_PROBE_DAYS", "14"))

    samples = _pull_samples(targets, days)
    print(f"sample size: {len(samples)} addresses across {len(set(s for s, _ in samples))} states\n")

    results: list[tuple[str, str, str]] = []  # (bucket, address, outcome)
    t0 = time.time()
    for i, (state, addr) in enumerate(samples, 1):
        parsed = _parse_address_components(addr)
        city = (parsed.get("city") or "").upper()
        bucket = "CA-LA" if (state == "CA" and city == "LOS ANGELES") else state
        outcome = _probe_one(addr)
        results.append((bucket, addr, outcome))
        if i % 10 == 0:
            print(f"  progress: {i}/{len(samples)} ({time.time()-t0:.0f}s)")
        time.sleep(0.1)
    print(f"\ntotal wall: {time.time()-t0:.0f}s\n")

    by_bucket: dict[str, list[str]] = defaultdict(list)
    for b, _a, o in results:
        by_bucket[b].append(o)

    print("=" * 72)
    print(f"{'BUCKET':10s}  {'n':>3s}  {'hit+ph':>8s}  {'hit-nm':>8s}  {'miss':>4s}  {'hit%':>5s}  {'phone%':>6s}")
    print("-" * 72)

    def sort_key(b):
        outs = by_bucket[b]
        hits = sum(1 for o in outs if o.startswith("hit"))
        return (0 if b == "CA-LA" else 1, -hits / len(outs) if outs else 0, b)

    for b in sorted(by_bucket.keys(), key=sort_key):
        outs = by_bucket[b]
        n = len(outs)
        ph = sum(1 for o in outs if o == "hit+phone")
        nm = sum(1 for o in outs if o == "hit-name")
        miss = sum(1 for o in outs if o == "miss")
        err = sum(1 for o in outs if o == "error")
        hit_rate = 100 * (ph + nm) / n if n else 0
        ph_rate = 100 * ph / n if n else 0
        err_str = f"  err:{err}" if err else ""
        print(f"{b:10s}  {n:>3d}  {ph:>8d}  {nm:>8d}  {miss:>4d}  {hit_rate:>4.0f}%  {ph_rate:>5.0f}%{err_str}")

    total = len(results)
    tph = sum(1 for _b, _a, o in results if o == "hit+phone")
    tnm = sum(1 for _b, _a, o in results if o == "hit-name")
    tmiss = sum(1 for _b, _a, o in results if o == "miss")
    print("-" * 72)
    print(f"{'OVERALL':10s}  {total:>3d}  {tph:>8d}  {tnm:>8d}  {tmiss:>4d}  "
          f"{100*(tph+tnm)/total:>4.0f}%  {100*tph/total:>5.0f}%")


if __name__ == "__main__":
    main()
