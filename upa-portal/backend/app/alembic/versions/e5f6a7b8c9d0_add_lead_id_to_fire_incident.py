"""Add lead_id FK to fire_incident table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fire_incident",
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_fire_incident_lead_id",
        "fire_incident",
        "lead",
        ["lead_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_fire_incident_lead_id", "fire_incident", ["lead_id"])


def downgrade() -> None:
    op.drop_index("ix_fire_incident_lead_id", table_name="fire_incident")
    op.drop_constraint("fk_fire_incident_lead_id", "fire_incident", type_="foreignkey")
    op.drop_column("fire_incident", "lead_id")
