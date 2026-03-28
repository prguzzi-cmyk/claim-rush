"""Add estimate_project_id to fire_claim

Revision ID: c3d5e7f9a1b2
Revises: b2c4d6e8f0a1
Create Date: 2026-03-05 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c3d5e7f9a1b2"
down_revision = "b2c4d6e8f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fire_claim",
        sa.Column("estimate_project_id", sa.UUID(), nullable=True),
    )
    op.create_unique_constraint(
        "uq_fire_claim_estimate_project_id",
        "fire_claim",
        ["estimate_project_id"],
    )
    op.create_foreign_key(
        "fk_fire_claim_estimate_project_id",
        "fire_claim",
        "estimate_project",
        ["estimate_project_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_fire_claim_estimate_project_id", "fire_claim", type_="foreignkey")
    op.drop_constraint("uq_fire_claim_estimate_project_id", "fire_claim", type_="unique")
    op.drop_column("fire_claim", "estimate_project_id")
