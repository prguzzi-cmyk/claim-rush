"""commission_claim: add claim_type ('residential' | 'commercial')

Three-step add to make the column NOT NULL safely:
  1. add nullable VARCHAR(20)
  2. backfill existing rows to 'residential' (per prior product context —
     all current test/demo claims are residential)
  3. ALTER to NOT NULL and add a CHECK constraint enforcing the literal set

Used by J3 to switch divergence detection to bidirectional mode for
commercial claims (coinsurance handling).

Revision ID: c0mm155ag09
Revises: c0mm155ag08
Create Date: 2026-04-22 17:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'c0mm155ag09'
down_revision = 'c0mm155ag08'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'commission_claim',
        sa.Column('claim_type', sa.String(20), nullable=True),
    )
    op.execute("""
        UPDATE commission_claim
        SET claim_type = 'residential'
        WHERE claim_type IS NULL;
    """)
    op.alter_column('commission_claim', 'claim_type', nullable=False)
    op.create_check_constraint(
        'ck_commission_claim_claim_type',
        'commission_claim',
        "claim_type IN ('residential', 'commercial')",
    )


def downgrade() -> None:
    op.drop_constraint(
        'ck_commission_claim_claim_type', 'commission_claim', type_='check'
    )
    op.drop_column('commission_claim', 'claim_type')
