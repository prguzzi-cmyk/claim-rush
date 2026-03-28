#!/usr/bin/env python

"""CRUD operations for the PricingItem model"""

from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.pricing_item import PricingItem
from app.schemas.pricing_item import PricingItemCreate, PricingItemUpdate


class CRUDPricingItem(CRUDBase[PricingItem, PricingItemCreate, PricingItemUpdate]):
    def search_by_query(
        self,
        db_session: Session,
        *,
        query: str,
        version_id: UUID | None = None,
        limit: int = 20,
    ) -> list[PricingItem]:
        """Search pricing items by code or description (case-insensitive).
        If version_id is provided, restricts to that version.
        """
        with db_session as session:
            pattern = f"%{query}%"
            conditions = [
                PricingItem.is_active.is_(True),
                or_(
                    PricingItem.code.ilike(pattern),
                    PricingItem.description.ilike(pattern),
                ),
            ]
            if version_id is not None:
                conditions.append(PricingItem.version_id == version_id)

            stmt = (
                select(PricingItem)
                .where(and_(*conditions))
                .limit(limit)
            )
            return list(session.scalars(stmt).all())

    def get_by_code(
        self,
        db_session: Session,
        *,
        code: str,
        version_id: UUID | None = None,
    ) -> PricingItem | None:
        """Get a pricing item by its exact code, optionally within a version."""
        with db_session as session:
            conditions = [PricingItem.code == code]
            if version_id is not None:
                conditions.append(PricingItem.version_id == version_id)
            stmt = select(PricingItem).where(and_(*conditions))
            return session.scalar(stmt)

    def upsert(
        self,
        db_session: Session,
        *,
        obj_in: PricingItemCreate,
    ) -> PricingItem:
        """Create or update a pricing item by code within a version."""
        existing = self.get_by_code(
            db_session, code=obj_in.code, version_id=obj_in.version_id
        )
        if existing:
            return self.update(db_session, db_obj=existing, obj_in=obj_in)
        return self.create(db_session, obj_in=obj_in)


pricing_item = CRUDPricingItem(PricingItem)
