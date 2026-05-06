"""add structured address columns to fire_incident

Revision ID: addrnorm01
Revises: oq4n01
Create Date: 2026-05-06

Adds street_address, city, state, zip_code, full_address columns to
fire_incident so PulsePoint and other source addresses can be stored
in normalized form. The legacy `address` column is kept untouched for
backward compatibility — it will continue to mirror full_address.
"""

from alembic import op
import sqlalchemy as sa


revision = "addrnorm01"
down_revision = "oq4n01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fire_incident", sa.Column("street_address", sa.String(length=255), nullable=True))
    op.add_column("fire_incident", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column("fire_incident", sa.Column("state", sa.String(length=50), nullable=True))
    op.add_column("fire_incident", sa.Column("zip_code", sa.String(length=20), nullable=True))
    op.add_column("fire_incident", sa.Column("full_address", sa.String(length=500), nullable=True))

    op.create_index("ix_fire_incident_state", "fire_incident", ["state"])
    op.create_index("ix_fire_incident_zip_code", "fire_incident", ["zip_code"])


def downgrade() -> None:
    op.drop_index("ix_fire_incident_zip_code", table_name="fire_incident")
    op.drop_index("ix_fire_incident_state", table_name="fire_incident")
    op.drop_column("fire_incident", "full_address")
    op.drop_column("fire_incident", "zip_code")
    op.drop_column("fire_incident", "state")
    op.drop_column("fire_incident", "city")
    op.drop_column("fire_incident", "street_address")
