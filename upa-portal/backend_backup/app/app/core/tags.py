#!/usr/bin/env python

"""Different types of Tags"""

from enum import Enum


class Tags(Enum):
    auth: str = "Auth"
    utils: str = "Utils"
    permissions: str = "Permissions"
    roles: str = "Roles"
    users: str = "Users"
    leads: str = "Leads"


class LeadStatus(Enum):
    CALLBACK: str = "callback"
    NOT_INTERESTED: str = "not-interested"
    SIGNED: str = "signed"


class LeadSource(Enum):
    SELF: str = "self"
    COMPANY: str = "company"
    OTHER: str = "other"


class FollowUpType(Enum):
    PHONE_CALL: str = "phone-call"
    EMAIL: str = "email"
    MEETING: str = "meeting"
