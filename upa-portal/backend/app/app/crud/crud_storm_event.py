#!/usr/bin/env python

"""CRUD operations for the StormEvent model"""

import json
from collections import defaultdict
from typing import Sequence

from sqlalchemy import and_, distinct, func, select
from sqlalchemy.orm import Session

from app.core.log import logger
from app.crud.base import CRUDBase
from app.models.storm_event import StormEvent
from app.schemas.storm_event import StormEventCreate, StormEventUpdate


class CRUDStormEvent(CRUDBase[StormEvent, StormEventCreate, StormEventUpdate]):

    def get_filtered(
        self,
        db_session: Session,
        *,
        date_range: str | None = None,
        event_type: str | None = None,
        state: str | None = None,
        county: str | None = None,
        min_severity: str | None = None,
        territory_filters: list | None = None,
    ) -> Sequence[StormEvent]:
        """Return storm events matching the given filters (unpaginated).

        Parameters
        ----------
        territory_filters : list | None
            Additional SQLAlchemy WHERE clauses from the territory system.
        """
        from datetime import datetime, timedelta, timezone

        with db_session as session:
            stmt = select(StormEvent)

            filters = []

            # Territory-based access filters (applied first for performance)
            if territory_filters:
                filters.extend(territory_filters)

            # Date range filter
            if date_range:
                now = datetime.now(timezone.utc)
                hours_map = {"24h": 24, "3d": 72, "7d": 168}
                hours = hours_map.get(date_range, 168)
                cutoff = now - timedelta(hours=hours)
                filters.append(StormEvent.reported_at >= cutoff)

            # Event type
            if event_type:
                types = [t.strip() for t in event_type.split(",") if t.strip()]
                if types:
                    filters.append(StormEvent.event_type.in_(types))

            # State
            if state:
                filters.append(StormEvent.state == state)

            # County
            if county:
                filters.append(StormEvent.county.ilike(f"%{county}%"))

            # Min severity
            if min_severity:
                levels = ["low", "moderate", "high", "severe", "extreme"]
                if min_severity in levels:
                    min_idx = levels.index(min_severity)
                    allowed = levels[min_idx:]
                    filters.append(StormEvent.severity.in_(allowed))

            if filters:
                stmt = stmt.filter(and_(*filters))

            stmt = stmt.order_by(StormEvent.reported_at.desc())
            return session.scalars(stmt).all()

    def get_target_areas(
        self,
        db_session: Session,
        *,
        date_range: str | None = None,
        event_type: str | None = None,
        state: str | None = None,
        county: str | None = None,
        territory_filters: list | None = None,
    ) -> list[dict]:
        """Aggregate events by county/state and compute risk scores."""
        events = self.get_filtered(
            db_session,
            date_range=date_range,
            event_type=event_type,
            state=state,
            county=county,
            territory_filters=territory_filters,
        )

        # Group by (county, state)
        groups: dict[tuple[str, str], list[StormEvent]] = defaultdict(list)
        for e in events:
            groups[(e.county, e.state)].append(e)

        severity_weight = {"low": 1, "moderate": 2, "high": 3, "severe": 4, "extreme": 5}

        areas = []
        for (county_name, state_name), group_events in groups.items():
            # Collect zip codes
            all_zips: set[str] = set()
            for e in group_events:
                if e.zip_codes:
                    try:
                        zips = json.loads(e.zip_codes)
                        all_zips.update(zips)
                    except (json.JSONDecodeError, TypeError):
                        pass

            # Primary event type = most frequent
            type_counts: dict[str, int] = defaultdict(int)
            max_severity = "low"
            for e in group_events:
                type_counts[e.event_type] += 1
                if severity_weight.get(e.severity, 0) > severity_weight.get(max_severity, 0):
                    max_severity = e.severity

            primary_type = max(type_counts, key=type_counts.get)  # type: ignore

            # Risk score: severity * event_count, capped at 100
            risk_score = min(
                severity_weight.get(max_severity, 1) * len(group_events) * 10,
                100,
            )

            # Estimated properties: rough heuristic based on zip count
            estimated_properties = len(all_zips) * 3000

            areas.append(
                {
                    "county": county_name,
                    "state": state_name,
                    "zip_codes": sorted(all_zips),
                    "primary_event_type": primary_type,
                    "severity": max_severity,
                    "event_count": len(group_events),
                    "estimated_properties": estimated_properties,
                    "risk_score": risk_score,
                    "events": group_events,
                }
            )

        # Sort by risk_score descending
        areas.sort(key=lambda a: a["risk_score"], reverse=True)
        return areas

    def get_distinct_states(self, db_session: Session) -> list[str]:
        """Return sorted list of distinct state values."""
        with db_session as session:
            stmt = select(distinct(StormEvent.state)).order_by(StormEvent.state)
            return list(session.scalars(stmt).all())

    def get_distinct_counties(self, db_session: Session, *, state: str | None = None) -> list[str]:
        """Return sorted list of distinct county values, optionally filtered by state."""
        with db_session as session:
            stmt = select(distinct(StormEvent.county))
            if state:
                stmt = stmt.where(StormEvent.state == state)
            stmt = stmt.order_by(StormEvent.county)
            return list(session.scalars(stmt).all())

    def upsert_from_nws(
        self,
        db_session: Session,
        events_list: list[dict],
    ) -> int:
        """Upsert storm events from NWS alert data. Deduplicates on (data_source, external_id)."""
        return self.upsert_from_source(db_session, events_list=events_list, data_source="nws")

    def upsert_from_source(
        self,
        db_session: Session,
        events_list: list[dict],
        data_source: str = "nws",
    ) -> int:
        """Upsert storm events from any source. Deduplicates on (data_source, external_id)."""
        if not events_list:
            return 0

        count = 0
        for item in events_list:
            try:
                external_id = item.get("external_id", "")
                if not external_id:
                    continue

                existing = self.get_by_external_id(
                    db_session, external_id=external_id, data_source=data_source
                )

                if existing:
                    self.update(db_session, db_obj=existing, obj_in=item)
                else:
                    create_data = StormEventCreate(**item)
                    self.create(db_session, obj_in=create_data)

                count += 1
            except Exception as exc:
                logger.error(f"Error upserting {data_source} storm event {item.get('external_id')}: {exc}")

        return count

    def get_by_external_id(
        self, db_session: Session, *, external_id: str, data_source: str = "nws"
    ) -> StormEvent | None:
        """Look up a storm event by external_id and data_source."""
        with db_session as session:
            stmt = select(StormEvent).where(
                and_(
                    StormEvent.external_id == external_id,
                    StormEvent.data_source == data_source,
                )
            )
            return session.scalar(stmt)


storm_event = CRUDStormEvent(StormEvent)
