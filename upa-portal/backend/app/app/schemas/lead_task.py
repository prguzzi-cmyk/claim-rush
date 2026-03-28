#!/usr/bin/env python

"""Schema for lead task"""

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
class LeadTaskBase(UserTaskBase):
    task_type: TaskType | None = Field(description="Lead task type.")


# Properties to receive via API on creation
class LeadTaskCreate(UserTaskCreate, LeadTaskBase):
    ...


# Properties for CRUD on creation
class LeadTaskCreateDB(UserTaskCreateDB, LeadTaskBase):
    lead_id: UUID = Field(description="The lead ID.")


# Properties to receive via API on update
class LeadTaskUpdate(UserTaskUpdate, LeadTaskBase):
    ...


# Properties to return via API on lead task fetch from DB
class LeadTaskInDB(UserTaskInDB, LeadTaskBase):
    lead_id: UUID = Field(description="The lead ID.")


# Additional properties to return via API
class LeadTask(Timestamp, Audit, LeadTaskInDB):
    ...
