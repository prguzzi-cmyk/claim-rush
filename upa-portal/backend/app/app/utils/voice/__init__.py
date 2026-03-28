#!/usr/bin/env python

"""Voice call provider factory — supports per-agent voice secretary configuration."""

from typing import Optional
from uuid import UUID

from app.schemas.voice_secretary import ResolvedVoiceProfile
from app.utils.voice.base import VoiceCallProvider


def get_voice_provider(
    profile: Optional[ResolvedVoiceProfile] = None,
) -> VoiceCallProvider | None:
    """
    Return the configured voice call provider.

    If a ResolvedVoiceProfile is provided, uses the agent's configured provider.
    Otherwise falls back to the platform default (VAPI).

    Supports: vapi, retell, bland, twilio, elevenlabs (add implementations as needed).
    """
    from app.core.config import settings

    provider_name = "platform_default"
    if profile and profile.voice_provider != "platform_default":
        provider_name = profile.voice_provider

    # Resolve platform_default to the configured default provider
    if provider_name == "platform_default":
        if settings.VAPI_ENABLED:
            provider_name = "vapi"
        else:
            return None

    if provider_name == "vapi":
        from app.utils.voice.vapi_provider import VapiProvider

        return VapiProvider(
            api_key=settings.VAPI_API_KEY,
            assistant_id=profile.voice_agent_id if profile and profile.voice_agent_id else settings.VAPI_ASSISTANT_ID,
            phone_number_id=settings.VAPI_PHONE_NUMBER_ID,
        )

    # Future providers — add implementations here
    # if provider_name == "retell":
    #     from app.utils.voice.retell_provider import RetellProvider
    #     return RetellProvider(api_key=settings.RETELL_API_KEY, agent_id=profile.voice_agent_id)
    #
    # if provider_name == "bland":
    #     from app.utils.voice.bland_provider import BlandProvider
    #     return BlandProvider(api_key=settings.BLAND_API_KEY)
    #
    # if provider_name == "twilio":
    #     from app.utils.voice.twilio_provider import TwilioProvider
    #     return TwilioProvider(account_sid=settings.TWILIO_SID, auth_token=settings.TWILIO_TOKEN)

    return None
