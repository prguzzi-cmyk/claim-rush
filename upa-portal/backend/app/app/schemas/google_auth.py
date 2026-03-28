#!/usr/bin/env python

"""Google Auth Pydantic schemas"""

from pydantic import BaseModel, Field


class GoogleVerifyRequest(BaseModel):
    id_token: str = Field(..., description="Google ID token from Sign-In")


class GoogleAuthStatus(BaseModel):
    enabled: bool
    client_id: str
