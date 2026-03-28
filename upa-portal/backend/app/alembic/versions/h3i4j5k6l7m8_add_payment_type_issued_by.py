"""add payment_type and issued_by to claim_payment

Revision ID: h3i4j5k6l7m8
Revises: s1k2i3p4s5h6
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "h3i4j5k6l7m8"
down_revision = "g2h3i4j5k6l7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("claim_payment", sa.Column("payment_type", sa.String(50), nullable=True))
    op.add_column("claim_payment", sa.Column("issued_by", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("claim_payment", "issued_by")
    op.drop_column("claim_payment", "payment_type")
