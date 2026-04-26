"""add UPA -> ACI funnel columns to lead

Seven columns referenced by the Lead model and selected by /v1/leads list +
detail queries, but no upstream chain migration adds them. Staging restored
from a production snapshot was missing all seven, causing every /v1/leads*
request to 409 with "column lead.routing_bucket does not exist".

Columns:
  routing_bucket VARCHAR(20) [indexed]
  contact_status VARCHAR(20) [indexed]
  template_profile VARCHAR(100)
  last_outreach_at TIMESTAMPTZ
  last_reply VARCHAR(500)
  source_queue VARCHAR(50)
  escalated_to_aci BOOLEAN DEFAULT false

All NULL/server_default-safe so existing prod rows backfill without a NOT
NULL violation.

Revision ID: cplprep02
Revises: r0nb0arding02
Create Date: 2026-04-26 11:00:01.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'cplprep02'
down_revision = 'r0nb0arding02'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('lead', sa.Column('routing_bucket', sa.String(20), nullable=True))
    op.create_index('ix_lead_routing_bucket', 'lead', ['routing_bucket'])

    op.add_column('lead', sa.Column('contact_status', sa.String(20), nullable=True))
    op.create_index('ix_lead_contact_status', 'lead', ['contact_status'])

    op.add_column('lead', sa.Column('template_profile', sa.String(100), nullable=True))
    op.add_column('lead', sa.Column('last_outreach_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('lead', sa.Column('last_reply', sa.String(500), nullable=True))
    op.add_column('lead', sa.Column('source_queue', sa.String(50), nullable=True))
    op.add_column(
        'lead',
        sa.Column('escalated_to_aci', sa.Boolean(), nullable=True, server_default=sa.text('false')),
    )


def downgrade() -> None:
    op.drop_column('lead', 'escalated_to_aci')
    op.drop_column('lead', 'source_queue')
    op.drop_column('lead', 'last_reply')
    op.drop_column('lead', 'last_outreach_at')
    op.drop_column('lead', 'template_profile')
    op.drop_index('ix_lead_contact_status', table_name='lead')
    op.drop_column('lead', 'contact_status')
    op.drop_index('ix_lead_routing_bucket', table_name='lead')
    op.drop_column('lead', 'routing_bucket')
