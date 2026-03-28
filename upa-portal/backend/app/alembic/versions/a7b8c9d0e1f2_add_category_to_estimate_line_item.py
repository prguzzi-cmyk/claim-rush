"""Add category to estimate_line_item

Revision ID: a7b8c9d0e1f2
Revises: 35fed1910100
Create Date: 2026-03-12 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a7b8c9d0e1f2"
down_revision = "35fed1910100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "estimate_line_item",
        sa.Column("category", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("estimate_line_item", "category")
