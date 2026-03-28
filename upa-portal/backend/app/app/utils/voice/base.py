#!/usr/bin/env python

"""Abstract base class for AI voice call providers"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class VoiceCallResult:
    success: bool
    call_id: str | None = None
    error: str | None = None


@dataclass
class TransferResult:
    success: bool
    call_id: str | None = None
    error: str | None = None


class VoiceCallProvider(ABC):
    @abstractmethod
    def initiate_outbound_call(
        self, to_phone: str, lead_context: dict
    ) -> VoiceCallResult:
        """Initiate an AI-powered outbound call to the lead."""
        ...

    @abstractmethod
    def transfer_call(
        self, call_id: str, to_phone: str, agent_name: str
    ) -> TransferResult:
        """Transfer an active call to an agent's phone number."""
        ...

    @abstractmethod
    def end_call(self, call_id: str) -> bool:
        """Force-end a call."""
        ...

    @abstractmethod
    def get_call_status(self, call_id: str) -> dict:
        """Get current status of a call."""
        ...
