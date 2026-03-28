#!/usr/bin/env python

"""Vapi.ai voice call provider implementation"""

import logging

import requests

from app.utils.voice.base import TransferResult, VoiceCallProvider, VoiceCallResult

logger = logging.getLogger(__name__)


class VapiProvider(VoiceCallProvider):
    BASE_URL = "https://api.vapi.ai"

    def __init__(self, api_key: str, assistant_id: str, phone_number_id: str):
        self.api_key = api_key
        self.assistant_id = assistant_id
        self.phone_number_id = phone_number_id
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def initiate_outbound_call(
        self, to_phone: str, lead_context: dict
    ) -> VoiceCallResult:
        """Start an AI outbound call to the lead's phone number."""
        payload = {
            "assistantId": self.assistant_id,
            "phoneNumberId": self.phone_number_id,
            "customer": {"number": to_phone},
            "assistantOverrides": {
                "variableValues": lead_context,
            },
        }
        try:
            resp = requests.post(
                f"{self.BASE_URL}/call/phone",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                call_id = data.get("id")
                logger.info("Vapi outbound call initiated: %s → %s", call_id, to_phone)
                return VoiceCallResult(success=True, call_id=call_id)
            logger.error(
                "Vapi initiate_outbound_call failed (%d): %s",
                resp.status_code,
                resp.text[:200],
            )
            return VoiceCallResult(
                success=False, error=f"Vapi {resp.status_code}: {resp.text[:200]}"
            )
        except Exception as exc:
            logger.error("Vapi initiate_outbound_call exception: %s", exc)
            return VoiceCallResult(success=False, error=str(exc))

    def transfer_call(
        self, call_id: str, to_phone: str, agent_name: str
    ) -> TransferResult:
        """Transfer an active AI call to an agent's phone."""
        payload = {
            "destination": {
                "type": "number",
                "number": to_phone,
                "message": f"Transferring to {agent_name}",
            }
        }
        try:
            resp = requests.patch(
                f"{self.BASE_URL}/call/{call_id}",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            if resp.ok:
                logger.info("Vapi call %s transfer initiated to %s", call_id, to_phone)
                return TransferResult(success=True, call_id=call_id)
            logger.error(
                "Vapi transfer_call failed (%d): %s",
                resp.status_code,
                resp.text[:200],
            )
            return TransferResult(
                success=False, error=f"Vapi {resp.status_code}: {resp.text[:200]}"
            )
        except Exception as exc:
            logger.error("Vapi transfer_call exception: %s", exc)
            return TransferResult(success=False, error=str(exc))

    def end_call(self, call_id: str) -> bool:
        """Force-end a Vapi call."""
        try:
            resp = requests.delete(
                f"{self.BASE_URL}/call/{call_id}",
                headers=self.headers,
                timeout=15,
            )
            return resp.ok
        except Exception as exc:
            logger.error("Vapi end_call exception: %s", exc)
            return False

    def get_call_status(self, call_id: str) -> dict:
        """Get current status of a Vapi call."""
        try:
            resp = requests.get(
                f"{self.BASE_URL}/call/{call_id}",
                headers=self.headers,
                timeout=15,
            )
            if resp.ok:
                return resp.json()
            return {}
        except Exception as exc:
            logger.error("Vapi get_call_status exception: %s", exc)
            return {}
