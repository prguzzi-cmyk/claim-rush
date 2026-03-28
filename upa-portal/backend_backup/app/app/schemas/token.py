#!/usr/bin/env python

"""Access Token Schemas"""

from uuid import UUID

from pydantic import BaseModel, Field


class Token(BaseModel):
    access_token: str
    token_type: str = Field(example="bearer")


class TokenPayload(BaseModel):
    sub: UUID
