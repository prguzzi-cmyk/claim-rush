"""create commission engine tables

Creates four new tables for the commission engine:
  - commission_claim     (writing-agent / RVP / CP assignment + gross fee)
  - commission_ledger    (append-only transactions — 6 types × 5 buckets)
  - commission_payout    (disbursements — drives 1099 YTD)
  - commission_advance   (advances — tracked separately from 1099)

Also acts as a merge point for the two existing Alembic heads in the repo
(d1s2p3a4t5c6 and d6e7f8a9b0c1) so `alembic upgrade head` applies cleanly
without a separate merge revision.

Does NOT modify the existing `user`, `role`, `claim`, or `claim_payment`
tables. The commission engine is an additive, self-contained domain.

Revision ID: c0mm15510n01
Revises: d1s2p3a4t5c6, d6e7f8a9b0c1
Create Date: 2026-04-21 15:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c0mm15510n01'
down_revision = ('d1s2p3a4t5c6', 'd6e7f8a9b0c1')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ────────────────────────────────────────────────────────────────
    # commission_claim
    # ────────────────────────────────────────────────────────────────
    op.create_table(
        'commission_claim',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('client_name', sa.String(200), nullable=False),
        sa.Column('claim_number', sa.String(50), nullable=False),
        sa.Column('stage', sa.String(40), server_default='INTAKE_SIGNED', nullable=False),
        sa.Column('gross_fee', sa.Numeric(12, 2), server_default='0', nullable=False),
        sa.Column('direct_cp', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('writing_agent_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('rvp_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('cp_id', sa.UUID(as_uuid=True), nullable=True),
        # TimestampMixin
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        # AuditMixin
        sa.Column('created_by_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', sa.UUID(as_uuid=True), nullable=True),

        sa.ForeignKeyConstraint(['writing_agent_id'], ['user.id'],
                                name='fk_commission_claim_writing_agent_id'),
        sa.ForeignKeyConstraint(['rvp_id'], ['user.id'],
                                name='fk_commission_claim_rvp_id'),
        sa.ForeignKeyConstraint(['cp_id'], ['user.id'],
                                name='fk_commission_claim_cp_id'),
        sa.ForeignKeyConstraint(['created_by_id'], ['user.id'],
                                name='fk_commission_claim_created_by_id'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'],
                                name='fk_commission_claim_updated_by_id'),
        sa.UniqueConstraint('claim_number', name='uq_commission_claim_claim_number'),
    )
    op.create_index('ix_commission_claim_claim_number', 'commission_claim', ['claim_number'])
    op.create_index('ix_commission_claim_writing_agent_id', 'commission_claim', ['writing_agent_id'])

    # ────────────────────────────────────────────────────────────────
    # commission_ledger (append-only)
    # ────────────────────────────────────────────────────────────────
    op.create_table(
        'commission_ledger',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('claim_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('bucket', sa.String(20), nullable=False),
        sa.Column('txn_type', sa.String(30), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('ts', sa.DateTime(timezone=True), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        # TimestampMixin
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),

        sa.ForeignKeyConstraint(['user_id'], ['user.id'],
                                name='fk_commission_ledger_user_id'),
        sa.ForeignKeyConstraint(['claim_id'], ['commission_claim.id'],
                                name='fk_commission_ledger_claim_id',
                                ondelete='CASCADE'),
    )
    op.create_index('ix_commission_ledger_user_id', 'commission_ledger', ['user_id'])
    op.create_index('ix_commission_ledger_claim_id', 'commission_ledger', ['claim_id'])
    op.create_index('ix_commission_ledger_ts', 'commission_ledger', ['ts'])
    op.create_index(
        'ix_commission_ledger_user_bucket_type',
        'commission_ledger',
        ['user_id', 'bucket', 'txn_type'],
    )

    # ────────────────────────────────────────────────────────────────
    # commission_payout
    # ────────────────────────────────────────────────────────────────
    op.create_table(
        'commission_payout',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('method', sa.String(40), nullable=True),
        sa.Column('reference', sa.String(100), nullable=True),
        sa.Column('claim_id', sa.UUID(as_uuid=True), nullable=True),
        # TimestampMixin
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        # AuditMixin
        sa.Column('created_by_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', sa.UUID(as_uuid=True), nullable=True),

        sa.ForeignKeyConstraint(['user_id'], ['user.id'],
                                name='fk_commission_payout_user_id'),
        sa.ForeignKeyConstraint(['claim_id'], ['commission_claim.id'],
                                name='fk_commission_payout_claim_id',
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['user.id'],
                                name='fk_commission_payout_created_by_id'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'],
                                name='fk_commission_payout_updated_by_id'),
    )
    op.create_index('ix_commission_payout_user_id', 'commission_payout', ['user_id'])
    op.create_index('ix_commission_payout_issued_at', 'commission_payout', ['issued_at'])

    # ────────────────────────────────────────────────────────────────
    # commission_advance
    # ────────────────────────────────────────────────────────────────
    op.create_table(
        'commission_advance',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('repaid_amount', sa.Numeric(12, 2), server_default='0', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('claim_id', sa.UUID(as_uuid=True), nullable=True),
        # TimestampMixin
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        # AuditMixin
        sa.Column('created_by_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', sa.UUID(as_uuid=True), nullable=True),

        sa.ForeignKeyConstraint(['user_id'], ['user.id'],
                                name='fk_commission_advance_user_id'),
        sa.ForeignKeyConstraint(['claim_id'], ['commission_claim.id'],
                                name='fk_commission_advance_claim_id',
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['user.id'],
                                name='fk_commission_advance_created_by_id'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'],
                                name='fk_commission_advance_updated_by_id'),
    )
    op.create_index('ix_commission_advance_user_id', 'commission_advance', ['user_id'])
    op.create_index('ix_commission_advance_issued_at', 'commission_advance', ['issued_at'])


def downgrade() -> None:
    op.drop_index('ix_commission_advance_issued_at', table_name='commission_advance')
    op.drop_index('ix_commission_advance_user_id', table_name='commission_advance')
    op.drop_table('commission_advance')

    op.drop_index('ix_commission_payout_issued_at', table_name='commission_payout')
    op.drop_index('ix_commission_payout_user_id', table_name='commission_payout')
    op.drop_table('commission_payout')

    op.drop_index('ix_commission_ledger_user_bucket_type', table_name='commission_ledger')
    op.drop_index('ix_commission_ledger_ts', table_name='commission_ledger')
    op.drop_index('ix_commission_ledger_claim_id', table_name='commission_ledger')
    op.drop_index('ix_commission_ledger_user_id', table_name='commission_ledger')
    op.drop_table('commission_ledger')

    op.drop_index('ix_commission_claim_writing_agent_id', table_name='commission_claim')
    op.drop_index('ix_commission_claim_claim_number', table_name='commission_claim')
    op.drop_table('commission_claim')
