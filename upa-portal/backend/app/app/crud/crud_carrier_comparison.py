#!/usr/bin/env python

"""CRUD operations for the CarrierComparison model"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.carrier_comparison import CarrierComparison
from app.schemas.carrier_comparison import CarrierComparisonCreate, CarrierComparisonUpdate


class CRUDCarrierComparison(CRUDBase[CarrierComparison, CarrierComparisonCreate, CarrierComparisonUpdate]):
    def get_by_project(self, db_session: Session, *, project_id: UUID) -> CarrierComparison | None:
        """Get the most recent comparison for a project."""
        with db_session as session:
            stmt = (
                select(CarrierComparison)
                .where(CarrierComparison.project_id == project_id)
                .order_by(CarrierComparison.created_at.desc())
                .limit(1)
            )
            return session.scalar(stmt)

    def upsert(
        self,
        db_session: Session,
        *,
        project_id: UUID,
        carrier_estimate_id: UUID,
        comparison_data: str,
        aci_total: float,
        carrier_total: float,
        supplement_total: float,
        match_count: int,
        aci_only_count: int,
        carrier_only_count: int,
        price_diff_count: int,
        price_threshold: float,
    ) -> CarrierComparison:
        """Create or replace the comparison result for a project."""
        with db_session as session:
            # Delete existing comparisons for this project
            stmt = select(CarrierComparison).where(
                CarrierComparison.project_id == project_id
            )
            existing = list(session.scalars(stmt).all())
            for old in existing:
                session.delete(old)

            comparison = CarrierComparison(
                project_id=project_id,
                carrier_estimate_id=carrier_estimate_id,
                comparison_data=comparison_data,
                aci_total=aci_total,
                carrier_total=carrier_total,
                supplement_total=supplement_total,
                match_count=match_count,
                aci_only_count=aci_only_count,
                carrier_only_count=carrier_only_count,
                price_diff_count=price_diff_count,
                price_threshold=price_threshold,
            )
            session.add(comparison)
            session.commit()
            session.refresh(comparison)
            return comparison


carrier_comparison = CRUDCarrierComparison(CarrierComparison)
