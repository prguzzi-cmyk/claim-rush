#!/usr/bin/env python

"""Schema for lead comment"""

from uuid import UUID

from pydantic import Field

from app.schemas import Audit, Timestamp
from app.schemas.comment import CommentBase, CommentCreate, CommentInDB, CommentUpdate


# Shared properties
class LeadCommentBase(CommentBase):
    ...


# Properties to receive via API on creation
class LeadCommentCreate(CommentCreate):
    lead_id: UUID = Field(description="The lead ID.")


# Properties to receive via API on update
class LeadCommentUpdate(CommentUpdate, LeadCommentBase):
    ...


# Properties to return via API on lead file fetch from DB
class LeadCommentInDB(CommentInDB, LeadCommentBase):
    lead_id: UUID | None = Field(description="The lead ID.")


# Additional properties to return via API
class LeadComment(Timestamp, Audit, LeadCommentInDB):
    ...
