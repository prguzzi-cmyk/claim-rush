"""add carrier_adjuster_email to fire_claim

Revision ID: e45d53752286
Revises: b5d6e7f8a9c0
Create Date: 2026-03-13 12:59:26.060241

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e45d53752286'
down_revision = 'b5d6e7f8a9c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('fire_claim', sa.Column('carrier_adjuster_email', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('fire_claim', 'carrier_adjuster_email')
