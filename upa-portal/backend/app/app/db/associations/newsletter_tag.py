#!/usr/bin/env python

"""Association of Newsletter and Tag"""

from sqlalchemy import Column, ForeignKey, Table

from app.db.base_class import Base

associate_newsletter_tag = Table(
    "newsletter_tag",
    Base.metadata,
    Column(
        "newsletter_id",
        ForeignKey(
            "newsletter.id",
            name="fk_newsletter_tag_newsletter_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
    Column(
        "tag_id",
        ForeignKey(
            "tag.id",
            name="fk_newsletter_tag_tag_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
)
