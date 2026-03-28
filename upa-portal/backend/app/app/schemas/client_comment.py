#!/usr/bin/env python

"""Schema for client comment"""

from uuid import UUID

from pydantic import Field

from app.schemas import Audit, Timestamp
from app.schemas.comment import CommentBase, CommentCreate, CommentInDB, CommentUpdate


# Shared properties
class ClientCommentBase(CommentBase):
    ...


# Properties to receive via API on creation
class ClientCommentCreate(CommentCreate):
    client_id: UUID = Field(description="The client ID.")


# Properties to receive via API on update
class ClientCommentUpdate(CommentUpdate, ClientCommentBase):
    ...


# Properties to return via API on client file fetch from DB
class ClientCommentInDB(CommentInDB, ClientCommentBase):
    client_id: UUID | None = Field(description="The client ID.")


# Additional properties to return via API
class ClientComment(Timestamp, Audit, ClientCommentInDB):
    ...
