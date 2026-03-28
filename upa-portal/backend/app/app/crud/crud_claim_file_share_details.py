#!/usr/bin/env python

"""CRUD operations for the claim file share detail model"""

from typing import List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.claim_file_share import ClaimFileShareDetails


class CRUDClaimFileShareDetail:
    def __init__(self, model):
        self.model = model

    @staticmethod
    def get_file_ids_by_share_id(db_session: Session, share_id: UUID) -> List[UUID]:
        """
        Retrieve all claim_file_ids associated with a given share_id from the database.

        Parameters:
        - db_session (Session): The SQLAlchemy session to execute the operations.
        - share_id (UUID): The UUID of the claim file share to retrieve file IDs for.

        Returns:
        - List[UUID]: A list of UUIDs representing the file IDs associated with the share ID.
        """

        with db_session as session:
            stmt = select(ClaimFileShareDetails.claim_file_id).where(
                ClaimFileShareDetails.share_id == share_id
            )
            results = session.scalars(stmt).all()

        return results


# Usage
crud_claim_file_share_detail = CRUDClaimFileShareDetail(ClaimFileShareDetails)
