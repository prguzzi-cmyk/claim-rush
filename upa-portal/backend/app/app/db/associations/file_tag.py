#!/usr/bin/env python

"""Association of File and Tag"""

from sqlalchemy import Column, ForeignKey, Table

from app.db.base_class import Base

associate_file_tag = Table(
    "file_tag",
    Base.metadata,
    Column(
        "file_id",
        ForeignKey(
            "file.id",
            name="fk_file_tag_file_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
    Column(
        "tag_id",
        ForeignKey(
            "tag.id",
            name="fk_file_tag_tag_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
)
