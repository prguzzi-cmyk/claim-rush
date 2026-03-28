#!/usr/bin/env python

"""CRUD operations for the ClaimZoneLeadTracker model."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.claim_zone_lead_tracker import ClaimZoneLeadTracker


class CRUDClaimZoneLeadTracker:
    def has_lead_been_generated(self, db_session: Session, *, zone_id: str) -> bool:
        """Check if a lead has already been generated for this zone."""
        with db_session as session:
            stmt = select(ClaimZoneLeadTracker.id).where(
                ClaimZoneLeadTracker.zone_id == zone_id,
            ).limit(1)
            return session.scalar(stmt) is not None

    def create(
        self,
        db_session: Session,
        *,
        zone_id: str,
        event_type: str,
        county: str | None = None,
        state: str | None = None,
        priority: str | None = None,
        claim_probability: float | None = None,
        lead_id: UUID | None = None,
        territory_id: UUID | None = None,
    ) -> ClaimZoneLeadTracker:
        """Create a new tracker record."""
        with db_session as session:
            obj = ClaimZoneLeadTracker(
                zone_id=zone_id,
                event_type=event_type,
                county=county,
                state=state,
                priority=priority,
                claim_probability=claim_probability,
                lead_id=lead_id,
                territory_id=territory_id,
            )
            session.add(obj)
            session.commit()
            session.refresh(obj)
            return obj

    def get_by_zone_id(self, db_session: Session, *, zone_id: str) -> ClaimZoneLeadTracker | None:
        """Get tracker record by zone_id."""
        with db_session as session:
            stmt = select(ClaimZoneLeadTracker).where(
                ClaimZoneLeadTracker.zone_id == zone_id,
            )
            return session.scalar(stmt)


claim_zone_lead_tracker = CRUDClaimZoneLeadTracker()
