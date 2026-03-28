#!/usr/bin/env python

"""Relationships mapping for various models"""

from app.models import User

RELATIONSHIPS_MAPPING = {
    "Role": {
        "created_by_first_name": {
            "related_model": User,
            "on_clause": "created_by_id",  # foreign key in Role
            "related_column": "first_name",  # column in User
        },
        "created_by_last_name": {
            "related_model": User,
            "on_clause": "created_by_id",  # foreign key in Role
            "related_column": "last_name",  # column in User
        },
        "updated_by_first_name": {
            "related_model": User,
            "on_clause": "updated_by_id",  # foreign key in Role
            "related_column": "first_name",  # column in User
        },
        "updated_by_last_name": {
            "related_model": User,
            "on_clause": "updated_by_id",  # foreign key in Role
            "related_column": "last_name",  # column in User
        },
    }
}
