"""add_skiptrace_wallet_and_owner_intelligence

Revision ID: b484ce17db0d
Revises: b744101c6838
Create Date: 2026-03-11 00:04:22.056660

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b484ce17db0d'
down_revision = 'b744101c6838'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('skiptrace_wallet',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('credit_balance', sa.Integer(), nullable=False),
    sa.Column('credits_used', sa.Integer(), nullable=False),
    sa.Column('last_recharge_date', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by_id', sa.UUID(), nullable=True),
    sa.Column('updated_by_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['user.id'], name='fk_skiptrace_wallet_created_by_id'),
    sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'], name='fk_skiptrace_wallet_updated_by_id'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], name='fk_skiptrace_wallet_user_id', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', name='uq_skiptrace_wallet_user_id')
    )
    op.create_table('lead_owner_intelligence',
    sa.Column('lead_id', sa.UUID(), nullable=False),
    sa.Column('owner_first_name', sa.String(length=100), nullable=True),
    sa.Column('owner_last_name', sa.String(length=100), nullable=True),
    sa.Column('owner_email', sa.String(length=200), nullable=True),
    sa.Column('owner_phone', sa.String(length=50), nullable=True),
    sa.Column('owner_mailing_street', sa.String(length=255), nullable=True),
    sa.Column('owner_mailing_city', sa.String(length=100), nullable=True),
    sa.Column('owner_mailing_state', sa.String(length=50), nullable=True),
    sa.Column('owner_mailing_zip', sa.String(length=20), nullable=True),
    sa.Column('raw_residents', sa.Text(), nullable=True),
    sa.Column('lookup_status', sa.String(length=30), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by_id', sa.UUID(), nullable=True),
    sa.Column('updated_by_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['user.id'], name='fk_lead_owner_intelligence_created_by_id'),
    sa.ForeignKeyConstraint(['lead_id'], ['lead.id'], name='fk_lead_owner_intelligence_lead_id', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'], name='fk_lead_owner_intelligence_updated_by_id'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('lead_id', name='uq_lead_owner_intelligence_lead_id')
    )
    op.create_table('skiptrace_transaction',
    sa.Column('wallet_id', sa.UUID(), nullable=False),
    sa.Column('lead_id', sa.UUID(), nullable=True),
    sa.Column('credits_used', sa.Integer(), nullable=False),
    sa.Column('lookup_status', sa.String(length=30), nullable=False),
    sa.Column('address_queried', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['lead_id'], ['lead.id'], name='fk_skiptrace_transaction_lead_id'),
    sa.ForeignKeyConstraint(['wallet_id'], ['skiptrace_wallet.id'], name='fk_skiptrace_transaction_wallet_id', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('skiptrace_transaction')
    op.drop_table('lead_owner_intelligence')
    op.drop_table('skiptrace_wallet')
