"""commission_claim.estimate_divergence_percentage stored as literal percent

Was NUMERIC(5,4) holding a fractional decimal (0.28 == 28%); switching
to NUMERIC(5,2) holding the literal percent figure (28.00 == 28%).

Existing rows are multiplied by 100 in-place via the USING clause so
no data is lost. Frontend / backend code are updated in the same
commit to write and read the literal percent.

Revision ID: c0mm155ag08
Revises: c0mm155ag07
Create Date: 2026-04-22 16:30:00.000000
"""
from alembic import op


revision = 'c0mm155ag08'
down_revision = 'c0mm155ag07'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE commission_claim
        ALTER COLUMN estimate_divergence_percentage
        TYPE NUMERIC(5, 2)
        USING (estimate_divergence_percentage * 100);
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE commission_claim
        ALTER COLUMN estimate_divergence_percentage
        TYPE NUMERIC(5, 4)
        USING (estimate_divergence_percentage / 100);
    """)
