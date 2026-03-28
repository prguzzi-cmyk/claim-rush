#!/usr/bin/env python

"""Schema for claim comment"""

from uuid import UUID

from pydantic import Field

from app.schemas import Audit, Timestamp
from app.schemas.comment import CommentBase, CommentCreate, CommentInDB, CommentUpdate


# Shared properties
class ClaimCommentBase(CommentBase):
    ...


# Properties to receive via API on creation
class ClaimCommentCreate(CommentCreate):
    claim_id: UUID = Field(description="The claim ID.")


# Properties to receive via API on update
class ClaimCommentUpdate(CommentUpdate, ClaimCommentBase):
    ...


# Properties to return via API on claim comment fetch from DB
class ClaimCommentInDB(CommentInDB, ClaimCommentBase):
    claim_id: UUID | None = Field(description="The claim ID.")


# Additional properties to return via API
class ClaimComment(Timestamp, Audit, ClaimCommentInDB):
    ...
