"""link estimate_project + carrier_estimate to commission_claim

Both tables historically had no link to the commission engine. This adds
a nullable `commission_claim_id` FK on each so an EstimateProject (firm
estimate) and a CarrierEstimate (parsed carrier PDF) can be associated
with the commission_claim that drives advance tier eligibility.

EstimateProject already has a legacy `claim_id` pointing at the older
`claim` table — that column is left untouched. The new column is
deliberately named `commission_claim_id` to avoid ambiguity.

Both columns are indexed for the lookup paths added in I2 / I3
(claim → its estimates, estimate → its claim).

Revision ID: c0mm155ag06
Revises: c0mm155ag05
Create Date: 2026-04-22 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'c0mm155ag06'
down_revision = 'c0mm155ag05'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('estimate_project',
        sa.Column('commission_claim_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_estimate_project_commission_claim_id',
        source_table='estimate_project',
        referent_table='commission_claim',
        local_cols=['commission_claim_id'],
        remote_cols=['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        'ix_estimate_project_commission_claim_id',
        'estimate_project',
        ['commission_claim_id'],
    )

    op.add_column('carrier_estimate',
        sa.Column('commission_claim_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_carrier_estimate_commission_claim_id',
        source_table='carrier_estimate',
        referent_table='commission_claim',
        local_cols=['commission_claim_id'],
        remote_cols=['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        'ix_carrier_estimate_commission_claim_id',
        'carrier_estimate',
        ['commission_claim_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_carrier_estimate_commission_claim_id', table_name='carrier_estimate')
    op.drop_constraint('fk_carrier_estimate_commission_claim_id', 'carrier_estimate', type_='foreignkey')
    op.drop_column('carrier_estimate', 'commission_claim_id')

    op.drop_index('ix_estimate_project_commission_claim_id', table_name='estimate_project')
    op.drop_constraint('fk_estimate_project_commission_claim_id', 'estimate_project', type_='foreignkey')
    op.drop_column('estimate_project', 'commission_claim_id')
