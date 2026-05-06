#!/usr/bin/env python

"""Backfill missing ZIP and county on fire_incident via reverse geocoding.

Strategy
--------
1. Find distinct ``(rounded_lat, rounded_lng)`` pairs across rows where
   ``zip_code`` is NULL and ``latitude``/``longitude`` are present.
2. Reverse-geocode each unique pair via the U.S. Census Geographies
   endpoint (free, no key) using a thread pool.
3. Bulk-update all matching rows from the resolved (lat, lng) → (zip,
   county) mapping. Existing populated ZIPs are never overwritten.
4. Propagate to ``lead_contact.zip_code_loss`` for any incident that is
   linked to a lead and whose contact has no zip yet.

Idempotent — safe to re-run. Use ``--lead-linked-only`` to scope to the
~150 incidents that are linked to a lead first (cheap, fast).
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Iterable

from sqlalchemy import and_, select, update
from sqlalchemy.orm import Session

import app.db.base  # noqa: F401  — load full mapper graph
from app.db.session import SessionLocal
from app.models.fire_incident import FireIncident
from app.models.lead_contact import LeadContact
from app.utils.reverse_geocoder import GeocodeResult, reverse_geocode

COORD_DECIMALS = 4
DEFAULT_WORKERS = 12


def _distinct_coords(
    session: Session,
    *,
    lead_linked_only: bool,
) -> list[tuple[float, float]]:
    stmt = select(
        FireIncident.latitude,
        FireIncident.longitude,
    ).where(
        and_(
            FireIncident.zip_code.is_(None),
            FireIncident.latitude.is_not(None),
            FireIncident.longitude.is_not(None),
        )
    )
    if lead_linked_only:
        stmt = stmt.where(FireIncident.lead_id.is_not(None))

    rows = session.execute(stmt).all()
    seen: set[tuple[float, float]] = set()
    out: list[tuple[float, float]] = []
    for lat, lng in rows:
        key = (round(float(lat), COORD_DECIMALS), round(float(lng), COORD_DECIMALS))
        if key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


def _resolve_all(
    coords: Iterable[tuple[float, float]],
    *,
    workers: int,
) -> dict[tuple[float, float], GeocodeResult]:
    pairs = list(coords)
    results: dict[tuple[float, float], GeocodeResult] = {}
    if not pairs:
        return results

    def _worker(pair: tuple[float, float]) -> tuple[tuple[float, float], GeocodeResult]:
        return pair, reverse_geocode(pair[0], pair[1])

    progress = 0
    total = len(pairs)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_worker, p) for p in pairs]
        for fut in as_completed(futures):
            pair, res = fut.result()
            results[pair] = res
            progress += 1
            if progress % 100 == 0 or progress == total:
                print(f"  geocoded {progress}/{total} unique coords", flush=True)
    return results


def _apply_to_fire_incidents(
    session: Session,
    resolved: dict[tuple[float, float], GeocodeResult],
    *,
    lead_linked_only: bool,
) -> dict[str, int]:
    stats = {"rows_updated_zip": 0, "rows_updated_county": 0, "coords_with_zip": 0}
    for (lat_r, lng_r), res in resolved.items():
        if res.is_empty:
            continue
        if res.zip_code is None and res.county is None:
            continue
        if res.zip_code:
            stats["coords_with_zip"] += 1

        # Match all rows whose rounded coord equals this pair AND whose
        # zip_code is still NULL (idempotency guard).
        round_lat = lat_r
        round_lng = lng_r

        update_values: dict[str, object] = {}
        if res.zip_code:
            update_values["zip_code"] = res.zip_code
        if res.county:
            update_values["county"] = res.county

        # Build a WHERE that matches the rounded coordinate band.
        epsilon = 10 ** (-COORD_DECIMALS) / 2.0
        conds = [
            FireIncident.latitude.between(round_lat - epsilon, round_lat + epsilon),
            FireIncident.longitude.between(round_lng - epsilon, round_lng + epsilon),
            FireIncident.zip_code.is_(None),  # never overwrite
        ]
        if lead_linked_only:
            conds.append(FireIncident.lead_id.is_not(None))

        stmt = update(FireIncident).where(and_(*conds)).values(**update_values)
        result = session.execute(stmt)
        if "zip_code" in update_values:
            stats["rows_updated_zip"] += result.rowcount or 0
        if "county" in update_values and "zip_code" not in update_values:
            # County-only update (rare path).
            stats["rows_updated_county"] += result.rowcount or 0

    session.commit()
    return stats


def _propagate_to_lead_contacts(session: Session) -> int:
    """Copy fire_incident.zip_code → lead_contact.zip_code_loss when blank."""
    stmt = select(FireIncident.lead_id, FireIncident.zip_code, FireIncident.county).where(
        and_(
            FireIncident.lead_id.is_not(None),
            FireIncident.zip_code.is_not(None),
        )
    )
    rows = session.execute(stmt).all()
    updated = 0
    for lead_id, zip_code, _county in rows:
        lc = session.scalar(
            select(LeadContact).where(LeadContact.lead_id == lead_id)
        )
        if lc is None:
            continue
        if not lc.zip_code_loss and zip_code:
            lc.zip_code_loss = zip_code
            updated += 1
    session.commit()
    return updated


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lead-linked-only", action="store_true",
                    help="Only enrich fire_incidents linked to a lead.")
    ap.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with SessionLocal() as session:
        coords = _distinct_coords(session, lead_linked_only=args.lead_linked_only)
        print(f"distinct coords needing geocode: {len(coords)}", flush=True)
        if not coords:
            print("nothing to do.", flush=True)
            return 0

        if args.dry_run:
            print("dry-run: skipping geocoder calls", flush=True)
            return 0

        resolved = _resolve_all(coords, workers=args.workers)
        with_zip = sum(1 for r in resolved.values() if r.zip_code)
        print(f"geocoded {with_zip}/{len(resolved)} coords with a ZIP", flush=True)

        stats = _apply_to_fire_incidents(
            session, resolved, lead_linked_only=args.lead_linked_only
        )
        print(f"fire_incident updates: {stats}", flush=True)

        propagated = _propagate_to_lead_contacts(session)
        print(f"lead_contact.zip_code_loss propagated: {propagated}", flush=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
