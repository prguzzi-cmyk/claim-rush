#!/usr/bin/env python

"""CRUD operations for the Policy Document Vault module"""

from datetime import date
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.policy_document import PolicyDocument
from app.schemas.policy_document import PolicyDocumentCreate, PolicyDocumentUpdate


class CRUDPolicyDocument(
    CRUDBase[PolicyDocument, PolicyDocumentCreate, PolicyDocumentUpdate]
):
    def search(
        self,
        db_session: Session,
        *,
        carrier: str | None = None,
        policy_number: str | None = None,
        insured_name: str | None = None,
        policy_type: str | None = None,
        property_state: str | None = None,
        claim_id: UUID | None = None,
        client_id: UUID | None = None,
        lead_id: UUID | None = None,
        fire_claim_id: UUID | None = None,
        adjuster_case_id: UUID | None = None,
        effective_after: date | None = None,
        effective_before: date | None = None,
    ):
        """Build dynamic filters and return paginated results."""
        filters = []
        if carrier:
            filters.append(PolicyDocument.carrier.ilike(f"%{carrier}%"))
        if policy_number:
            filters.append(PolicyDocument.policy_number.ilike(f"%{policy_number}%"))
        if insured_name:
            filters.append(PolicyDocument.insured_name.ilike(f"%{insured_name}%"))
        if policy_type:
            filters.append(PolicyDocument.policy_type == policy_type)
        if property_state:
            filters.append(PolicyDocument.property_state == property_state)
        if claim_id:
            filters.append(PolicyDocument.claim_id == claim_id)
        if client_id:
            filters.append(PolicyDocument.client_id == client_id)
        if lead_id:
            filters.append(PolicyDocument.lead_id == lead_id)
        if fire_claim_id:
            filters.append(PolicyDocument.fire_claim_id == fire_claim_id)
        if adjuster_case_id:
            filters.append(PolicyDocument.adjuster_case_id == adjuster_case_id)
        if effective_after:
            filters.append(PolicyDocument.effective_date >= effective_after)
        if effective_before:
            filters.append(PolicyDocument.effective_date <= effective_before)

        return self.get_multi(db_session, filters=filters)

    def get_by_entity(
        self,
        db_session: Session,
        *,
        claim_id: UUID | None = None,
        client_id: UUID | None = None,
        lead_id: UUID | None = None,
        fire_claim_id: UUID | None = None,
        adjuster_case_id: UUID | None = None,
    ) -> list[PolicyDocument]:
        """Get vault policies linked to a specific entity."""
        conditions = []
        if claim_id:
            conditions.append(PolicyDocument.claim_id == claim_id)
        if client_id:
            conditions.append(PolicyDocument.client_id == client_id)
        if lead_id:
            conditions.append(PolicyDocument.lead_id == lead_id)
        if fire_claim_id:
            conditions.append(PolicyDocument.fire_claim_id == fire_claim_id)
        if adjuster_case_id:
            conditions.append(PolicyDocument.adjuster_case_id == adjuster_case_id)

        if not conditions:
            return []

        stmt = select(PolicyDocument).where(
            and_(
                PolicyDocument.is_removed.is_(False),
                *conditions,
            )
        )
        return list(db_session.execute(stmt).unique().scalars().all())

    def get_version_history(
        self, db_session: Session, *, document_id: UUID
    ) -> list[PolicyDocument]:
        """Get all versions sharing a parent chain."""
        doc = self.get(db_session, obj_id=document_id)
        if not doc:
            return []

        # Find the root parent
        root_id = doc.parent_id or doc.id

        stmt = select(PolicyDocument).where(
            and_(
                PolicyDocument.is_removed.is_(False),
                (PolicyDocument.id == root_id)
                | (PolicyDocument.parent_id == root_id),
            )
        ).order_by(PolicyDocument.version)
        return list(db_session.execute(stmt).scalars().all())

    def get_latest_version(
        self, db_session: Session, *, parent_id: UUID
    ) -> PolicyDocument | None:
        """Get the most recent version of a document."""
        stmt = (
            select(PolicyDocument)
            .where(
                and_(
                    PolicyDocument.is_removed.is_(False),
                    (PolicyDocument.parent_id == parent_id)
                    | (PolicyDocument.id == parent_id),
                )
            )
            .order_by(PolicyDocument.version.desc())
            .limit(1)
        )
        return db_session.execute(stmt).scalar_one_or_none()


policy_document = CRUDPolicyDocument(PolicyDocument)
