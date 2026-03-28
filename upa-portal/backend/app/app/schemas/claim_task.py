#!/usr/bin/env python

"""Schema for claim task"""

from uuid import UUID

from pydantic import Field

from app.core.enums import TaskType
from app.schemas import Audit, Timestamp
from app.schemas.user_task import (
    UserTaskBase,
    UserTaskCreate,
    UserTaskCreateDB,
    UserTaskInDB,
    UserTaskUpdate,
)


# Shared properties
class ClaimTaskBase(UserTaskBase):
    task_type: TaskType | None = Field(description="Claim task type.")
    related_claim_phase: str | None = Field(default=None, description="Related claim phase.")


# Properties to receive via API on creation
class ClaimTaskCreate(UserTaskCreate, ClaimTaskBase):
    ...


# Properties for CRUD on creation
class ClaimTaskCreateDB(UserTaskCreateDB, ClaimTaskBase):
    claim_id: UUID = Field(description="The claim ID.")


# Properties to receive via API on update
class ClaimTaskUpdate(UserTaskUpdate, ClaimTaskBase):
    ...


# Properties to return via API on claim task fetch from DB
class ClaimTaskInDB(UserTaskInDB, ClaimTaskBase):
    claim_id: UUID = Field(description="The claim ID.")


# Additional properties to return via API
class ClaimTask(Timestamp, Audit, ClaimTaskInDB):
    ...
