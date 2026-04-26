"""add opt-out / consent columns to lead_contact

Four columns referenced by the LeadContact model that no upstream chain
migration creates. The /v1/leads list query joins lead_contact and selects
sms_opt_out — without these columns, /v1/leads + /v1/fire-incidents both
409 with "column lead_contact_1.sms_opt_out does not exist".

Columns:
  sms_opt_out   BOOLEAN NOT NULL DEFAULT false
  email_opt_out BOOLEAN NOT NULL DEFAULT false
  voice_opt_out BOOLEAN NOT NULL DEFAULT false
  opt_out_at    TIMESTAMPTZ

server_default='false' on the three booleans so existing rows backfill
without a NOT NULL violation; the booleans are then enforced NOT NULL.

Revision ID: cplprep03
Revises: cplprep02
Create Date: 2026-04-26 11:00:02.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'cplprep03'
down_revision = 'cplprep02'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'lead_contact',
        sa.Column('sms_opt_out', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column(
        'lead_contact',
        sa.Column('email_opt_out', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column(
        'lead_contact',
        sa.Column('voice_opt_out', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column(
        'lead_contact',
        sa.Column('opt_out_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('lead_contact', 'opt_out_at')
    op.drop_column('lead_contact', 'voice_opt_out')
    op.drop_column('lead_contact', 'email_opt_out')
    op.drop_column('lead_contact', 'sms_opt_out')
