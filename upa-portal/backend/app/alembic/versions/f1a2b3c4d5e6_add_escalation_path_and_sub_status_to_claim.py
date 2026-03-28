"""add escalation_path and sub_status to claim

Revision ID: f1a2b3c4d5e6
Revises: e45d53752286
Create Date: 2026-03-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "e45d53752286"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "claim",
        sa.Column("escalation_path", sa.String(30), nullable=True, server_default="none"),
    )
    op.add_column(
        "claim",
        sa.Column("sub_status", sa.String(50), nullable=True, server_default="none"),
    )


def downgrade() -> None:
    op.drop_column("claim", "sub_status")
    op.drop_column("claim", "escalation_path")
