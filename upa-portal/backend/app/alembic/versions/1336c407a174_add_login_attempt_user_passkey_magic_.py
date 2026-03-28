"""add_login_attempt_user_passkey_magic_link_tables

Revision ID: 1336c407a174
Revises: n7o8p9q0r1s2
Create Date: 2026-03-10 16:55:19.484873

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '1336c407a174'
down_revision = 'n7o8p9q0r1s2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('login_attempt',
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('ip_address', sa.String(length=45), nullable=False),
    sa.Column('user_agent', sa.String(length=500), nullable=True),
    sa.Column('method', sa.String(length=20), nullable=False),
    sa.Column('success', sa.Boolean(), nullable=False),
    sa.Column('failure_reason', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], name='fk_login_attempt_user_id'),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB'
    )
    op.create_table('magic_link_token',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('token_hash', sa.String(length=255), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], name='fk_magic_link_token_user_id'),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_magic_link_token_token_hash'), 'magic_link_token', ['token_hash'], unique=True)
    op.create_table('user_passkey',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('credential_id', sa.LargeBinary(), nullable=False),
    sa.Column('public_key', sa.LargeBinary(), nullable=False),
    sa.Column('sign_count', sa.Integer(), nullable=False),
    sa.Column('device_name', sa.String(length=255), nullable=True),
    sa.Column('transports', sa.Text(), nullable=True),
    sa.Column('backed_up', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], name='fk_user_passkey_user_id'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('credential_id'),
    mysql_engine='InnoDB'
    )


def downgrade() -> None:
    op.drop_table('user_passkey')
    op.drop_index(op.f('ix_magic_link_token_token_hash'), table_name='magic_link_token')
    op.drop_table('magic_link_token')
    op.drop_table('login_attempt')
