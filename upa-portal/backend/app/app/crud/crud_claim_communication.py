#!/usr/bin/env python

"""CRUD operations for the claim communication model"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.claim_communication import ClaimCommunication
from app.schemas.claim_communication import (
    ClaimCommunicationCreateDB,
    ClaimCommunicationUpdate,
)


class CRUDClaimCommunication(
    CRUDBase[ClaimCommunication, ClaimCommunicationCreateDB, ClaimCommunicationUpdate]
):
    @staticmethod
    def get_by_claim_and_type(
        db_session: Session,
        *,
        claim_id: UUID,
        message_type: str,
    ) -> Sequence[ClaimCommunication]:
        """Get all communications for a claim filtered by message_type."""
        with db_session as session:
            stmt = (
                select(ClaimCommunication)
                .where(
                    and_(
                        ClaimCommunication.claim_id == claim_id,
                        ClaimCommunication.message_type == message_type,
                        ClaimCommunication.is_removed.is_(False),
                    )
                )
                .order_by(ClaimCommunication.created_at.desc())
            )
            return session.scalars(stmt).all()

    @staticmethod
    def get_thread(
        db_session: Session,
        *,
        thread_id: UUID,
    ) -> Sequence[ClaimCommunication]:
        """Get all messages in a thread, ordered chronologically."""
        with db_session as session:
            stmt = (
                select(ClaimCommunication)
                .where(
                    and_(
                        ClaimCommunication.thread_id == thread_id,
                        ClaimCommunication.is_removed.is_(False),
                    )
                )
                .order_by(ClaimCommunication.created_at.asc())
            )
            return session.scalars(stmt).all()

    @staticmethod
    def get_summary(
        db_session: Session,
        *,
        claim_id: UUID,
    ) -> dict:
        """Get communication counts and last dates per message_type."""
        with db_session as session:
            rows = (
                session.query(
                    ClaimCommunication.message_type,
                    func.count(ClaimCommunication.id),
                    func.max(ClaimCommunication.created_at),
                )
                .filter(
                    ClaimCommunication.claim_id == claim_id,
                    ClaimCommunication.is_removed.is_(False),
                )
                .group_by(ClaimCommunication.message_type)
                .all()
            )
            summary = {
                "carrier_count": 0,
                "client_count": 0,
                "internal_count": 0,
                "total_count": 0,
                "last_carrier_date": None,
                "last_client_date": None,
                "last_internal_date": None,
            }
            for msg_type, count, last_date in rows:
                summary["total_count"] += count
                if msg_type == "carrier":
                    summary["carrier_count"] = count
                    summary["last_carrier_date"] = last_date
                elif msg_type == "client":
                    summary["client_count"] = count
                    summary["last_client_date"] = last_date
                elif msg_type == "internal":
                    summary["internal_count"] = count
                    summary["last_internal_date"] = last_date
            return summary


claim_communication = CRUDClaimCommunication(ClaimCommunication)
