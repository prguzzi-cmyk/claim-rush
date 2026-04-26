"""create lead_skip_trace table

Originally a documented no-op ("Table creation handled by b484ce17db0d") but
b484ce17db0d only creates skiptrace_wallet/skiptrace_transaction. The
lead_skip_trace table referenced by the LeadSkipTrace model and
Lead.skip_trace relationship has no other creator, so this migration now
actually creates it.

Stays as a parallel root (down_revision=None) — the existing topology
merges this branch in via b744101c6838.

Revision ID: s1k2i3p4s5h6
Revises:
Create Date: 2026-03-10

"""
from alembic import op
import sqlalchemy as sa


revision = "s1k2i3p4s5h6"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'lead_skip_trace',
        sa.Column('id', sa.Uuid(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('lead_id', sa.Uuid(), nullable=False),
        sa.Column('owner_first_name', sa.String(100), nullable=True),
        sa.Column('owner_middle_name', sa.String(100), nullable=True),
        sa.Column('owner_last_name', sa.String(100), nullable=True),
        sa.Column('owner_full_name', sa.String(255), nullable=True),
        sa.Column('owner_age', sa.String(10), nullable=True),
        sa.Column('owner_email', sa.String(255), nullable=True),
        sa.Column('owner_phone', sa.String(50), nullable=True),
        sa.Column('owner_mailing_street', sa.String(255), nullable=True),
        sa.Column('owner_mailing_street2', sa.String(255), nullable=True),
        sa.Column('owner_mailing_city', sa.String(100), nullable=True),
        sa.Column('owner_mailing_state', sa.String(50), nullable=True),
        sa.Column('owner_mailing_zip', sa.String(20), nullable=True),
        sa.Column('skiptrace_raw_response', sa.Text(), nullable=True),
        sa.Column(
            'skiptrace_status',
            sa.String(20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column('skiptrace_ran_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(
            ['lead_id'], ['lead.id'],
            name='fk_lead_skip_trace_lead_id', ondelete='CASCADE',
        ),
        sa.UniqueConstraint('lead_id', name='uq_lead_skip_trace_lead_id'),
    )
    op.create_index('ix_lead_skip_trace_lead_id', 'lead_skip_trace', ['lead_id'])


def downgrade() -> None:
    op.drop_index('ix_lead_skip_trace_lead_id', table_name='lead_skip_trace')
    op.drop_table('lead_skip_trace')
