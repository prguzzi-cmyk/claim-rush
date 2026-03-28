"""Add carrier_report to fire_claim

Revision ID: b2c4d6e8f0a1
Revises: a1f2b3c4d5e6
Create Date: 2026-03-05 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b2c4d6e8f0a1"
down_revision = "a1f2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fire_claim", sa.Column("carrier_report", sa.Text(), nullable=True))
    op.add_column(
        "fire_claim",
        sa.Column("carrier_report_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fire_claim", "carrier_report_at")
    op.drop_column("fire_claim", "carrier_report")
