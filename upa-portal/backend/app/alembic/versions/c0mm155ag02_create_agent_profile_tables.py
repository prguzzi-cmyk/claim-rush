"""create agent profile / license / banking tables + agent_number sequences

Adds three new satellite tables around `user` for agent-specific fields that
don't belong on the general user entity. Also provisions five Postgres
sequences used by the service layer to generate role-prefixed, zero-padded
`agent_number` values atomically:

    AGENT               → WA-####    (writing agent)
    RVP                 → RVP-####
    CP                  → CP-####
    ADMIN / super-admin → ADM-####
    other               → GEN-####

Each prefix has its own sequence so the counters are independent — WA-0001
through WA-9999 coexist with RVP-0001 through RVP-9999 etc.

Revision ID: c0mm155ag02
Revises: c0mm15510n01
Create Date: 2026-04-22 05:15:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c0mm155ag02'
down_revision = 'c0mm15510n01'
branch_labels = None
depends_on = None


# Sequence names (must match the service-layer lookup in agent_service.py).
_AGENT_NUMBER_SEQUENCES = (
    'agent_number_seq_wa',
    'agent_number_seq_rvp',
    'agent_number_seq_cp',
    'agent_number_seq_adm',
    'agent_number_seq_gen',
)


def upgrade() -> None:
    # ────────────────────────────────────────────────────────────────
    # Per-prefix sequences for agent_number generation.
    # Each starts at 1, increments by 1, no cycle.
    # ────────────────────────────────────────────────────────────────
    for seq in _AGENT_NUMBER_SEQUENCES:
        op.execute(sa.text(
            f"CREATE SEQUENCE IF NOT EXISTS {seq} "
            f"START WITH 1 INCREMENT BY 1 NO CYCLE"
        ))

    # ────────────────────────────────────────────────────────────────
    # agent_profile (1:1 with user)
    # ────────────────────────────────────────────────────────────────
    op.create_table(
        'agent_profile',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_number', sa.String(20), nullable=False),

        # Tax / identity
        sa.Column('ssn_or_itin_last4', sa.String(4), nullable=True),
        sa.Column('tax_classification', sa.String(20), nullable=True),
        sa.Column('w9_signed_at', sa.Date(), nullable=True),
        sa.Column('w9_file_id', sa.UUID(as_uuid=True), nullable=True),

        # Employment
        sa.Column('employment_start_date', sa.Date(), nullable=True),
        sa.Column('employment_end_date', sa.Date(), nullable=True),
        sa.Column('termination_reason', sa.Text(), nullable=True),

        # Compliance
        sa.Column('background_check_status', sa.String(30), nullable=True),
        sa.Column('background_check_completed_at', sa.Date(), nullable=True),
        sa.Column('drug_test_passed_at', sa.Date(), nullable=True),
        sa.Column('non_compete_signed_at', sa.Date(), nullable=True),
        sa.Column('non_compete_file_id', sa.UUID(as_uuid=True), nullable=True),

        # Emergency contact / beneficiary
        sa.Column('emergency_contact_name', sa.String(200), nullable=True),
        sa.Column('emergency_contact_phone', sa.String(30), nullable=True),
        sa.Column('beneficiary_name', sa.String(200), nullable=True),
        sa.Column('beneficiary_relationship', sa.String(100), nullable=True),

        # Commission configuration
        sa.Column('commission_tier_override', sa.Numeric(4, 2), nullable=True),

        sa.Column('notes', sa.Text(), nullable=True),

        # TimestampMixin
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        # AuditMixin
        sa.Column('created_by_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', sa.UUID(as_uuid=True), nullable=True),

        sa.ForeignKeyConstraint(['user_id'], ['user.id'],
                                name='fk_agent_profile_user_id',
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['w9_file_id'], ['file.id'],
                                name='fk_agent_profile_w9_file_id',
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['non_compete_file_id'], ['file.id'],
                                name='fk_agent_profile_non_compete_file_id',
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['user.id'],
                                name='fk_agent_profile_created_by_id'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'],
                                name='fk_agent_profile_updated_by_id'),
        sa.UniqueConstraint('user_id', name='uq_agent_profile_user_id'),
        sa.UniqueConstraint('agent_number', name='uq_agent_profile_agent_number'),
    )
    op.create_index('ix_agent_profile_user_id', 'agent_profile', ['user_id'])
    op.create_index('ix_agent_profile_agent_number', 'agent_profile', ['agent_number'])

    # ────────────────────────────────────────────────────────────────
    # agent_license (1:N with user)
    # ────────────────────────────────────────────────────────────────
    op.create_table(
        'agent_license',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('state', sa.String(2), nullable=False),
        sa.Column('license_type', sa.String(40), nullable=False),
        sa.Column('license_number', sa.String(80), nullable=False),
        sa.Column('issued_on', sa.Date(), nullable=True),
        sa.Column('expires_on', sa.Date(), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verified_by_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='ACTIVE'),
        sa.Column('file_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),

        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', sa.UUID(as_uuid=True), nullable=True),

        sa.ForeignKeyConstraint(['user_id'], ['user.id'],
                                name='fk_agent_license_user_id',
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['verified_by_id'], ['user.id'],
                                name='fk_agent_license_verified_by_id',
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['file_id'], ['file.id'],
                                name='fk_agent_license_file_id',
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['user.id'],
                                name='fk_agent_license_created_by_id'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'],
                                name='fk_agent_license_updated_by_id'),
        sa.UniqueConstraint(
            'user_id', 'state', 'license_type', 'license_number',
            name='uq_agent_license_user_state_type_number',
        ),
    )
    op.create_index('ix_agent_license_user_id', 'agent_license', ['user_id'])
    op.create_index('ix_agent_license_expires_on', 'agent_license', ['expires_on'])

    # ────────────────────────────────────────────────────────────────
    # agent_banking (1:1 with user) — display-safe fields only; full
    # account/routing numbers live in encrypted-at-rest infra (TBD).
    # ────────────────────────────────────────────────────────────────
    op.create_table(
        'agent_banking',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('payout_method', sa.String(20), nullable=True),
        sa.Column('account_holder_name', sa.String(200), nullable=True),
        sa.Column('bank_name', sa.String(100), nullable=True),
        sa.Column('account_number_last4', sa.String(4), nullable=True),
        sa.Column('routing_number_last4', sa.String(4), nullable=True),
        sa.Column('ach_authorization_signed_at', sa.Date(), nullable=True),
        sa.Column('ach_authorization_file_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),

        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', sa.UUID(as_uuid=True), nullable=True),

        sa.ForeignKeyConstraint(['user_id'], ['user.id'],
                                name='fk_agent_banking_user_id',
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ach_authorization_file_id'], ['file.id'],
                                name='fk_agent_banking_ach_auth_file_id',
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['user.id'],
                                name='fk_agent_banking_created_by_id'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'],
                                name='fk_agent_banking_updated_by_id'),
        sa.UniqueConstraint('user_id', name='uq_agent_banking_user_id'),
    )
    op.create_index('ix_agent_banking_user_id', 'agent_banking', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_agent_banking_user_id', table_name='agent_banking')
    op.drop_table('agent_banking')

    op.drop_index('ix_agent_license_expires_on', table_name='agent_license')
    op.drop_index('ix_agent_license_user_id', table_name='agent_license')
    op.drop_table('agent_license')

    op.drop_index('ix_agent_profile_agent_number', table_name='agent_profile')
    op.drop_index('ix_agent_profile_user_id', table_name='agent_profile')
    op.drop_table('agent_profile')

    for seq in _AGENT_NUMBER_SEQUENCES:
        op.execute(sa.text(f"DROP SEQUENCE IF EXISTS {seq}"))
