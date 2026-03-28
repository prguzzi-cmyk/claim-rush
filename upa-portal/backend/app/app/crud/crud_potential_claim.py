#!/usr/bin/env python

"""CRUD operations for the PotentialClaim model."""

from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.potential_claim import PotentialClaim
from app.schemas.potential_claim_record import PotentialClaimCreate, PotentialClaimUpdate


class CRUDPotentialClaim(CRUDBase[PotentialClaim, PotentialClaimCreate, PotentialClaimUpdate]):

    def exists_for_zone_and_address(
        self,
        db_session: Session,
        *,
        zone_id: str,
        property_address: str,
    ) -> bool:
        """Check if a potential claim already exists for this zone + address."""
        with db_session as session:
            stmt = (
                select(PotentialClaim.id)
                .where(
                    PotentialClaim.zone_id == zone_id,
                    PotentialClaim.property_address == property_address,
                )
                .limit(1)
            )
            return session.scalar(stmt) is not None

    def get_by_zone(
        self,
        db_session: Session,
        *,
        zone_id: str,
        status: str | None = None,
    ) -> list[PotentialClaim]:
        """Get all potential claims for a zone, optionally filtered by status."""
        with db_session as session:
            stmt = select(PotentialClaim).where(PotentialClaim.zone_id == zone_id)
            if status:
                stmt = stmt.where(PotentialClaim.status == status)
            stmt = stmt.order_by(PotentialClaim.claim_probability.desc())
            return list(session.scalars(stmt).all())

    def get_pending_for_zone(
        self,
        db_session: Session,
        *,
        zone_id: str,
        min_probability: int = 0,
    ) -> list[PotentialClaim]:
        """Get pending potential claims for a zone above a minimum probability."""
        with db_session as session:
            stmt = (
                select(PotentialClaim)
                .where(
                    PotentialClaim.zone_id == zone_id,
                    PotentialClaim.status == "pending",
                    PotentialClaim.claim_probability >= min_probability,
                )
                .order_by(PotentialClaim.claim_probability.desc())
            )
            return list(session.scalars(stmt).all())

    def update_status(
        self,
        db_session: Session,
        *,
        claim_id: UUID,
        status: str,
        lead_id: UUID | None = None,
        territory_id: UUID | None = None,
    ) -> PotentialClaim | None:
        """Update status and optional FK references."""
        with db_session as session:
            obj = session.get(PotentialClaim, claim_id)
            if not obj:
                return None
            obj.status = status
            if lead_id is not None:
                obj.lead_id = lead_id
            if territory_id is not None:
                obj.territory_id = territory_id
            session.commit()
            session.refresh(obj)
            return obj

    def get_high_probability(
        self,
        db_session: Session,
        *,
        min_score: int = 60,
        limit: int = 50,
        status: str | None = "pending",
    ) -> list[PotentialClaim]:
        """Get high-probability claims sorted by score desc."""
        with db_session as session:
            stmt = select(PotentialClaim).where(
                PotentialClaim.claim_probability >= min_score
            )
            if status:
                stmt = stmt.where(PotentialClaim.status == status)
            stmt = stmt.order_by(PotentialClaim.claim_probability.desc()).limit(limit)
            return list(session.scalars(stmt).all())

    def count_high_probability(
        self,
        db_session: Session,
        *,
        min_score: int = 60,
    ) -> int:
        """Count high-probability claims (pending only)."""
        with db_session as session:
            stmt = select(func.count(PotentialClaim.id)).where(
                PotentialClaim.claim_probability >= min_score,
                PotentialClaim.status == "pending",
            )
            return session.scalar(stmt) or 0

    def count_by_zone(self, db_session: Session, *, zone_id: str) -> int:
        """Count potential claims for a zone."""
        with db_session as session:
            stmt = select(func.count(PotentialClaim.id)).where(
                PotentialClaim.zone_id == zone_id
            )
            return session.scalar(stmt) or 0

    def bulk_create_from_properties(
        self,
        db_session: Session,
        *,
        zone_id: str,
        properties: list[dict],
        event_type: str,
        claim_probability: int,
        estimated_claim_value: float,
        event_timestamp,
        severity: str,
        county: str | None = None,
        storm_event_id: UUID | None = None,
    ) -> int:
        """Bulk-insert potential claims from discovered property dicts.

        Skips duplicates (zone_id + property_address).
        Returns count of inserted records.
        """
        inserted = 0
        with db_session as session:
            for prop in properties:
                address = prop.get("address", "")
                if not address:
                    continue

                # Skip duplicates
                exists = (
                    session.scalar(
                        select(PotentialClaim.id)
                        .where(
                            PotentialClaim.zone_id == zone_id,
                            PotentialClaim.property_address == address,
                        )
                        .limit(1)
                    )
                    is not None
                )
                if exists:
                    continue

                obj = PotentialClaim(
                    zone_id=zone_id,
                    property_address=address,
                    city=prop.get("city", ""),
                    state=prop.get("state", ""),
                    zip_code=prop.get("zip_code", ""),
                    county=county,
                    latitude=prop.get("latitude", 0),
                    longitude=prop.get("longitude", 0),
                    property_type=prop.get("property_type", "Single Family"),
                    event_type=event_type,
                    claim_probability=claim_probability,
                    estimated_claim_value=estimated_claim_value,
                    event_timestamp=event_timestamp,
                    severity=severity,
                    status="pending",
                    storm_event_id=storm_event_id,
                )
                session.add(obj)
                inserted += 1

            session.commit()

        return inserted


potential_claim = CRUDPotentialClaim(PotentialClaim)
