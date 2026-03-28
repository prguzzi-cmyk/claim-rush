#!/usr/bin/env python

"""Association of Role and Permission"""

from sqlalchemy import Column, ForeignKey, Table

from app.db.base_class import Base

associate_role_permission = Table(
    "role_permission",
    Base.metadata,
    Column(
        "role_id",
        ForeignKey(
            "role.id",
            name="fk_role_permission_role_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
    Column(
        "permission_id",
        ForeignKey(
            "permission.id",
            name="fk_role_permission_permission_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
)
