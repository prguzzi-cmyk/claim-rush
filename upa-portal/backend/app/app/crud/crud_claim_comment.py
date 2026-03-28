#!/usr/bin/env python

"""CRUD operations for the claim comment model"""

from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.orm import Session, with_polymorphic

from app.crud.base import CRUDBase
from app.models import ClaimComment, Comment
from app.schemas import ClaimCommentCreate, ClaimCommentUpdate


class CRUDClaimComment(CRUDBase[ClaimComment, ClaimCommentCreate, ClaimCommentUpdate]):
    def get(
        self,
        db_session: Session,
        *,
        obj_id: UUID,
        even_removed: bool = False,
    ) -> ClaimComment | None:
        with db_session as session:
            # Define a polymorphic loader
            comment_poly = with_polymorphic(Comment, [ClaimComment])

            stmt = select(comment_poly)
            if even_removed:
                stmt = stmt.where(comment_poly.id == obj_id)
            else:
                stmt = stmt.where(
                    and_(
                        comment_poly.id == obj_id,
                        comment_poly.is_removed.is_(False),
                    )
                )

            return session.scalar(stmt)


claim_comment = CRUDClaimComment(ClaimComment)
