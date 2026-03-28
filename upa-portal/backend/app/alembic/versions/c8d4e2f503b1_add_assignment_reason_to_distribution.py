"""add assignment_reason to lead_distribution_history

Revision ID: c8d4e2f503b1
Revises: b7c3d9e1f402
Create Date: 2026-03-16

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c8d4e2f503b1"
down_revision = "b7c3d9e1f402"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lead_distribution_history",
        sa.Column("assignment_reason", sa.String(30), nullable=True),
    )
    op.create_index(
        "ix_lead_dist_assignment_reason",
        "lead_distribution_history",
        ["assignment_reason"],
    )


def downgrade() -> None:
    op.drop_index("ix_lead_dist_assignment_reason", table_name="lead_distribution_history")
    op.drop_column("lead_distribution_history", "assignment_reason")
