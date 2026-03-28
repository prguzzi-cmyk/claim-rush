#!/usr/bin/env python

"""CRUD operations for Policy Intelligence — consolidated structured policy data."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.policy_intelligence import PolicyIntelligence
from app.schemas.policy_intelligence import PolicyIntelligenceCreate, PolicyIntelligenceUpdate


class CRUDPolicyIntelligence(
    CRUDBase[PolicyIntelligence, PolicyIntelligenceCreate, PolicyIntelligenceUpdate]
):
    def get_by_document(
        self,
        db_session: Session,
        *,
        document_id: UUID,
    ) -> PolicyIntelligence | None:
        """Get the intelligence record for a document (one-to-one)."""
        stmt = select(PolicyIntelligence).where(
            PolicyIntelligence.policy_document_id == document_id
        )
        return db_session.execute(stmt).scalars().first()

    def upsert(
        self,
        db_session: Session,
        *,
        document_id: UUID,
        obj_in: PolicyIntelligenceUpdate,
    ) -> PolicyIntelligence:
        """Create or update the intelligence record for a document."""
        existing = self.get_by_document(db_session, document_id=document_id)

        if existing:
            update_data = obj_in.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(existing, field, value)
            db_session.add(existing)
            db_session.flush()
            return existing

        # Create new
        create_data = obj_in.dict(exclude_unset=True)
        create_data["policy_document_id"] = document_id
        db_obj = PolicyIntelligence(**create_data)
        db_session.add(db_obj)
        db_session.flush()
        return db_obj


policy_intelligence = CRUDPolicyIntelligence(PolicyIntelligence)
