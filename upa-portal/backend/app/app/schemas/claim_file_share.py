#!/usr/bin/env python

"""Schema for ClaimFileShare"""

from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.core.enums import ClaimFileShareType
from app.schemas import Audit, Timestamp
from app.utils.common import default_expiration_date


# Shared properties
class ClaimFileShareBase(BaseModel):
    file_share_id: UUID = Field(description="file share id")
    claim_file_ids: List[UUID] = Field(description="claim file id list")
    email_files_to: List[EmailStr] = Field(
        description="claim files recipient email addresses"
    )
    share_type: ClaimFileShareType = Field(
        description="share type, 1 - Sent As Link, 2 - Sent As Attachment",
        default=ClaimFileShareType.SENT_AS_LINK,
    )
    expiration_date: Optional[date | None] = Field(
        default_factory=default_expiration_date,
        description="The expiration date of shared files is 30 days by default",
    )
    message: str | None = Field(description="message (optional)")


# Properties to receive via API on creation
class ClaimFileShareCreate(ClaimFileShareBase):
    pass


# Properties to receive via API on update
class ClaimFileShareUpdate(BaseModel):
    pass


# Properties to return via API on file fetch from DB
class ClaimFileShareInDB(BaseModel):
    id: UUID = Field(description="UUID of the claim file share entry.")

    class Config:
        orm_mode = True


# Additional properties to return via API
class ClaimFileShareResponse(Timestamp, Audit, ClaimFileShareInDB):
    pass


# Download Links to return via API
class ClaimFileShareDownloadLinksResponse(BaseModel):
    expiration_date: str | None = Field(description="Expiry date of all links.")
    files: List[dict] | None = Field(
        description="Individual Download links for the shared files."
    )
