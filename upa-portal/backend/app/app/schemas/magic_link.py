#!/usr/bin/env python

"""Magic Link Pydantic schemas"""

from pydantic import BaseModel, Field


class MagicLinkRequest(BaseModel):
    email: str = Field(..., description="Email address to send the magic link to")


class MagicLinkVerify(BaseModel):
    token: str = Field(..., description="Magic link token from the email")
