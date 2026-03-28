#!/usr/bin/env python3
"""
Script to seed ALL PulsePoint agencies from allagencydata.json into the fire_agency table.

Usage (inside backend container):
    python /app/scripts/seed_all_agencies.py
"""

import json
import sys

sys.path.insert(0, "/app")

from app.db.session import SessionLocal
from app import crud
from app.schemas.fire_agency import FireAgencyCreate

AGENCY_DATA_FILE = "/app/scripts/allagencydata.json"

print("Loading agency data...")
with open(AGENCY_DATA_FILE, "r") as f:
    data = json.load(f)

agencies_to_seed = []
skipped_parse = 0
for name, entry in data.items():
    if not isinstance(entry, dict):
        skipped_parse += 1
        continue
    agency = entry.get("agency")
    if not agency or not isinstance(agency, dict):
        skipped_parse += 1
        continue
    agency_id = (agency.get("agencyid") or "").strip()
    agency_name = (agency.get("agencyname") or "").strip()
    state = (agency.get("state") or "").strip()
    if agency_id and agency_name:
        agencies_to_seed.append({
            "agency_id": agency_id,
            "name": agency_name,
            "state": state[:50] if state else None,
        })
    else:
        skipped_parse += 1

print(f"Parsed {len(agencies_to_seed)} agencies ({skipped_parse} skipped/invalid)")

db = SessionLocal()
seeded = 0
already_exists = 0
errors = 0

for i, data_entry in enumerate(agencies_to_seed):
    try:
        existing = crud.fire_agency.get_by_agency_id(db, agency_id=data_entry["agency_id"])
        if not existing:
            obj = FireAgencyCreate(**data_entry)
            crud.fire_agency.create(db, obj_in=obj)
            seeded += 1
            if seeded % 50 == 0:
                print(f"  Seeded {seeded} so far...")
        else:
            already_exists += 1
    except Exception as e:
        errors += 1
        print(f"  ERROR seeding {data_entry.get('name')} ({data_entry.get('agency_id')}): {e}")
        db.rollback()

db.close()
print(f"\nDone!")
print(f"  Seeded:         {seeded}")
print(f"  Already exists: {already_exists}")
print(f"  Errors:         {errors}")
print(f"  Total processed:{seeded + already_exists + errors}")
