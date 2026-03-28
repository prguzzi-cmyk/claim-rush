#!/usr/bin/env python3
"""Seed fire agencies directly via psycopg2 (no app imports, no Celery)."""

import json
import os
import uuid
import sys
from datetime import datetime, timezone

import psycopg2

DB_CONN = dict(
    host="localhost", port=5432,
    dbname="upa_portal", user="postgres",
    password="80cd5b57ea252163c0366899b61295cb0642b8baa18ed0325f69e046d65cb90f",
)

AGENCY_FILE = "scripts/all_pulsepoint_agencies.json"
LEGACY_AGENCY_FILE = "scripts/allagencydata.json"


def main():
    conn = psycopg2.connect(**DB_CONN)
    cur = conn.cursor()

    # Prefer the expanded agency list; fall back to legacy file
    agency_file = AGENCY_FILE
    if not os.path.exists(agency_file):
        agency_file = LEGACY_AGENCY_FILE
        print(f"Expanded agency file not found, falling back to {agency_file}", flush=True)

    print(f"Loading agency data from {agency_file}...", flush=True)
    with open(agency_file, "r") as f:
        data = json.load(f)
    print(f"Loaded {len(data)} entries from JSON", flush=True)

    seeded = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for name, entry in data.items():
        if not isinstance(entry, dict):
            skipped += 1
            continue
        agency = entry.get("agency")
        if not agency or not isinstance(agency, dict):
            skipped += 1
            continue
        aid = (agency.get("agencyid") or "").strip()
        aname = (agency.get("agencyname") or "").strip()
        state = (agency.get("state") or "").strip()[:50]
        if not aid or not aname:
            skipped += 1
            continue

        cur.execute("SELECT 1 FROM fire_agency WHERE agency_id = %s", (aid,))
        if cur.fetchone():
            skipped += 1
            continue

        uid = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO fire_agency (id, agency_id, name, state, is_active, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (uid, aid, aname, state if state else None, True, now),
        )
        seeded += 1
        if seeded % 100 == 0:
            conn.commit()
            print(f"  Seeded {seeded}...", flush=True)

    conn.commit()

    # Report total agency count in DB
    cur.execute("SELECT count(*) FROM fire_agency")
    total_in_db = cur.fetchone()[0]

    cur.close()
    conn.close()
    print(f"Done! Newly seeded: {seeded}, Skipped: {skipped}, Total in DB: {total_in_db}", flush=True)


if __name__ == "__main__":
    main()
