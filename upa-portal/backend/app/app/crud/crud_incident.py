#!/usr/bin/env python

"""CRUD operations for the unified Incident model"""

from datetime import datetime, timedelta, timezone
from typing import Sequence
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.log import logger
from app.crud.base import CRUDBase
from app.models.incident import Incident
from app.schemas.incident_intelligence import IncidentCreate, IncidentUpdate


# Duplicate detection window: incidents at the same address, same type, within this window
DEDUP_WINDOW_HOURS = 24


class CRUDIncident(CRUDBase[Incident, IncidentCreate, IncidentUpdate]):
    def find_duplicate(
        self,
        db_session: Session,
        *,
        incident_type: str,
        address: str | None,
        occurred_at: datetime | None,
        external_id: str | None = None,
        source: str | None = None,
    ) -> Incident | None:
        """
        Check for duplicate incidents by:
        1. Exact match on (source, external_id) if both provided
        2. Fuzzy match on (address, incident_type, timestamp window)
        """
        with db_session as session:
            # Check 1: exact source + external_id match
            if external_id and source:
                stmt = select(Incident).where(
                    and_(
                        Incident.source == source,
                        Incident.external_id == external_id,
                    )
                )
                existing = session.scalar(stmt)
                if existing:
                    return existing

            # Check 2: address + type + time window
            if address and occurred_at:
                window_start = occurred_at - timedelta(hours=DEDUP_WINDOW_HOURS)
                window_end = occurred_at + timedelta(hours=DEDUP_WINDOW_HOURS)
                normalized = address.strip().upper()

                stmt = select(Incident).where(
                    and_(
                        Incident.incident_type == incident_type,
                        func.upper(func.trim(Incident.address)) == normalized,
                        Incident.occurred_at >= window_start,
                        Incident.occurred_at <= window_end,
                    )
                )
                existing = session.scalar(stmt)
                if existing:
                    return existing

            return None

    def get_active_incidents(
        self,
        db_session: Session,
        *,
        incident_type: str | None = None,
        state: str | None = None,
        severity: str | None = None,
        hours: int = 168,  # 7 days default
    ) -> Sequence[Incident]:
        """Return active incidents with optional filtering."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        with db_session as session:
            filters = [
                Incident.is_active.is_(True),
                Incident.created_at >= cutoff,
            ]
            if incident_type:
                filters.append(Incident.incident_type == incident_type)
            if state:
                filters.append(Incident.state == state.upper())
            if severity:
                filters.append(Incident.severity == severity)

            stmt = (
                select(Incident)
                .where(and_(*filters))
                .order_by(Incident.priority_score.desc())
            )
            return list(session.scalars(stmt).all())

    def get_map_points(
        self,
        db_session: Session,
        *,
        incident_type: str | None = None,
        hours: int = 168,
    ) -> Sequence[Incident]:
        """Return incidents with valid geo coordinates for map rendering."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        with db_session as session:
            filters = [
                Incident.is_active.is_(True),
                Incident.latitude.isnot(None),
                Incident.longitude.isnot(None),
                Incident.created_at >= cutoff,
            ]
            if incident_type:
                filters.append(Incident.incident_type == incident_type)

            stmt = (
                select(Incident)
                .where(and_(*filters))
                .order_by(Incident.priority_score.desc())
            )
            return list(session.scalars(stmt).all())

    def get_dashboard_counts(
        self,
        db_session: Session,
    ) -> dict:
        """Return aggregate counts for the dashboard."""
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        with db_session as session:
            # Incidents detected today
            incidents_today = session.scalar(
                select(func.count(Incident.id)).where(
                    Incident.created_at >= today_start,
                )
            ) or 0

            # Leads generated today
            leads_today = session.scalar(
                select(func.count(Incident.id)).where(
                    and_(
                        Incident.lead_converted.is_(True),
                        Incident.created_at >= today_start,
                    )
                )
            ) or 0

            # Total active incidents
            total_active = session.scalar(
                select(func.count(Incident.id)).where(
                    Incident.is_active.is_(True),
                )
            ) or 0

            # Breakdown by type
            type_rows = session.execute(
                select(
                    Incident.incident_type,
                    func.count(Incident.id),
                )
                .where(Incident.created_at >= today_start)
                .group_by(Incident.incident_type)
            ).all()
            incidents_by_type = {row[0]: row[1] for row in type_rows}

            # Conversion rate
            total_all = session.scalar(
                select(func.count(Incident.id))
            ) or 0
            total_converted = session.scalar(
                select(func.count(Incident.id)).where(
                    Incident.lead_converted.is_(True),
                )
            ) or 0
            conversion_rate = (
                round((total_converted / total_all) * 100, 1) if total_all > 0 else 0.0
            )

            # Top priority incidents
            top_priority_stmt = (
                select(Incident)
                .where(
                    and_(
                        Incident.is_active.is_(True),
                        Incident.lead_converted.is_(False),
                    )
                )
                .order_by(Incident.priority_score.desc())
                .limit(10)
            )
            top_priority = list(session.scalars(top_priority_stmt).all())

            return {
                "incidents_detected_today": incidents_today,
                "leads_generated_today": leads_today,
                "conversion_rate": conversion_rate,
                "total_active_incidents": total_active,
                "incidents_by_type": incidents_by_type,
                "highest_priority_incidents": top_priority,
            }


incident = CRUDIncident(Incident)
