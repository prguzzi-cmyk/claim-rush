#!/usr/bin/env python

from enum import Enum


class SortOrder(str, Enum):
    """
    Enum for specifying the sort order of query results.
    """

    ASC: str = "asc"
    DESC: str = "desc"
