"""Add status, source, confidence to estimate_line_item

Revision ID: d4e6f8a0b2c4
Revises: c3d5e7f9a1b2
Create Date: 2026-03-05 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d4e6f8a0b2c4"
down_revision = "c3d5e7f9a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "estimate_line_item",
        sa.Column("status", sa.String(20), server_default="approved", nullable=False),
    )
    op.add_column(
        "estimate_line_item",
        sa.Column("source", sa.String(20), server_default="user", nullable=False),
    )
    op.add_column(
        "estimate_line_item",
        sa.Column("confidence", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("estimate_line_item", "confidence")
    op.drop_column("estimate_line_item", "source")
    op.drop_column("estimate_line_item", "status")
