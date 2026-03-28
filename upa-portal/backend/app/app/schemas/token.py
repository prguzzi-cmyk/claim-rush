#!/usr/bin/env python

"""Access Token Schemas"""

from uuid import UUID

from pydantic import BaseModel, Field


class Token(BaseModel):
    access_token: str | None = Field(description="An access token")
    token_type: str | None = Field(example="bearer", description="Token type")


class TokenPayload(BaseModel):
    sub: UUID
