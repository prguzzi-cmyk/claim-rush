"""add qualification_data_json to lead_contact_tracker

Revision ID: v1o2i3c4e5q6
Revises: d3f4n5s6e7v8
Create Date: 2026-03-15 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "v1o2i3c4e5q6"
down_revision = "d3f4n5s6e7v8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lead_contact_tracker",
        sa.Column("qualification_data_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("lead_contact_tracker", "qualification_data_json")
