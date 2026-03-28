#!/usr/bin/env python

"""Pydantic schemas for voice secretary configuration."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class VoiceSecretaryCreate(BaseModel):
    agent_id: UUID
    secretary_name: str = "AI Assistant"
    greeting_name: Optional[str] = None
    voice_provider: str = "platform_default"
    voice_agent_id: Optional[str] = None
    voice_gender: str = "default"
    voice_style: str = "professional"
    voice_id: Optional[str] = None
    language: str = "en-US"
    is_premium_voice_enabled: bool = False
    subscription_tier: str = "standard"
    default_script_id: Optional[UUID] = None
    branded_greeting: Optional[str] = None
    branded_closing: Optional[str] = None
    personality_preset: str = "standard"
    call_style: str = "outbound"
    can_handle_inbound: bool = False
    can_transfer_to_agent: bool = True


class VoiceSecretaryUpdate(BaseModel):
    secretary_name: Optional[str] = None
    greeting_name: Optional[str] = None
    voice_provider: Optional[str] = None
    voice_agent_id: Optional[str] = None
    voice_gender: Optional[str] = None
    voice_style: Optional[str] = None
    voice_id: Optional[str] = None
    language: Optional[str] = None
    is_premium_voice_enabled: Optional[bool] = None
    subscription_tier: Optional[str] = None
    default_script_id: Optional[UUID] = None
    branded_greeting: Optional[str] = None
    branded_closing: Optional[str] = None
    personality_preset: Optional[str] = None
    call_style: Optional[str] = None
    is_active: Optional[bool] = None
    can_handle_inbound: Optional[bool] = None
    can_transfer_to_agent: Optional[bool] = None


class VoiceSecretaryRead(BaseModel):
    id: UUID
    agent_id: UUID
    secretary_name: str
    greeting_name: Optional[str]
    voice_provider: str
    voice_agent_id: Optional[str]
    voice_gender: str
    voice_style: str
    voice_id: Optional[str]
    language: str
    is_premium_voice_enabled: bool
    subscription_tier: str
    default_script_id: Optional[UUID]
    branded_greeting: Optional[str]
    branded_closing: Optional[str]
    personality_preset: str
    call_style: str
    is_active: bool
    can_handle_inbound: bool
    can_transfer_to_agent: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ResolvedVoiceProfile(BaseModel):
    """
    Result of resolveVoiceProfile() — everything needed to place a call.
    Returned to any service that needs to initiate a voice interaction.
    """
    agent_id: UUID
    secretary_name: str
    voice_provider: str
    voice_agent_id: Optional[str]
    voice_gender: str
    voice_style: str
    voice_id: Optional[str]
    language: str
    script_style: str
    branded_greeting: Optional[str]
    branded_closing: Optional[str]
    is_premium: bool
    subscription_tier: str
    can_transfer: bool
