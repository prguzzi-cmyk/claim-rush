#!/usr/bin/env python

"""Abstract base class for SMS providers"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class SMSResult:
    success: bool
    message_sid: str | None = None
    error: str | None = None


class SMSProvider(ABC):
    @abstractmethod
    def send_sms(self, to: str, body: str) -> SMSResult:
        ...
