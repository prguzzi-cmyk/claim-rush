"""Add ai_analysis to fire_claim

Revision ID: a1f2b3c4d5e6
Revises: 220885b760da
Create Date: 2026-03-05 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1f2b3c4d5e6"
down_revision = "220885b760da"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fire_claim", sa.Column("ai_analysis", sa.Text(), nullable=True))
    op.add_column(
        "fire_claim",
        sa.Column("ai_analysis_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fire_claim", "ai_analysis_at")
    op.drop_column("fire_claim", "ai_analysis")
