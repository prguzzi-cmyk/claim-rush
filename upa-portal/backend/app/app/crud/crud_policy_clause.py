#!/usr/bin/env python

"""CRUD operations for Policy Clause — AI-extracted structured policy data."""

from uuid import UUID

from sqlalchemy import and_, delete, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.policy_clause import PolicyClause
from app.schemas.policy_clause import PolicyClauseCreate, PolicyClauseUpdate


class CRUDPolicyClause(
    CRUDBase[PolicyClause, PolicyClauseCreate, PolicyClauseUpdate]
):
    def get_by_document(
        self,
        db_session: Session,
        *,
        document_id: UUID,
        clause_type: str | None = None,
    ) -> list[PolicyClause]:
        """Get clauses for a document, optionally filtered by type."""
        conditions = [PolicyClause.policy_document_id == document_id]
        if clause_type:
            conditions.append(PolicyClause.clause_type == clause_type)

        stmt = (
            select(PolicyClause)
            .where(and_(*conditions))
            .order_by(PolicyClause.sort_order, PolicyClause.clause_type)
        )
        return list(db_session.execute(stmt).scalars().all())

    def delete_by_document(
        self, db_session: Session, *, document_id: UUID
    ) -> int:
        """Delete all clauses for a document (for re-extraction). Returns count deleted."""
        stmt = delete(PolicyClause).where(
            PolicyClause.policy_document_id == document_id
        )
        result = db_session.execute(stmt)
        db_session.flush()
        return result.rowcount


policy_clause = CRUDPolicyClause(PolicyClause)
