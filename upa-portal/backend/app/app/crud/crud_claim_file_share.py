#!/usr/bin/env python

"""CRUD operations for the claim file share model"""

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models import ClaimFileShare, ClaimFileShareDetails
from app.schemas import ClaimFileShareCreate, ClaimFileShareUpdate


class CRUDClaimFileShare(
    CRUDBase[ClaimFileShare, ClaimFileShareCreate, ClaimFileShareUpdate]
):
    def create(
        self, db_session: Session, *, obj_in: ClaimFileShareCreate
    ) -> ClaimFileShare:
        try:
            with db_session as session:
                share_obj = ClaimFileShare(
                    id=obj_in.file_share_id,
                    email_files_to=",".join(obj_in.email_files_to),
                    share_type=obj_in.share_type.value,
                    expiration_date=obj_in.expiration_date,
                    message=obj_in.message,
                )

                session.add(share_obj)
                session.flush()

                # Add details for each file to be shared
                details = [
                    ClaimFileShareDetails(claim_file_id=file_id, share_id=share_obj.id)
                    for file_id in obj_in.claim_file_ids
                ]
                db_session.add_all(details)
                db_session.commit()  # Commit everything at once
                db_session.refresh(share_obj)

                return share_obj

        except Exception as exc:
            print(exc)


crud_claim_file_share = CRUDClaimFileShare(ClaimFileShare)
