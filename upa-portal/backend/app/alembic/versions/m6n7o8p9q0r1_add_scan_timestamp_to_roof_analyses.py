"""add scan_timestamp to roof_analyses

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Create Date: 2026-03-10

"""

from alembic import op
import sqlalchemy as sa

revision = "m6n7o8p9q0r1"
down_revision = "l5m6n7o8p9q0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "roof_analyses",
        sa.Column("scan_timestamp", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("roof_analyses", "scan_timestamp")
