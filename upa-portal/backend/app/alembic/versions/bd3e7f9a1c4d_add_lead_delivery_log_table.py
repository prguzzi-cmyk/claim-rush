"""add lead_delivery_log table

Revision ID: bd3e7f9a1c4d
Revises: ac2b6d3244f1
Create Date: 2026-03-07 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'bd3e7f9a1c4d'
down_revision = 'ac2b6d3244f1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'lead_delivery_log',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('distribution_history_id', sa.UUID(as_uuid=True), sa.ForeignKey('lead_distribution_history.id', name='fk_delivery_log_distribution_id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent_id', sa.UUID(as_uuid=True), sa.ForeignKey('user.id', name='fk_delivery_log_agent_id', ondelete='CASCADE'), nullable=False),
        sa.Column('lead_id', sa.UUID(as_uuid=True), sa.ForeignKey('lead.id', name='fk_delivery_log_lead_id', ondelete='CASCADE'), nullable=False),
        sa.Column('channel', sa.String(10), nullable=False),
        sa.Column('delivery_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('sms_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('email_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('twilio_message_sid', sa.String(50), nullable=True),
        sa.Column('delivery_error', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_lead_delivery_log_distribution_history_id', 'lead_delivery_log', ['distribution_history_id'])
    op.create_index('ix_lead_delivery_log_agent_id', 'lead_delivery_log', ['agent_id'])
    op.create_index('ix_lead_delivery_log_lead_id', 'lead_delivery_log', ['lead_id'])
    op.create_index('ix_delivery_log_lead_channel', 'lead_delivery_log', ['lead_id', 'channel'])


def downgrade() -> None:
    op.drop_index('ix_delivery_log_lead_channel', table_name='lead_delivery_log')
    op.drop_index('ix_lead_delivery_log_lead_id', table_name='lead_delivery_log')
    op.drop_index('ix_lead_delivery_log_agent_id', table_name='lead_delivery_log')
    op.drop_index('ix_lead_delivery_log_distribution_history_id', table_name='lead_delivery_log')
    op.drop_table('lead_delivery_log')
