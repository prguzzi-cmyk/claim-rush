#!/usr/bin/env python

"""WebAuthn / Passkey Pydantic schemas"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class WebAuthnRegisterOptionsRequest(BaseModel):
    device_name: Optional[str] = Field(None, description="Friendly name for the device")


class WebAuthnRegisterVerifyRequest(BaseModel):
    credential: Any = Field(..., description="Registration response from browser")
    device_name: Optional[str] = None


class WebAuthnAuthenticateOptionsRequest(BaseModel):
    email: Optional[str] = Field(None, description="Optional email to scope authn")


class WebAuthnAuthenticateVerifyRequest(BaseModel):
    credential: Any = Field(..., description="Authentication response from browser")


class PasskeyOut(BaseModel):
    id: str
    device_name: Optional[str]
    created_at: str
    last_used_at: Optional[str]
    backed_up: bool

    class Config:
        orm_mode = True
