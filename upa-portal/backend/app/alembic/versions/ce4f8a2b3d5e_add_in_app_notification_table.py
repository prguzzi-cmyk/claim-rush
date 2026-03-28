"""add in_app_notification table

Revision ID: ce4f8a2b3d5e
Revises: bd3e7f9a1c4d
Create Date: 2026-03-07 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'ce4f8a2b3d5e'
down_revision = 'bd3e7f9a1c4d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'in_app_notification',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.UUID(as_uuid=True), sa.ForeignKey('user.id', name='fk_notification_user_id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('link', sa.String(500), nullable=True),
        sa.Column('notification_type', sa.String(30), nullable=False, server_default='lead_assignment'),
        sa.Column('is_read', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('lead_id', sa.UUID(as_uuid=True), sa.ForeignKey('lead.id', name='fk_notification_lead_id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_in_app_notification_user_id', 'in_app_notification', ['user_id'])
    op.create_index('ix_in_app_notification_lead_id', 'in_app_notification', ['lead_id'])
    op.create_index('ix_notification_user_read', 'in_app_notification', ['user_id', 'is_read'])


def downgrade() -> None:
    op.drop_index('ix_notification_user_read', table_name='in_app_notification')
    op.drop_index('ix_in_app_notification_lead_id', table_name='in_app_notification')
    op.drop_index('ix_in_app_notification_user_id', table_name='in_app_notification')
    op.drop_table('in_app_notification')
