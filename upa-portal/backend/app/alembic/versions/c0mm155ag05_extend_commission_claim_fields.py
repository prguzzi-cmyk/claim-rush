"""extend commission_claim with intake fields

Adds nullable columns to commission_claim for the New Claim intake flow:

    street_address    VARCHAR(255)  — street line (required at intake)
    city              VARCHAR(128)  — required at intake
    state             VARCHAR(2)    — US state code (required at intake)
    zip               VARCHAR(10)   — 5-digit or ZIP+4 (required at intake)
    carrier           VARCHAR(120)  — insurance carrier (free-form)
    loss_date         DATE          — date of loss
    loss_type         VARCHAR(30)   — FIRE / WATER / WIND / STORM / THEFT / OTHER
    notes             TEXT          — operator-entered notes
    estimate_amount   NUMERIC(12,2) — damage estimate; drives advance tier

A separate unit / apt / suite field was considered but dropped —
operators can append the unit to `street_address` directly
("123 Maple St, Apt 4B"). Keeping the schema flat avoids a column
most rows will never populate.

Legacy `property_address` (TEXT) is kept as a column for now — existing
rows and any external read paths still reference it. New claims stop
writing to it. A follow-up migration will backfill structured fields from
the free-form string where possible and then drop the column.

All nullable at the DB layer; required-field enforcement lives in the
dialog / request schema. Commission math (50/50 master, 4-scenario field
split) doesn't depend on any of these — purely operational metadata.

Revision ID: c0mm155ag05
Revises: c0mm155ag04
Create Date: 2026-04-22 12:45:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'c0mm155ag05'
down_revision = 'c0mm155ag04'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Legacy single-field address — kept for now, no longer written by the
    # New Claim dialog. Scheduled for removal after backfill.
    op.add_column('commission_claim',
        sa.Column('property_address', sa.Text(), nullable=True))

    # Structured address (all nullable; dialog enforces required at the UI)
    op.add_column('commission_claim',
        sa.Column('street_address', sa.String(255), nullable=True))
    op.add_column('commission_claim',
        sa.Column('city', sa.String(128), nullable=True))
    op.add_column('commission_claim',
        sa.Column('state', sa.String(2), nullable=True))
    op.add_column('commission_claim',
        sa.Column('zip', sa.String(10), nullable=True))

    op.add_column('commission_claim',
        sa.Column('carrier', sa.String(120), nullable=True))
    op.add_column('commission_claim',
        sa.Column('loss_date', sa.Date(), nullable=True))
    op.add_column('commission_claim',
        sa.Column('loss_type', sa.String(30), nullable=True))
    op.add_column('commission_claim',
        sa.Column('notes', sa.Text(), nullable=True))
    op.add_column('commission_claim',
        sa.Column('estimate_amount', sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('commission_claim', 'estimate_amount')
    op.drop_column('commission_claim', 'notes')
    op.drop_column('commission_claim', 'loss_type')
    op.drop_column('commission_claim', 'loss_date')
    op.drop_column('commission_claim', 'carrier')
    op.drop_column('commission_claim', 'zip')
    op.drop_column('commission_claim', 'state')
    op.drop_column('commission_claim', 'city')
    op.drop_column('commission_claim', 'street_address')
    op.drop_column('commission_claim', 'property_address')
