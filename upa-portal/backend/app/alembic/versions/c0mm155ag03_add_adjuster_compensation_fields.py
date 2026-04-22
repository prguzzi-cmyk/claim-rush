"""add adjuster compensation fields to agent_profile

Extends agent_profile with five fields describing how an internal ADJUSTER
is paid. Only meaningful when the user's role is ADJUSTER — nullable on all
other roles. Values:

    adjuster_comp_type VARCHAR(30)     — 'SALARIED' | 'HOURLY' | 'COMMISSION'
                                         | 'SALARY_PLUS_BONUS' | 'HYBRID'
    adjuster_comp_percent NUMERIC(5,2) — 1.00 to 25.00 (percent of house_share
                                         on each paid claim). App-layer
                                         validated — no DB check constraint
                                         so we can admin-override edge cases.
    adjuster_annual_salary NUMERIC(12,2) — for SALARIED / SALARY_PLUS_BONUS
    adjuster_hourly_rate NUMERIC(8,2)   — for HOURLY / HYBRID
    adjuster_comp_effective_date DATE  — when the current config takes effect
                                         (mid-year rate changes).

Commission math semantics: when ADJUSTER_COMPENSATION is emitted for a
claim, the amount deducts from the HOUSE bucket (the firm's take). See
c0mm15510n01 for ledger-type strings; no schema change needed there —
the txn_type is a VARCHAR(30), so 'ADJUSTER_COMPENSATION' lands as
plain data. Adding the new value is a service/schema-level change,
not a migration.

Revision ID: c0mm155ag03
Revises: c0mm155ag02
Create Date: 2026-04-22 07:55:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'c0mm155ag03'
down_revision = 'c0mm155ag02'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('agent_profile',
        sa.Column('adjuster_comp_type', sa.String(30), nullable=True))
    op.add_column('agent_profile',
        sa.Column('adjuster_comp_percent', sa.Numeric(5, 2), nullable=True))
    op.add_column('agent_profile',
        sa.Column('adjuster_annual_salary', sa.Numeric(12, 2), nullable=True))
    op.add_column('agent_profile',
        sa.Column('adjuster_hourly_rate', sa.Numeric(8, 2), nullable=True))
    op.add_column('agent_profile',
        sa.Column('adjuster_comp_effective_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('agent_profile', 'adjuster_comp_effective_date')
    op.drop_column('agent_profile', 'adjuster_hourly_rate')
    op.drop_column('agent_profile', 'adjuster_annual_salary')
    op.drop_column('agent_profile', 'adjuster_comp_percent')
    op.drop_column('agent_profile', 'adjuster_comp_type')
