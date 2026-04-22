"""commission_claim: carrier estimate + divergence flag fields

Adds four nullable columns used by the I3 carrier-divergence detection:

    carrier_estimate_amount       NUMERIC(12,2)  — most recent linked
                                                   carrier estimate total
    estimate_divergence_flagged   BOOLEAN        — true when carrier is
                                                   materially LOWER than
                                                   firm per the policy in
                                                   app/config/estimate_divergence.py
    estimate_divergence_percentage NUMERIC(5,2)  — (firm - carrier) / firm,
                                                   stored as decimal (0.25 = 25%)
    estimate_divergence_dollars   NUMERIC(12,2)  — firm - carrier

`estimate_divergence_flagged` defaults to FALSE so existing rows render
as un-flagged without backfill. The other fields stay NULL until a
carrier estimate is parsed and linked.

Revision ID: c0mm155ag07
Revises: c0mm155ag06
Create Date: 2026-04-22 15:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'c0mm155ag07'
down_revision = 'c0mm155ag06'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('commission_claim',
        sa.Column('carrier_estimate_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('commission_claim',
        sa.Column('estimate_divergence_flagged', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('commission_claim',
        sa.Column('estimate_divergence_percentage', sa.Numeric(5, 4), nullable=True))
    op.add_column('commission_claim',
        sa.Column('estimate_divergence_dollars', sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('commission_claim', 'estimate_divergence_dollars')
    op.drop_column('commission_claim', 'estimate_divergence_percentage')
    op.drop_column('commission_claim', 'estimate_divergence_flagged')
    op.drop_column('commission_claim', 'carrier_estimate_amount')
