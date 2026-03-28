#!/usr/bin/env python

from enum import Enum


class LeadStatusCreateEnum(str, Enum):
    """Enum representing different lead statuses while creating a lead in the system."""

    CALLBACK: str = "callback"
    NOT_INTERESTED: str = "not-interested"
    SIGNED: str = "signed"
    TRANSFER: str = "transfer"
    NOT_QUALIFIED: str = "not-qualified"
    INTERESTED: str = "interested"
    PENDING_SIGN: str = "pending-sign"


class LeadStatusEnum(str, Enum):
    """Enum representing different lead statuses in the system."""

    CALLBACK: str = "callback"
    NOT_INTERESTED: str = "not-interested"
    SIGNED: str = "signed"
    SIGNED_APPROVED: str = "signed-approved"
    TRANSFER: str = "transfer"
    NOT_QUALIFIED: str = "not-qualified"
    INTERESTED: str = "interested"
    PENDING_SIGN: str = "pending-sign"
