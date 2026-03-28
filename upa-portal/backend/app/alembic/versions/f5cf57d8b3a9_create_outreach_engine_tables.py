"""create outreach engine tables

Revision ID: f5cf57d8b3a9
Revises: 75f09a57a314
Create Date: 2026-03-15 21:18:27.457544

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f5cf57d8b3a9'
down_revision = '75f09a57a314'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('outreach_template',
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('channel', sa.String(length=10), nullable=False),
    sa.Column('subject', sa.String(length=500), nullable=True),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_by_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['user.id'], name='fk_outreach_template_created_by_id'),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB'
    )
    op.create_table('outreach_campaign',
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('lead_source', sa.String(length=30), nullable=True),
    sa.Column('territory_state', sa.String(length=2), nullable=True),
    sa.Column('contact_method', sa.String(length=10), nullable=False),
    sa.Column('template_id', sa.UUID(), nullable=False),
    sa.Column('delay_minutes', sa.Integer(), nullable=False),
    sa.Column('max_attempts', sa.Integer(), nullable=False),
    sa.Column('trigger_on', sa.String(length=30), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_by_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['user.id'], name='fk_outreach_campaign_created_by_id'),
    sa.ForeignKeyConstraint(['template_id'], ['outreach_template.id'], name='fk_outreach_campaign_template_id', ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB'
    )
    op.create_table('conversation_message',
    sa.Column('lead_id', sa.UUID(), nullable=False),
    sa.Column('direction', sa.String(length=10), nullable=False),
    sa.Column('channel', sa.String(length=10), nullable=False),
    sa.Column('sender_type', sa.String(length=20), nullable=False),
    sa.Column('sender_id', sa.UUID(), nullable=True),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('metadata_json', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['lead_id'], ['lead.id'], name='fk_conversation_message_lead_id', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sender_id'], ['user.id'], name='fk_conversation_message_sender_id', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB'
    )
    op.create_table('outreach_attempt',
    sa.Column('campaign_id', sa.UUID(), nullable=False),
    sa.Column('lead_id', sa.UUID(), nullable=False),
    sa.Column('template_id', sa.UUID(), nullable=True),
    sa.Column('channel', sa.String(length=10), nullable=False),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('attempt_number', sa.Integer(), nullable=False),
    sa.Column('recipient_phone', sa.String(length=20), nullable=True),
    sa.Column('recipient_email', sa.String(length=255), nullable=True),
    sa.Column('message_body', sa.Text(), nullable=True),
    sa.Column('response_text', sa.Text(), nullable=True),
    sa.Column('agent_id', sa.UUID(), nullable=True),
    sa.Column('communication_log_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['agent_id'], ['user.id'], name='fk_outreach_attempt_agent_id', ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['campaign_id'], ['outreach_campaign.id'], name='fk_outreach_attempt_campaign_id', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['communication_log_id'], ['communication_log.id'], name='fk_outreach_attempt_comm_log_id', ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['lead_id'], ['lead.id'], name='fk_outreach_attempt_lead_id', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['template_id'], ['outreach_template.id'], name='fk_outreach_attempt_template_id', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB'
    )


def downgrade() -> None:
    op.drop_table('outreach_attempt')
    op.drop_table('conversation_message')
    op.drop_table('outreach_campaign')
    op.drop_table('outreach_template')
