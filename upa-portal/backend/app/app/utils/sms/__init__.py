#!/usr/bin/env python

"""SMS provider factory"""

from app.core.config import settings
from app.utils.sms.base import SMSProvider, SMSResult


def get_sms_provider() -> SMSProvider | None:
    """Return configured SMS provider, or None if Twilio is disabled."""
    if not getattr(settings, "TWILIO_ENABLED", False):
        return None

    from app.utils.sms.twilio_provider import TwilioSMSProvider

    return TwilioSMSProvider(
        account_sid=settings.TWILIO_ACCOUNT_SID,
        auth_token=settings.TWILIO_AUTH_TOKEN,
        from_number=settings.TWILIO_FROM_NUMBER,
    )
