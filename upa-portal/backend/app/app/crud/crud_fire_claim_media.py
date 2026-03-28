#!/usr/bin/env python

"""CRUD operations for the Fire Claim Media module"""

from uuid import UUID

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import Sequence, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.fire_claim_media import FireClaimMedia
from app.schemas.fire_claim_media import FireClaimMediaCreate, FireClaimMediaUpdate


class CRUDFireClaimMedia(
    CRUDBase[FireClaimMedia, FireClaimMediaCreate, FireClaimMediaUpdate]
):
    def get_by_claim(
        self,
        db_session: Session,
        *,
        fire_claim_id: UUID,
        paginated: bool = True,
    ) -> Page | Sequence[FireClaimMedia] | None:
        """Get all media for a fire claim."""
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.fire_claim_id == fire_claim_id)
                .order_by(self.model.created_at)
            )
            if paginated:
                return paginate(session, stmt)
            return session.scalars(stmt).all()


fire_claim_media = CRUDFireClaimMedia(FireClaimMedia)
