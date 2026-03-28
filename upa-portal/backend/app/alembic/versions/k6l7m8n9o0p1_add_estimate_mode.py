"""Add estimate_mode column to estimate_project

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "k6l7m8n9o0p1"
down_revision = "j5k6l7m8n9o0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "estimate_project",
        sa.Column(
            "estimate_mode",
            sa.String(50),
            nullable=False,
            server_default="residential",
        ),
    )


def downgrade() -> None:
    op.drop_column("estimate_project", "estimate_mode")
