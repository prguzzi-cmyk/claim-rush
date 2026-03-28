"""add carrier_payment table

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2026-03-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "g2h3i4j5k6l7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "carrier_payment",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("payment_amount", sa.Float(), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("payment_type", sa.String(50), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "project_id",
            sa.UUID(),
            sa.ForeignKey(
                "estimate_project.id",
                name="fk_carrier_payment_project_id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "created_by_id",
            sa.UUID(),
            sa.ForeignKey(
                "user.id",
                name="fk_carrier_payment_created_by_id",
            ),
            nullable=True,
        ),
        sa.Column(
            "updated_by_id",
            sa.UUID(),
            sa.ForeignKey(
                "user.id",
                name="fk_carrier_payment_updated_by_id",
            ),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.create_index("ix_carrier_payment_project_id", "carrier_payment", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_carrier_payment_project_id")
    op.drop_table("carrier_payment")
