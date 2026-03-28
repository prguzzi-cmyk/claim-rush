#!/usr/bin/env python

from enum import Enum


class RoleSearchField(str, Enum):
    """
    Enum for specifying the fields that can be used to search roles.
    """

    NAME: str = "name"
    DISPLAY_NAME: str = "display_name"
    CREATED_BY_FIRST_NAME: str = "created_by_first_name"
    CREATED_BY_LAST_NAME: str = "created_by_last_name"
    UPDATED_BY_FIRST_NAME: str = "updated_by_first_name"
    UPDATED_BY_LAST_NAME: str = "updated_by_last_name"
