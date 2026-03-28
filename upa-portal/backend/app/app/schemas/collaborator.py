#!/usr/bin/env python

"""Schema for Collaborator"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import UserMinimalId


# Shared properties
class CollaboratorBase(BaseModel):
    collaborator_ids: list[UUID] | None = Field(
        min_items=1, description="A list consist of users UUID."
    )


# Properties to receive via API on creation
class CollaboratorAppend(CollaboratorBase):
    pass


# Properties to receive via API on update
class CollaboratorRemove(CollaboratorBase):
    pass


# Additional properties to return via API
class Collaborator(BaseModel):
    is_collaborator: bool = Field(
        True, const=True, description="If the user is a collaborator."
    )

    # Relationships
    collaborators: list[UserMinimalId] | None = Field(
        default=None, description="A list of Claim Collaborators."
    )
