#!/usr/bin/env python

"""
Script to create fire_agency and fire_incident tables and seed initial agencies.

Usage:
    docker exec upa-portal-backend-1 python /app/scripts/create_fire_tables.py
"""

import sys

sys.path.insert(0, "/app")

from app.db.session import SessionLocal, engine
from app.db.base import Base  # noqa – ensures all models are registered

# Create tables
print("Creating tables...")
import app.models  # noqa

Base.metadata.create_all(bind=engine)
print("Tables created (or already exist).")

# Seed initial agencies
SEED_AGENCIES = [
    {"agency_id": "65060", "name": "Los Angeles County Fire", "state": "CA"},
    {"agency_id": "ECC00005", "name": "Houston Fire Department", "state": "TX"},
    {"agency_id": "ECC00002", "name": "Chicago Fire Department", "state": "IL"},
    {"agency_id": "ECC00003", "name": "New York City Fire Department (FDNY)", "state": "NY"},
]

from app import crud
from app.schemas.fire_agency import FireAgencyCreate

db = SessionLocal()
seeded = 0
for data in SEED_AGENCIES:
    existing = crud.fire_agency.get_by_agency_id(db, agency_id=data["agency_id"])
    if not existing:
        obj = FireAgencyCreate(**data)
        crud.fire_agency.create(db, obj_in=obj)
        print(f"  Seeded: {data['name']} ({data['agency_id']})")
        seeded += 1
    else:
        print(f"  Already exists: {data['name']} ({data['agency_id']})")

db.close()
print(f"\nDone. {seeded} agencies seeded.")
