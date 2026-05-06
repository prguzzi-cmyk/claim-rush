#!/usr/bin/env python

"""One-shot backfill: parse flat address strings into structured columns.

Targets:

* ``fire_incident.address`` → street_address / city / state / zip_code / full_address
* ``lead_contact.address_loss`` → city_loss / state_loss / zip_code_loss
  (only fills *missing* structured fields; never overwrites existing data)

Safe to re-run. Read-modify-write within a single transaction per row.
"""

from __future__ import annotations

import argparse
from typing import Iterable

from sqlalchemy import select

# Load all model relationships before we run any queries.
import app.db.base  # noqa: F401

from app.db.session import SessionLocal
from app.models.fire_agency import FireAgency
from app.models.fire_incident import FireIncident
from app.models.lead_contact import LeadContact
from app.utils.address_parser import parse_address


def _backfill_fire_incidents(dry_run: bool = False) -> dict[str, int]:
    stats = {"scanned": 0, "updated": 0, "skipped_blank": 0}
    with SessionLocal() as session:
        agencies = {a.id: a.state for a in session.scalars(select(FireAgency)).all()}
        rows: Iterable[FireIncident] = session.scalars(select(FireIncident)).all()
        for inc in rows:
            stats["scanned"] += 1
            raw = inc.address
            if not raw or not raw.strip():
                stats["skipped_blank"] += 1
                continue
            fallback_state = agencies.get(inc.agency_id) if inc.agency_id else None
            parts = parse_address(raw, fallback_state=fallback_state)
            changed = False
            if not inc.street_address and parts.street_address:
                inc.street_address = parts.street_address
                changed = True
            if not inc.city and parts.city:
                inc.city = parts.city
                changed = True
            if not inc.state and parts.state:
                inc.state = parts.state
                changed = True
            if not inc.zip_code and parts.zip_code:
                inc.zip_code = parts.zip_code
                changed = True
            if not inc.full_address:
                inc.full_address = parts.full_address or raw
                changed = True
            if changed:
                stats["updated"] += 1
        if not dry_run:
            session.commit()
    return stats


def _backfill_lead_contacts(dry_run: bool = False) -> dict[str, int]:
    stats = {"scanned": 0, "updated": 0, "skipped_blank": 0}
    with SessionLocal() as session:
        rows: Iterable[LeadContact] = session.scalars(select(LeadContact)).all()
        for lc in rows:
            stats["scanned"] += 1
            raw = lc.address_loss or lc.address
            if not raw or not raw.strip():
                stats["skipped_blank"] += 1
                continue
            parts = parse_address(raw, fallback_state=lc.state_loss)
            changed = False
            # Only fill blanks — never overwrite human-entered data.
            if not lc.city_loss and parts.city:
                lc.city_loss = parts.city
                changed = True
            if not lc.state_loss and parts.state:
                lc.state_loss = parts.state
                changed = True
            if not lc.zip_code_loss and parts.zip_code:
                lc.zip_code_loss = parts.zip_code
                changed = True
            if changed:
                stats["updated"] += 1
        if not dry_run:
            session.commit()
    return stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    fi_stats = _backfill_fire_incidents(dry_run=args.dry_run)
    lc_stats = _backfill_lead_contacts(dry_run=args.dry_run)

    print(f"fire_incident: {fi_stats}")
    print(f"lead_contact:  {lc_stats}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
