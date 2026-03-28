#!/usr/bin/env python

"""CRUD operations for the Fire Claim module"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.fire_claim import FireClaim
from app.schemas.fire_claim import FireClaimCreate, FireClaimUpdate


class CRUDFireClaim(CRUDBase[FireClaim, FireClaimCreate, FireClaimUpdate]):
    def mark_complete(self, db_session: Session, *, db_obj: FireClaim) -> FireClaim:
        """Set the fire claim status to intake_complete."""
        return self.update(
            db_session, db_obj=db_obj, obj_in={"status": "intake_complete"}
        )


fire_claim = CRUDFireClaim(FireClaim)
