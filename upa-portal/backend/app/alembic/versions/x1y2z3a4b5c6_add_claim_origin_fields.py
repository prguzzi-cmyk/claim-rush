"""add_claim_origin_fields

Revision ID: x1y2z3a4b5c6
Revises: w1x2y3z4a5b6
Create Date: 2026-03-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'x1y2z3a4b5c6'
down_revision = 'v1o2i3c4e5q6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('claim', sa.Column('origin_type', sa.String(50), server_default='new-claim'))
    op.add_column('claim', sa.Column('date_aci_entered', sa.Date(), nullable=True))
    op.add_column('claim', sa.Column('prior_carrier_payments', sa.Float(), nullable=True))
    op.add_column('claim', sa.Column('recovery_mode', sa.String(30), server_default='none'))


def downgrade() -> None:
    op.drop_column('claim', 'recovery_mode')
    op.drop_column('claim', 'prior_carrier_payments')
    op.drop_column('claim', 'date_aci_entered')
    op.drop_column('claim', 'origin_type')
