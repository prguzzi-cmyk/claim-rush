"""add county column to fire_incident for reverse-geocode enrichment

Revision ID: addrnorm02
Revises: addrnorm01
Create Date: 2026-05-06
"""

from alembic import op
import sqlalchemy as sa


revision = "addrnorm02"
down_revision = "addrnorm01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fire_incident", sa.Column("county", sa.String(length=100), nullable=True))
    op.create_index("ix_fire_incident_county", "fire_incident", ["county"])


def downgrade() -> None:
    op.drop_index("ix_fire_incident_county", table_name="fire_incident")
    op.drop_column("fire_incident", "county")
