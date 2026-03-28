"""add_claim_communication_table

Revision ID: 7abec4122e17
Revises: f384e3e2caf4
Create Date: 2026-03-15 01:35:53.153324

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '7abec4122e17'
down_revision = 'f384e3e2caf4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('claim_communication',
    sa.Column('claim_id', sa.UUID(), nullable=False),
    sa.Column('sender_id', sa.UUID(), nullable=False),
    sa.Column('message_type', sa.String(length=20), nullable=False),
    sa.Column('subject', sa.String(length=500), nullable=True),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('recipient_email', sa.String(length=255), nullable=True),
    sa.Column('recipient_name', sa.String(length=255), nullable=True),
    sa.Column('direction', sa.String(length=10), nullable=False),
    sa.Column('channel', sa.String(length=20), nullable=False),
    sa.Column('thread_id', sa.UUID(), nullable=True),
    sa.Column('is_system_generated', sa.Boolean(), nullable=False),
    sa.Column('attachments_json', sa.Text(), nullable=True),
    sa.Column('can_be_removed', sa.Boolean(), nullable=False),
    sa.Column('is_removed', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by_id', sa.UUID(), nullable=True),
    sa.Column('updated_by_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['claim_id'], ['claim.id'], name='fk_claim_comm_claim_id', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['created_by_id'], ['user.id'], name='fk_claim_communication_created_by_id'),
    sa.ForeignKeyConstraint(['sender_id'], ['user.id'], name='fk_claim_comm_sender_id', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['thread_id'], ['claim_communication.id'], name='fk_claim_comm_thread_id', ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'], name='fk_claim_communication_updated_by_id'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_claim_comm_claim_type', 'claim_communication', ['claim_id', 'message_type'], unique=False)
    op.create_index('ix_claim_comm_sender', 'claim_communication', ['sender_id'], unique=False)
    op.create_index('ix_claim_comm_thread', 'claim_communication', ['thread_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_claim_comm_thread', table_name='claim_communication')
    op.drop_index('ix_claim_comm_sender', table_name='claim_communication')
    op.drop_index('ix_claim_comm_claim_type', table_name='claim_communication')
    op.drop_table('claim_communication')
