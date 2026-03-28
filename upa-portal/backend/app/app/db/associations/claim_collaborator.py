#!/usr/bin/env python

"""Association of Claim and Collaborator"""

from sqlalchemy import Column, ForeignKey, Table

from app.db.base_class import Base

associate_claim_collaborator = Table(
    "claim_collaborator",
    Base.metadata,
    Column(
        "claim_id",
        ForeignKey(
            "claim.id",
            name="fk_claim_collaborator_claim_id",
        ),
        primary_key=True,
    ),
    Column(
        "user_id",
        ForeignKey(
            "user.id",
            name="fk_claim_collaborator_user_id",
        ),
        primary_key=True,
    ),
)
