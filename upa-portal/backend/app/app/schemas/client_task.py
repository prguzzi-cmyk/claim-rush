#!/usr/bin/env python

"""Schema for client task"""

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
class ClientTaskBase(UserTaskBase):
    task_type: TaskType | None = Field(description="Client task type.")


# Properties to receive via API on creation
class ClientTaskCreate(UserTaskCreate, ClientTaskBase):
    ...


# Properties for CRUD on creation
class ClientTaskCreateDB(UserTaskCreateDB, ClientTaskBase):
    client_id: UUID = Field(description="The client ID.")


# Properties to receive via API on update
class ClientTaskUpdate(UserTaskUpdate, ClientTaskBase):
    ...


# Properties to return via API on client task fetch from DB
class ClientTaskInDB(UserTaskInDB, ClientTaskBase):
    client_id: UUID = Field(description="The client ID.")


# Additional properties to return via API
class ClientTask(Timestamp, Audit, ClientTaskInDB):
    ...
