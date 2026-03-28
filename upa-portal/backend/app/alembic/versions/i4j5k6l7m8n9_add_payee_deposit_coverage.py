"""add payee, deposit_status, related_coverage to claim_payment

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "i4j5k6l7m8n9"
down_revision = "h3i4j5k6l7m8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("claim_payment", sa.Column("payee", sa.String(200), nullable=True))
    op.add_column("claim_payment", sa.Column("deposit_status", sa.String(50), nullable=True))
    op.add_column("claim_payment", sa.Column("related_coverage", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("claim_payment", "related_coverage")
    op.drop_column("claim_payment", "deposit_status")
    op.drop_column("claim_payment", "payee")
