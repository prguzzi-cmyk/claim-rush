#!/usr/bin/env python

"""Twilio SMS provider implementation"""

import logging

from twilio.rest import Client as TwilioClient

from app.utils.sms.base import SMSProvider, SMSResult

logger = logging.getLogger(__name__)


class TwilioSMSProvider(SMSProvider):
    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.client = TwilioClient(account_sid, auth_token)
        self.from_number = from_number

    def send_sms(self, to: str, body: str) -> SMSResult:
        try:
            message = self.client.messages.create(
                body=body,
                from_=self.from_number,
                to=to,
            )
            logger.info("SMS sent successfully to %s, SID: %s", to, message.sid)
            return SMSResult(success=True, message_sid=message.sid)
        except Exception as exc:
            logger.error("Failed to send SMS to %s: %s", to, exc)
            return SMSResult(success=False, error=str(exc))
