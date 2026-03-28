#!/usr/bin/env python

"""CRUD operations for the PricingVersion model"""

from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import and_, func, select, update
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.pricing_item import PricingItem
from app.models.pricing_version import PricingVersion
from app.schemas.pricing_item import PricingItemCreate
from app.schemas.pricing_version import PricingVersionCreate, PricingVersionUpdate


class CRUDPricingVersion(
    CRUDBase[PricingVersion, PricingVersionCreate, PricingVersionUpdate]
):
    def get_active(
        self,
        db_session: Session,
        *,
        source: str | None = None,
        region: str = "national",
    ) -> PricingVersion | None:
        """Get the active version for an optional source and region pair."""
        with db_session as session:
            conditions = [
                PricingVersion.status == "active",
                PricingVersion.region == region,
            ]
            if hasattr(PricingVersion, "is_removed"):
                conditions.append(PricingVersion.is_removed.is_(False))
            if source:
                conditions.append(PricingVersion.source == source)

            stmt = select(PricingVersion).where(and_(*conditions)).limit(1)
            return session.scalar(stmt)

    def activate(
        self, db_session: Session, *, version_id: UUID
    ) -> PricingVersion | None:
        """Set version to active, archive the previous active version for same source+region."""
        with db_session as session:
            version = self.get(db_session, obj_id=version_id)
            if not version:
                return None

            # Archive any currently active version for the same source+region
            conditions = [
                PricingVersion.status == "active",
                PricingVersion.source == version.source,
                PricingVersion.region == version.region,
                PricingVersion.id != version_id,
            ]
            if hasattr(PricingVersion, "is_removed"):
                conditions.append(PricingVersion.is_removed.is_(False))

            stmt = (
                update(PricingVersion)
                .where(and_(*conditions))
                .values(status="archived")
            )
            session.execute(stmt)

            # Activate the target version
            version.status = "active"
            session.add(version)
            session.commit()
            session.refresh(version)

            return version

    def bulk_import_items(
        self,
        db_session: Session,
        *,
        version_id: UUID,
        items: list[PricingItemCreate],
    ) -> int:
        """Bulk insert pricing items into a version. Returns count of items created."""
        with db_session as session:
            count = 0
            for item_data in items:
                obj_data = jsonable_encoder(item_data)
                obj_data["version_id"] = version_id
                db_obj = PricingItem(**obj_data)
                session.add(db_obj)
                count += 1

            session.flush()

            # Update item_count on the version
            version = session.get(PricingVersion, version_id)
            if version:
                total = session.scalar(
                    select(func.count(PricingItem.id)).where(
                        PricingItem.version_id == version_id
                    )
                )
                version.item_count = total or count

            session.commit()
            return count

    def get_by_source_region(
        self,
        db_session: Session,
        *,
        source: str,
        region: str = "national",
    ) -> list[PricingVersion]:
        """Get all versions for a source+region pair."""
        with db_session as session:
            conditions = [
                PricingVersion.source == source,
                PricingVersion.region == region,
            ]
            if hasattr(PricingVersion, "is_removed"):
                conditions.append(PricingVersion.is_removed.is_(False))

            stmt = (
                select(PricingVersion)
                .where(and_(*conditions))
                .order_by(PricingVersion.effective_date.desc())
            )
            return list(session.scalars(stmt).all())



pricing_version = CRUDPricingVersion(PricingVersion)
